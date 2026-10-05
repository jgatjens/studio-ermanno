from decimal import Decimal
from uuid import UUID, uuid4
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select, func, event
from sqlalchemy.orm import Session
from app.db.models import (
    Product,
    InventoryMovement,
    Appointment,
    AppointmentProduct,
    AppointmentStatus,
    Business,
)
from app.db.seed import seed_development, BUSINESS_ID, seed_id
from app.core.config import Settings
from test_auth import auth_client, signing, headers
from test_phase5 import booking
from test_phase6 import completion_case, send

DATA = dict(
    name=" Pomade ",
    brand=" Brand ",
    sku="SKU-1",
    cost_price="1.25",
    retail_price="3.50",
    minimum_stock="2",
    opening_quantity="10",
)


def create(auth, **patch):
    client, sign, *_ = auth
    return client.post(
        "/products", json={**DATA, "request_id": str(uuid4()), **patch}, headers=headers(sign())
    )


def stock(auth, identifier, **patch):
    client, sign, *_ = auth
    return client.post(
        f"/products/{identifier}/movements",
        json={**dict(request_id=str(uuid4()), movement_type="STOCK_IN", quantity="1"), **patch},
        headers=headers(sign()),
    )


def metadata(row):
    return {
        key: row[key]
        for key in [
            "name",
            "brand",
            "category",
            "description",
            "sku",
            "cost_price",
            "retail_price",
            "minimum_stock",
            "is_active",
            "is_public",
        ]
    }


@pytest.mark.parametrize("case", ["missing", "invalid", "expired", "outsider"])
def test_authentication(auth_client, case):
    client, sign, _, _, outsider, *_ = auth_client
    auth = (
        {}
        if case == "missing"
        else headers(
            "bad"
            if case == "invalid"
            else sign(exp=datetime.now(timezone.utc) - timedelta(minutes=1))
            if case == "expired"
            else sign(outsider)
        )
    )
    for path in ["/products", "/inventory"]:
        assert client.get(path, headers=auth).status_code == (403 if case == "outsider" else 401)


@pytest.mark.parametrize(
    "patch",
    [
        {"name": " "},
        {"current_stock": 2},
        {"business_id": str(uuid4())},
        {"role": "OWNER"},
        {"cost_price": "-1"},
        {"retail_price": "1.001"},
        {"opening_quantity": "-1"},
        {"minimum_stock": "1.0001"},
        {"opening_quantity": "NaN"},
        {"request_id": "bad"},
    ],
)
def test_product_validation(auth_client, patch):
    assert create(auth_client, **patch).status_code == 422


def test_opening_retry_metadata_sku_and_scope(auth_client):
    client, sign, _, staff, _, business, engine = auth_client
    identifier = str(uuid4())
    first = create(auth_client, request_id=identifier)
    assert first.status_code == 201, first.text
    row = first.json()
    assert row["name"] == "Pomade" and Decimal(str(row["current_stock"])) == 10
    assert create(auth_client, request_id=identifier).status_code == 200
    assert (
        create(auth_client, request_id=identifier, opening_quantity="11").json()["detail"]["code"]
        == "request_conflict"
    )
    assert create(auth_client).json()["detail"]["code"] == "sku_conflict"
    edited = client.put(
        "/products/" + identifier,
        json={**metadata(row), "name": "Edited", "is_active": False, "is_public": True},
        headers=headers(sign()),
    )
    assert edited.status_code == 200 and edited.json()["current_stock"] == row["current_stock"]
    assert create(auth_client, request_id=identifier).status_code == 409
    assert client.get("/inventory", headers=headers(sign())).json()["total"] == 0
    assert (
        client.get("/inventory?include_inactive=true", headers=headers(sign())).json()["total"] == 1
    )
    for path in [
        "/products",
        "/inventory?include_inactive=true",
        "/products/" + identifier,
        "/products/" + identifier + "/movements",
    ]:
        assert client.get(path, headers=headers(sign(staff))).status_code == 200
    for path, method, body in [
        ("/products", "post", {**DATA, "request_id": str(uuid4())}),
        ("/products/" + str(uuid4()), "put", metadata(row)),
        (
            "/products/" + str(uuid4()) + "/movements",
            "post",
            dict(request_id=str(uuid4()), movement_type="STOCK_IN", quantity=1),
        ),
    ]:
        assert (
            getattr(client, method)(path, json=body, headers=headers(sign(staff))).status_code
            == 403
        )
    with Session(engine) as session:
        other = Business(name="Other", timezone="UTC", currency="EUR")
        session.add(other)
        session.flush()
        foreign = Product(business_id=other.id, name="Other", cost_price=0, retail_price=0)
        session.add(foreign)
        session.commit()
        foreign_id = str(foreign.id)
    assert create(auth_client, request_id=foreign_id, sku="OTHER").status_code == 409
    for suffix in ["", "/movements"]:
        assert (
            client.get("/products/" + foreign_id + suffix, headers=headers(sign())).status_code
            == 404
        )
    assert (
        client.put(
            "/products/" + foreign_id, json=metadata(row), headers=headers(sign())
        ).status_code
        == 404
    )
    assert client.delete("/products/" + identifier, headers=headers(sign())).status_code == 405


