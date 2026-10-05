"""Deterministic development fixtures. Run from api/: python -m app.db.seed."""
from datetime import time
from decimal import Decimal
from uuid import UUID, uuid5

from app.inventory.service import change_stock, opening_id
from app.db.locking import lock_business
from app.core.config import get_settings
from app.db.models import (
    AdminMembership, Barber, Business, BusinessHours, Client, MembershipRole,
    Product, Service,
)
from app.db.session import get_session_factory

NAMESPACE = UUID("bf93ed0e-17fb-49f1-b4a4-0c4ae0fa6574")


def seed_id(name):
    return uuid5(NAMESPACE, name)


BUSINESS_ID = seed_id("business")
# These are application placeholders, not provisioned Supabase Auth identities.
AUTH_USER_IDS = {name: seed_id("auth:" + name) for name in ("owner-1", "owner-2", "staff-1")}


def seed_development(session, settings):
    if settings.app_env != "development":
        raise ValueError("Development seed requires APP_ENV=development")

    def add_missing(model, label, **values):
        identifier = seed_id(label)
        if session.get(model, identifier) is None:
            session.add(model(id=identifier, **values))
            session.flush()

    add_missing(Business, "business", name="I Minati Parrucchieri", timezone=settings.seed_timezone,
                currency="EUR", email="studio@example.test", phone="+390000000000", address="Sample address")
    lock_business(session, BUSINESS_ID)
    for name, role in (("owner-1", MembershipRole.OWNER), ("owner-2", MembershipRole.OWNER), ("staff-1", MembershipRole.STAFF)):
        add_missing(AdminMembership, "membership:" + name, business_id=BUSINESS_ID,
                    auth_user_id=AUTH_USER_IDS[name], role=role)
    for i in range(1, 3):
        add_missing(Barber, f"barber:{i}", business_id=BUSINESS_ID, name=f"Barber {i}", is_active=True)
    for i in range(1, 6):
        add_missing(Client, f"client:{i}", business_id=BUSINESS_ID, first_name=f"Sample {i}",
                    last_name="Client", email=f"client{i}@example.test")
    for name, duration, price in (("Haircut", 30, "25.00"), ("Beard Trim", 15, "15.00"),
                                  ("Haircut + Beard", 45, "35.00"), ("Hair Coloring", 90, "65.00")):
        add_missing(Service, "service:" + name, business_id=BUSINESS_ID, name=name,
                    duration_minutes=duration, price=Decimal(price), is_active=True)
    for i, name in enumerate(("Pomade", "Beard Oil", "Shampoo", "Hair Wax"), start=1):
        identifier = seed_id("product:" + name)
        if session.get(Product, identifier) is None:
            product = Product(id=identifier, business_id=BUSINESS_ID, name=name,
                              brand="Sample", category="Hair care", sku=f"SAMPLE-{i}", cost_price=Decimal("8.00"),
                              retail_price=Decimal("16.00"), current_stock=Decimal(0), minimum_stock=Decimal("3"),
                              is_active=True, is_public=i != 4)
            session.add(product)
            session.flush()
            change_stock(session, product, Decimal(10), 'STOCK_IN', opening_id(identifier))
    for day in range(7):
        closed = day == 6
        add_missing(BusinessHours, f"hours:{day}", business_id=BUSINESS_ID, day_of_week=day,
                    opening_time=None if closed else time(9), closing_time=None if closed else time(18),
                    is_closed=closed)


def main():
    settings = get_settings()
    if settings.app_env != "development":
        raise SystemExit("Development seed requires APP_ENV=development")
    with get_session_factory().begin() as session:
        seed_development(session, settings)
    print("Development seed loaded; existing deterministic records preserved.")


if __name__ == "__main__":
    main()
