"""Live PostgreSQL tests in a disposable schema, never in public/auth schemas."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import os
from uuid import uuid4

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.db.models import (
    Base,
    AdminMembership,
    Appointment,
    AppointmentProduct,
    AppointmentService,
    Barber,
    Business,
    BusinessHours,
    Client,
    Feedback,
    FeedbackStatus,
    InventoryMovement,
    MembershipRole,
    MovementType,
    Product,
    ProductUsage,
    Service,
)
from app.db.seed import AUTH_USER_IDS, BUSINESS_ID, main as seed_main, seed_development, seed_id
from app.db.session import get_engine

pytestmark = [
    pytest.mark.database,
    pytest.mark.skipif(
        os.getenv("RUN_DATABASE_TESTS") != "1",
        reason="Set RUN_DATABASE_TESTS=1 for isolated live PostgreSQL tests",
    ),
]


@pytest.fixture(scope="module")
def database():
    engine = get_engine()
    schema = "phase1_test_" + uuid4().hex
    with engine.connect() as raw:
        raw.execute(text(f'CREATE SCHEMA "{schema}"'))
        raw.commit()
        connection = raw.execution_options(schema_translate_map={None: schema})
        try:
            connection.execute(text(f'SET search_path TO "{schema}"'))
            connection.commit()
            config = Config("alembic.ini")
            config.attributes.update(connection=connection, test_schema=schema)
            command.upgrade(config, "head")
            command.downgrade(config, "base")
            assert inspect(connection).get_table_names(schema=schema) == ["alembic_version"]
            connection.commit()
            command.upgrade(config, "head")
            yield connection, schema
        finally:
            connection.rollback()
            connection.execute(text("SET search_path TO public"))
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            connection.commit()


@pytest.fixture
def session(database):
    connection, _ = database
    transaction = connection.begin()
    with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
        yield session
    transaction.rollback()


@pytest.fixture
def catalog(session):
    seed_development(session, Settings(_env_file=None, app_env="development"))
    return {
        "business": session.get(Business, BUSINESS_ID),
        "client": session.get(Client, seed_id("client:1")),
        "barber": session.get(Barber, seed_id("barber:1")),
        "service": session.get(Service, seed_id("service:Haircut")),
        "product": session.get(Product, seed_id("product:Pomade")),
    }


def appointment(session, catalog, **overrides):
    start = datetime(2026, 10, 3, 10, tzinfo=timezone.utc)
    values = dict(
        business_id=BUSINESS_ID,
        client_id=catalog["client"].id,
        scheduled_start=start,
        scheduled_end=start + timedelta(minutes=30),
        calculated_duration_minutes=30,
        final_duration_minutes=40,
        calculated_price=Decimal("25"),
        final_price=Decimal("27"),
    )
    values.update(overrides)
    value = Appointment(**values)
    session.add(value)
    session.flush()
    return value


def test_migration_roundtrip_and_metadata(database):
    connection, schema = database
    assert set(inspect(connection).get_table_names(schema=schema)) == set(Base.metadata.tables) | {
        "alembic_version"
    }
    assert (
        connection.scalar(text(f'SELECT version_num FROM "{schema}".alembic_version'))
        == "0003_split_hours"
    )
    assert (
        compare_metadata(
            MigrationContext.configure(connection, opts={"compare_type": True}), Base.metadata
        )
        == []
    )
    protected = connection.scalar(
        text(
            "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = :schema AND c.relrowsecurity"
        ),
        {"schema": schema},
    )
    assert protected == 12
    connection.commit()


def test_core_models_and_relationships(session, catalog):
    value = appointment(session, catalog)
    assert value.client.id == catalog["client"].id
    assert value.barber is None
    value.barber = catalog["barber"]
    session.flush()
    session.expire_all()
    assert value.barber.id == catalog["barber"].id
    assert value.business.id == BUSINESS_ID
    assert value in catalog["client"].appointments
    assert value.created_at.utcoffset() == timedelta(0)
    assert value.scheduled_start.utcoffset() == timedelta(0)
    feedback = Feedback(business_id=BUSINESS_ID, name="Visitor", rating=5)
    session.add(feedback)
    session.flush()
    assert feedback.client is None and feedback.appointment is None
    assert feedback.status == FeedbackStatus.PENDING and feedback.is_public is False
    assert session.scalar(select(func.count()).select_from(AdminMembership)) == 3
    assert session.scalar(select(func.count()).select_from(BusinessHours)) == 7


def test_snapshots_and_collections(session, catalog):
    value = appointment(session, catalog)
    haircut = catalog["service"]
    beard = session.get(Service, seed_id("service:Beard Trim"))
    for service in (haircut, beard):
        value.services.append(
            AppointmentService(
                business_id=BUSINESS_ID,
                service=service,
                service_name_snapshot=service.name,
                service_price_snapshot=service.price,
                service_duration_snapshot=service.duration_minutes,
            )
        )
    product = catalog["product"]
    value.products.append(
        AppointmentProduct(
            business_id=BUSINESS_ID,
            product=product,
            product_name_snapshot=product.name,
            quantity=Decimal("0.5"),
            usage_type=ProductUsage.USED,
        )
    )
    session.flush()
    movement = InventoryMovement(
        appointment_product_id=value.products[0].id,
        business_id=BUSINESS_ID,
        product=product,
        appointment=value,
        movement_type=MovementType.USED,
        quantity=Decimal("-0.5"),
    )
    session.add(movement)
    session.flush()
    haircut.name = "New haircut"
    haircut.price = Decimal("30")
    haircut.duration_minutes = 50
    product.name = "New pomade"
    session.flush()
    session.expire_all()
    snapshots = {item.service_name_snapshot: item for item in value.services}
    assert len(snapshots) == 2
    assert snapshots["Haircut"].service_price_snapshot == Decimal("25")
    assert snapshots["Haircut"].service_duration_snapshot == 30
    assert value.products[0].product_name_snapshot == "Pomade"
    assert value.products[0].product.id == product.id
    assert movement in product.inventory_movements
    assert movement.appointment.id == value.id
    assert product.current_stock == Decimal("10")  # No Phase 1 stock workflow.
    assert (value.calculated_price, value.final_price) == (Decimal("25"), Decimal("27"))
    assert (value.calculated_duration_minutes, value.final_duration_minutes) == (30, 40)


@pytest.mark.parametrize(
    "mismatch",
    [
        "client",
        "barber",
        "service",
        "product",
        "appointment_service",
        "appointment_product",
        "movement",
        "feedback",
    ],
)
def test_cross_business_references_rejected(session, catalog, mismatch):
    other = Business(name="Other", timezone="Europe/Rome", currency="EUR")
    session.add(other)
    session.flush()
    other_client = Client(business_id=other.id, first_name="Other", last_name="Client")
    other_barber = Barber(business_id=other.id, name="Other barber")
    other_service = Service(
        business_id=other.id, name="Other service", price=25, duration_minutes=30
    )
    other_product = Product(
        business_id=other.id, name="Other product", cost_price=1, retail_price=2
    )
    session.add_all([other_client, other_barber, other_service, other_product])
    session.flush()
    value = appointment(session, catalog)
    with pytest.raises(IntegrityError):
        if mismatch == "client":
            value.client_id = other_client.id
        elif mismatch == "barber":
            value.barber_id = other_barber.id
        elif mismatch in ("service", "appointment_service"):
            session.add(
                AppointmentService(
                    business_id=BUSINESS_ID if mismatch == "service" else other.id,
                    appointment_id=value.id,
                    service_id=other_service.id,
                    service_name_snapshot="Other",
                    service_price_snapshot=25,
                    service_duration_snapshot=30,
                )
            )
        elif mismatch in ("product", "appointment_product"):
            session.add(
                AppointmentProduct(
                    business_id=BUSINESS_ID if mismatch == "product" else other.id,
                    appointment_id=value.id,
                    product_id=other_product.id,
                    product_name_snapshot="Other",
                    quantity=1,
                    usage_type=ProductUsage.SOLD,
                )
            )
        elif mismatch == "movement":
            session.add(
                InventoryMovement(
                    business_id=BUSINESS_ID,
                    product_id=other_product.id,
                    movement_type=MovementType.STOCK_IN,
                    quantity=1,
                )
            )
        else:
            session.add(
                Feedback(business_id=BUSINESS_ID, client_id=other_client.id, name="Other", rating=4)
            )
        session.flush()


@pytest.mark.parametrize(
    "invalid", ["rating", "duration", "minimum_stock", "membership", "hours", "enum"]
)
def test_integrity_constraints(session, catalog, invalid):
    with pytest.raises(IntegrityError):
        if invalid == "rating":
            session.add(Feedback(business_id=BUSINESS_ID, name="Visitor", rating=6))
        elif invalid == "duration":
            catalog["service"].duration_minutes = -1
        elif invalid == "minimum_stock":
            catalog["product"].minimum_stock = -1
        elif invalid == "membership":
            session.add(
                AdminMembership(
                    business_id=BUSINESS_ID,
                    auth_user_id=AUTH_USER_IDS["owner-1"],
                    role=MembershipRole.OWNER,
                )
            )
        elif invalid == "hours":
            session.add(BusinessHours(business_id=BUSINESS_ID, day_of_week=0, is_closed=True))
        else:
            # Raw SQL verifies DB enum enforcement, independently of ORM validation.
            session.execute(text("UPDATE admin_memberships SET role = 'OTHER'"))
        session.flush()


def test_seed_command_is_repeatable_and_preserves_edits(database, monkeypatch):
    connection, _ = database
    transaction = connection.begin()
    factory = sessionmaker(bind=connection, join_transaction_mode="create_savepoint")
    monkeypatch.setattr("app.db.seed.get_session_factory", lambda: factory)
    monkeypatch.setattr(
        "app.db.seed.get_settings",
        lambda: Settings(_env_file=None, app_env="development", seed_timezone="Europe/Paris"),
    )
    try:
        seed_main()
        with factory.begin() as session:
            session.get(Client, seed_id("client:1")).first_name = "Edited"
        seed_main()
        with factory() as session:
            expected = {
                Business: 1,
                AdminMembership: 3,
                Barber: 2,
                Client: 5,
                Service: 4,
                Product: 4,
                BusinessHours: 7,
            }
            for model, count in expected.items():
                assert session.scalar(select(func.count()).select_from(model)) == count
            assert session.get(Client, seed_id("client:1")).first_name == "Edited"
            assert session.get(Business, BUSINESS_ID).timezone == "Europe/Paris"
            assert session.scalar(select(func.count()).select_from(Appointment)) == 0
            assert (
                session.scalar(
                    select(func.count())
                    .select_from(AdminMembership)
                    .where(AdminMembership.role == MembershipRole.OWNER)
                )
                == 2
            )
    finally:
        transaction.rollback()


def test_seed_refuses_production(session):
    with pytest.raises(ValueError, match="development"):
        seed_development(
            session,
            Settings(
                _env_file=None,
                app_env="production",
                database_url="postgresql://user:password@db.example.test/database?sslmode=require",
                frontend_origin="https://business.pages.dev",
                supabase_url="https://project.supabase.co",
                public_business_id=BUSINESS_ID,
            ),
        )
    assert session.scalar(select(func.count()).select_from(Business)) == 0


@pytest.mark.parametrize("invalid", ["partial", "reversed", "at_open", "at_close", "closed"])
def test_split_hours_database_constraint(session, catalog, invalid):
    row = session.scalar(
        select(BusinessHours).where(
            BusinessHours.business_id == BUSINESS_ID, BusinessHours.day_of_week == 0
        )
    )
    from datetime import time

    row.break_start, row.break_end = time(12), time(14)
    session.flush()
    if invalid == "partial":
        row.break_end = None
    elif invalid == "reversed":
        row.break_end = time(11)
    elif invalid == "at_open":
        row.break_start = row.opening_time
    elif invalid == "at_close":
        row.break_end = row.closing_time
    else:
        row.is_closed = True
    with pytest.raises(IntegrityError):
        session.flush()


def test_split_hours_downgrade_preserves_configured_closure(database, session, catalog):
    from datetime import time

    connection, schema = database
    row = session.scalar(
        select(BusinessHours).where(
            BusinessHours.business_id == BUSINESS_ID, BusinessHours.day_of_week == 0
        )
    )
    row.break_start, row.break_end = time(12), time(14)
    session.flush()
    config = Config("alembic.ini")
    config.attributes.update(connection=connection, test_schema=schema)
    with pytest.raises(RuntimeError, match="Cannot downgrade"):
        command.downgrade(config, "0002_phase7")
    assert (
        connection.scalar(text(f'SELECT version_num FROM "{schema}".alembic_version'))
        == "0003_split_hours"
    )
    session.refresh(row)
    assert (row.break_start, row.break_end) == (time(12), time(14))