def test_zero_opening_search_filters_and_low_equality(auth_client):
    client, sign, *_ = auth_client
    zero = create(auth_client, sku="", opening_quantity="0", minimum_stock=0).json()
    assert zero["sku"] is None and zero["low_stock"]
    assert (
        client.get("/products/" + zero["id"] + "/movements", headers=headers(sign())).json()[
            "total"
        ]
        == 0
    )
    create(auth_client, name="Other", sku="OTHER", minimum_stock=10)
    for q in ["pomade", "BRAND"]:
        assert (
            client.get("/products", params={"q": q}, headers=headers(sign())).json()["total"] >= 1
        )
    for q in ["%", "_"]:
        assert (
            client.get("/products", params={"q": q}, headers=headers(sign())).json()["total"] == 0
        )
    assert (
        client.get("/products?low_stock=true&limit=1&offset=1", headers=headers(sign())).json()[
            "total"
        ]
        == 2
    )
    for suffix in ["?limit=0", "?limit=101", "?offset=-1", "?q=" + "x" * 201]:
        assert client.get("/products" + suffix, headers=headers(sign())).status_code == 422


@pytest.mark.parametrize(
    "type,quantity,delta",
    [
        ("STOCK_IN", "2.125", "2.125"),
        ("DAMAGED", "2", "-2"),
        ("ADJUSTMENT", "-2.001", "-2.001"),
        ("ADJUSTMENT", "2", "2"),
    ],
)
def test_manual_ledger_retry(auth_client, type, quantity, delta):
    client, sign, _, staff, _, _, engine = auth_client
    row = create(auth_client).json()
    command = dict(
        request_id=str(uuid4()), movement_type=type, quantity=quantity, notes=" Private "
    )
    path = "/products/" + row["id"] + "/movements"
    a = client.post(path, json=command, headers=headers(sign()))
    assert a.status_code == 201, a.text
    b = client.post(path, json=command, headers=headers(sign()))
    assert b.status_code == 200
    assert Decimal(str(b.json()["product"]["current_stock"])) == 10 + Decimal(delta)
    assert (
        client.post(path, json={**command, "notes": "Changed"}, headers=headers(sign())).status_code
        == 409
    )
    assert (
        client.post(
            path, json={**command, "request_id": str(uuid4())}, headers=headers(sign())
        ).status_code
        == 201
    )
    owner = client.get(path, headers=headers(sign())).json()
    assert owner["total"] == 3
    assert any(m["notes"] == "Private" for m in owner["items"])
    assert all(
        "notes" not in m for m in client.get(path, headers=headers(sign(staff))).json()["items"]
    )
    with Session(engine) as session:
        assert session.get(Product, UUID(row["id"])).current_stock == session.scalar(
            select(func.sum(InventoryMovement.quantity)).where(
                InventoryMovement.product_id == UUID(row["id"])
            )
        )


@pytest.mark.parametrize(
    "patch",
    [
        {"quantity": "0"},
        {"quantity": "-1"},
        {"quantity": "1.0001"},
        {"quantity": "1000000000"},
        {"movement_type": "USED"},
        {"appointment_id": str(uuid4())},
        {"business_id": str(uuid4())},
        {"quantity": "Infinity"},
    ],
)
def test_manual_validation(auth_client, patch):
    row = create(auth_client).json()
    assert stock(auth_client, row["id"], **patch).status_code == 422


