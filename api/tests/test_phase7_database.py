"""Inventory races and baseline migrations run only in disposable PostgreSQL schemas."""

import os
from uuid import uuid4, UUID
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from decimal import Decimal
import pytest
from fastapi import HTTPException
from sqlalchemy import select, func, text
from sqlalchemy.orm import Session
from alembic import command
from alembic.config import Config
from app.db.models import Product, InventoryMovement, AppointmentProduct, Appointment
from app.db.session import get_engine
from app.products.schemas import Create, MovementWrite
from app.products.service import metadata_write, manual
from app.appointments.completion import complete, CompletionWrite
from app.appointments.service import save
from app.appointments.schemas import AppointmentWrite
from test_phase5_database import race_database

pytestmark = [
    pytest.mark.database,
    pytest.mark.skipif(
        os.getenv("RUN_DATABASE_TESTS") != "1",
        reason="Set RUN_DATABASE_TESTS=1 for PostgreSQL inventory tests",
    ),
]


@pytest.mark.parametrize(
    "competitor", ["completion", "damage", "adjustment", "retry", "manual_retry", "create_retry"]
)
def test_inventory_races(race_database, competitor):
    engine, actor, data = race_database
    with Session(engine) as session:
        product_id = uuid4()
        create = Create(
            request_id=product_id, name="Race", cost_price=1, retail_price=2, opening_quantity=1
        )
        if competitor != "create_retry":
            metadata_write(session, actor, create)
        appointments = (
            [
                save(
                    session,
                    actor,
                    AppointmentWrite(
                        **{**data, "scheduled_start": f"2026-10-05T{10 + i}:00:00+02:00"}
                    ),
                )["id"]
                for i in range(2)
            ]
            if competitor not in ["manual_retry", "create_retry"]
            else []
        )
    manual_id = uuid4()
    gate = Barrier(2)

    def operate(second):
        with Session(engine) as session:
            gate.wait(timeout=10)
            try:
                if competitor == "create_retry":
                    metadata_write(session, actor, create)
                elif competitor == "manual_retry":
                    manual(
                        session,
                        actor,
                        product_id,
                        MovementWrite(request_id=manual_id, movement_type="STOCK_IN", quantity=1),
                    )
                elif second and competitor in ["damage", "adjustment"]:
                    manual(
                        session,
                        actor,
                        product_id,
                        MovementWrite(
                            request_id=manual_id,
                            movement_type="DAMAGED" if competitor == "damage" else "ADJUSTMENT",
                            quantity=1 if competitor == "damage" else -1,
                        ),
                    )
                else:
                    identifier = appointments[0 if competitor == "retry" or not second else 1]
                    complete(
                        session,
                        actor,
                        identifier,
                        CompletionWrite(
                            service_ids=data["service_ids"],
                            products=[dict(product_id=product_id, usage_type="USED", quantity=1)],
                        ),
                    )
                return 200
            except HTTPException as error:
                return error.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(operate, second) for second in [False, True]]
        results = [f.result(timeout=30) for f in futures]
    assert sorted(results) == (
        [200, 200] if competitor in ["retry", "manual_retry", "create_retry"] else [200, 409]
    )
    with Session(engine) as session:
        row = session.get(Product, product_id)
        assert row.current_stock == (
            2 if competitor == "manual_retry" else 1 if competitor == "create_retry" else 0
        )
        assert row.current_stock == session.scalar(
            select(func.sum(InventoryMovement.quantity)).where(
                InventoryMovement.product_id == product_id
            )
        )
        assert session.scalar(select(func.count()).select_from(InventoryMovement)) == (
            1 if competitor == "create_retry" else 2
        )


def test_migration_baseline_preserves_stock_and_prior_visits():
    engine = get_engine()
    schema = "phase7_test_" + uuid4().hex
    with engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET search_path TO "{schema}"'))
        connection.commit()
        config = Config("alembic.ini")
        config.attributes.update(connection=connection, test_schema=schema)
        try:
            command.upgrade(config, "0001_phase1")
            business, product, client, appointment, entry = [uuid4() for _ in range(5)]
            connection.execute(
                text(
                    "INSERT INTO businesses(id,name,timezone,currency) VALUES (:id,'Baseline','UTC','EUR')"
                ),
                dict(id=business),
            )
            connection.execute(
                text(
                    "INSERT INTO products(id,business_id,name,cost_price,retail_price,current_stock) VALUES (:id,:business,'Old',1,2,10)"
                ),
                dict(id=product, business=business),
            )
            connection.execute(
                text(
                    "INSERT INTO clients(id,business_id,first_name,last_name) VALUES (:id,:business,'Old','Client')"
                ),
                dict(id=client, business=business),
            )
            connection.execute(
                text(
                    "INSERT INTO appointments(id,business_id,client_id,scheduled_start,scheduled_end,status,calculated_duration_minutes,final_duration_minutes,calculated_price,final_price) VALUES (:id,:business,:client,'2026-01-01T10:00Z','2026-01-01T11:00Z','COMPLETED',60,60,10,10)"
                ),
                dict(id=appointment, business=business, client=client),
            )
            connection.execute(
                text(
                    "INSERT INTO appointment_products(id,business_id,appointment_id,product_id,product_name_snapshot,quantity,usage_type) VALUES (:id,:business,:appointment,:product,'Old',2,'USED')"
                ),
                dict(id=entry, business=business, appointment=appointment, product=product),
            )
            connection.execute(
                text(
                    "INSERT INTO inventory_movements(id,business_id,product_id,movement_type,quantity) VALUES (:id,:business,:product,'STOCK_IN',3)"
                ),
                dict(id=uuid4(), business=business, product=product),
            )
            connection.commit()
            command.upgrade(config, "head")
            assert connection.scalar(text("SELECT current_stock FROM products")) == 10
            assert connection.scalar(text("SELECT SUM(quantity) FROM inventory_movements")) == 10
            assert (
                connection.scalar(
                    text(
                        "SELECT quantity FROM inventory_movements WHERE movement_type='ADJUSTMENT'"
                    )
                )
                == 7
            )
            assert connection.scalar(text("SELECT COUNT(*) FROM appointment_products")) == 1
            assert (
                connection.scalar(
                    text(
                        "SELECT COUNT(*) FROM inventory_movements WHERE appointment_id IS NOT NULL"
                    )
                )
                == 0
            )
            connection.commit()
            command.upgrade(config, "head")
            assert connection.scalar(text("SELECT COUNT(*) FROM inventory_movements")) == 2
            connection.commit()
            command.downgrade(config, "0001_phase1")
            assert connection.scalar(text("SELECT COUNT(*) FROM inventory_movements")) == 2
            connection.commit()
            command.upgrade(config, "head")
            assert connection.scalar(text("SELECT COUNT(*) FROM inventory_movements")) == 2
        finally:
            connection.rollback()
            connection.execute(text("SET search_path TO public"))
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            connection.commit()