def test_stock_overflow_insufficient_and_atomic_insert(auth_client):
    client, sign, _, _, _, _, engine = auth_client
    row = create(auth_client, opening_quantity="999999999.999").json()
    assert stock(auth_client, row["id"], quantity="0.001").status_code == 422
    assert (
        stock(
            auth_client, row["id"], movement_type="ADJUSTMENT", quantity="-999999999.999"
        ).status_code
        == 201
    )
    assert (
        stock(auth_client, row["id"], movement_type="DAMAGED", quantity="0.001").json()["detail"][
            "code"
        ]
        == "insufficient_stock"
    )

    def fail(session, *_):
        if any(isinstance(r, InventoryMovement) for r in session.new):
            raise RuntimeError("movement failure")

    event.listen(Session, "before_flush", fail)
    try:
        with pytest.raises(RuntimeError, match="movement failure"):
            stock(auth_client, row["id"])
    finally:
        event.remove(Session, "before_flush", fail)
    with Session(engine) as session:
        assert session.get(Product, UUID(row["id"])).current_stock == 0
        assert session.scalar(select(func.count()).select_from(InventoryMovement)) == 2


def test_aggregate_insufficient_and_staff_history(completion_case):
    booking, appointment, body, identifier = completion_case
    client, sign, _, staff, _, _, engine = booking[0]
    too_many = {
        **body,
        "products": [
            {**body["products"][0], "quantity": "6"},
            {**body["products"][1], "quantity": "5"},
        ],
    }
    assert send(completion_case, too_many).json()["detail"]["code"] == "insufficient_stock"
    with Session(engine) as session:
        assert session.get(Product, UUID(identifier)).current_stock == 10
        assert (
            session.get(Appointment, UUID(appointment["id"])).status == AppointmentStatus.SCHEDULED
        )
        assert session.scalar(select(func.count()).select_from(AppointmentProduct)) == 0
    assert send(completion_case).status_code == 200
    path = "/products/" + identifier + "/movements"
    assert client.get(path, headers=headers(sign())).json()["total"] == 2
    filtered = client.get(path, headers=headers(sign(staff))).json()
    assert filtered["total"] == 1
    assert filtered["items"][0]["movement_type"] == "USED" and "notes" not in filtered["items"][0]
    assert (
        client.get(path + "?movement_type=SOLD", headers=headers(sign(staff))).json()["total"] == 0
    )
    with Session(engine) as session:
        assert all(r.appointment_product_id for r in session.scalars(select(InventoryMovement)))
        session.get(Product, UUID(identifier)).current_stock = 0
        session.commit()
    assert send(completion_case).status_code == 200


def test_legacy_completion_no_replay(completion_case):
    booking, appointment, body, identifier = completion_case
    with Session(booking[0][-1]) as session:
        record = session.get(Appointment, UUID(appointment["id"]))
        record.status = "COMPLETED"
        record.visit_notes = "Private visit"
        for entry in body["products"]:
            session.add(
                AppointmentProduct(
                    business_id=record.business_id,
                    appointment_id=record.id,
                    product_id=UUID(identifier),
                    quantity=Decimal(entry["quantity"]),
                    usage_type=entry["usage_type"],
                    product_name_snapshot="Old",
                )
            )
        session.get(Product, UUID(identifier)).current_stock = 0
        session.commit()
    assert send(completion_case).status_code == 200
    with Session(booking[0][-1]) as session:
        assert session.get(Product, UUID(identifier)).current_stock == 0
        assert session.scalar(select(func.count()).select_from(InventoryMovement)) == 0


def test_completion_rolls_back_movements(completion_case):
    engine = completion_case[0][0][-1]

    def fail(session, *_):
        if any(isinstance(r, InventoryMovement) for r in session.new):
            raise RuntimeError("movement failure")

    event.listen(Session, "before_flush", fail)
    try:
        with pytest.raises(RuntimeError, match="movement failure"):
            send(completion_case)
    finally:
        event.remove(Session, "before_flush", fail)
    with Session(engine) as session:
        assert session.get(Product, UUID(completion_case[3])).current_stock == 10
        assert session.scalar(select(func.count()).select_from(AppointmentProduct)) == 0
        assert session.scalar(select(func.count()).select_from(InventoryMovement)) == 0
        assert (
            session.get(Appointment, UUID(completion_case[1]["id"])).status
            == AppointmentStatus.SCHEDULED
        )


def test_seed_preserves_operational_balance(auth_client):
    with Session(auth_client[-1]) as session:
        settings = Settings(_env_file=None, app_env="development")
        seed_development(session, settings)
        session.commit()
        row = session.get(Product, seed_id("product:Pomade"))
        row.current_stock = 3
        session.add(
            InventoryMovement(
                business_id=BUSINESS_ID, product_id=row.id, movement_type="ADJUSTMENT", quantity=-7
            )
        )
        session.commit()
        seed_development(session, settings)
        session.commit()
        assert row.current_stock == 3
        assert session.scalar(select(func.count()).select_from(InventoryMovement)) == 5
        assert (
            session.scalar(
                select(func.sum(InventoryMovement.quantity)).where(
                    InventoryMovement.product_id == row.id
                )
            )
            == 3
        )


@pytest.mark.parametrize(
    "invalid",
    [
        "negative_stock",
        "zero_delta",
        "wrong_sign",
        "manual_link",
        "missing_link",
        "duplicate_link",
        "foreign_link",
    ],
)
def test_database_inventory_constraints(completion_case, invalid):
    from sqlalchemy.exc import IntegrityError

    booking, appointment, body, identifier = completion_case
    assert send(completion_case).status_code == 200
    with Session(booking[0][-1]) as session:
        product = session.get(Product, UUID(identifier))
        linked = session.scalar(select(InventoryMovement))
        with pytest.raises(IntegrityError):
            if invalid == "negative_stock":
                product.current_stock = -1
            else:
                values = dict(
                    business_id=product.business_id,
                    product_id=product.id,
                    movement_type="ADJUSTMENT",
                    quantity=1,
                )
                if invalid == "zero_delta":
                    values["quantity"] = 0
                if invalid == "wrong_sign":
                    values.update(movement_type="DAMAGED")
                if invalid == "manual_link":
                    values["appointment_id"] = UUID(appointment["id"])
                if invalid == "missing_link":
                    values.update(movement_type="USED", quantity=-1)
                if invalid == "duplicate_link":
                    values.update(
                        movement_type="USED",
                        quantity=-1,
                        appointment_id=linked.appointment_id,
                        appointment_product_id=linked.appointment_product_id,
                    )
                if invalid == "foreign_link":
                    values.update(
                        movement_type="USED",
                        quantity=-1,
                        appointment_id=linked.appointment_id,
                        appointment_product_id=uuid4(),
                    )
                session.add(InventoryMovement(**values))
            session.flush()
        session.rollback()


def test_multiple_products_insufficient_rolls_back_all(completion_case):
    booking, appointment, body, identifier = completion_case
    with Session(booking[0][-1]) as session:
        other = Product(
            business_id=booking[0][5], name="Empty", cost_price=1, retail_price=2, current_stock=0
        )
        session.add(other)
        session.commit()
        other_id = str(other.id)
    assert (
        send(
            completion_case,
            {
                **body,
                "products": body["products"]
                + [dict(product_id=other_id, usage_type="USED", quantity="1")],
            },
        ).status_code
        == 409
    )
    with Session(booking[0][-1]) as session:
        assert session.get(Product, UUID(identifier)).current_stock == 10
        assert session.get(Product, UUID(other_id)).current_stock == 0
        assert session.scalar(select(func.count()).select_from(InventoryMovement)) == 0
        assert session.scalar(select(func.count()).select_from(AppointmentProduct)) == 0


def test_full_metadata_update_rejects_direct_balance_and_partial_input(auth_client):
    client, sign, *_ = auth_client
    row = create(auth_client).json()
    for body in [
        {**metadata(row), "current_stock": 99},
        {"name": "Partial", "cost_price": 1, "retail_price": 2},
    ]:
        assert (
            client.put("/products/" + row["id"], json=body, headers=headers(sign())).status_code
            == 422
        )
    row = client.put(
        "/products/" + row["id"], json={**metadata(row), "sku": "sku-1"}, headers=headers(sign())
    ).json()
    assert (
        create(auth_client, sku="SKU-1").status_code == 201
    )  # Exact case-sensitive SKU uniqueness.
    assert row["current_stock"] == "10.000"
