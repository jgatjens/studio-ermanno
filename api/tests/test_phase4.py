from datetime import datetime, timedelta, timezone
from uuid import uuid4, UUID
import pytest
from sqlalchemy.orm import Session
from app.db.models import (
    Business,
    Client,
    Appointment,
    AppointmentService,
    AppointmentProduct,
    Service,
    Product,
)
from test_auth import auth_client, signing, headers

DATA = dict(
    first_name=" Alice ",
    last_name=" Test ",
    email="alice@example.com",
    phone="+39 1234",
    private_notes="private",
)


def create(client, sign, **patch):
    response = client.post("/clients", json={**DATA, **patch}, headers=headers(sign()))
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize("case", ["missing", "invalid", "expired", "outsider"])
def test_auth(auth_client, case):
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
    assert client.get("/clients", headers=auth).status_code == (403 if case == "outsider" else 401)


@pytest.mark.parametrize(
    "patch",
    [
        {"first_name": " "},
        {"last_name": ""},
        {"email": "bad"},
        {"phone": "x" * 51},
        {"private_notes": "x" * 10001},
        {"business_id": str(uuid4())},
        {"role": "OWNER"},
    ],
)
def test_validation(auth_client, patch):
    client, sign, *_ = auth_client
    assert (
        client.post("/clients", json={**DATA, **patch}, headers=headers(sign())).status_code == 422
    )


def test_search_write_privacy(auth_client):
    client, sign, _, staff, *_ = auth_client
    a = create(client, sign)
    b = create(client, sign, first_name="Bob", email="", phone="", private_notes="")
    assert a["first_name"] == "Alice" and b["email"] is None and a["last_completed_visit"] is None
    for q in ["Alice", "TEST", "example.com", "1234"]:
        assert client.get("/clients", params={"q": q}, headers=headers(sign())).json()["total"] >= 1
    for q in ["example.com", "1234", "private", "%", "_"]:
        assert (
            client.get("/clients", params={"q": q}, headers=headers(sign(staff))).json()["total"]
            == 0
        )
    for path in ["/clients", "/clients/" + a["id"]]:
        value = client.get(path, headers=headers(sign(staff))).json()
        for row in value.get("items", [value]):
            assert not {"email", "phone", "private_notes"} & row.keys()
    assert (
        len(client.get("/clients?limit=1&offset=1", headers=headers(sign())).json()["items"]) == 1
    )
    for suffix in ["?limit=0", "?offset=-1", "?limit=101", "?q=" + "x" * 201]:
        assert client.get("/clients" + suffix, headers=headers(sign())).status_code == 422
    assert client.post("/clients", json=DATA, headers=headers(sign(staff))).status_code == 403
    assert (
        client.put("/clients/" + a["id"], json=DATA, headers=headers(sign(staff))).status_code
        == 403
    )
    response = client.put(
        "/clients/" + a["id"],
        json={"first_name": "Changed", "last_name": "Name"},
        headers=headers(sign()),
    )
    assert response.status_code == 200 and response.json()["email"] is None
    # Deletion is now explicitly supported by the client-profile redesign increment.
    assert client.delete("/clients/" + a["id"], headers=headers(sign(staff))).status_code == 403


def test_isolation(auth_client):
    client, sign, _, _, _, _, engine = auth_client
    with Session(engine) as session:
        business = Business(name="Foreign", timezone="Europe/Rome", currency="EUR")
        session.add(business)
        session.flush()
        record = Client(business_id=business.id, first_name="Alice", last_name="Foreign")
        session.add(record)
        session.commit()
        identifier = str(record.id)
    assert client.get("/clients", headers=headers(sign())).json()["total"] == 0
    for identifier in [identifier, str(uuid4())]:
        assert client.get("/clients/" + identifier, headers=headers(sign())).status_code == 404
        assert (
            client.get("/clients/" + identifier + "/history", headers=headers(sign())).status_code
            == 404
        )
        assert (
            client.put("/clients/" + identifier, json=DATA, headers=headers(sign())).status_code
            == 404
        )


def test_history(auth_client):
    client, sign, _, staff, _, business_id, engine = auth_client
    a = create(client, sign)
    with Session(engine) as session:
        service = Service(business_id=business_id, name="Current", price=10, duration_minutes=10)
        product = Product(
            business_id=business_id,
            name="Current product",
            cost_price=1,
            retail_price=2,
            minimum_stock=0,
        )
        session.add_all([service, product])
        session.flush()
        start = datetime(2026, 1, 1, 10, tzinfo=timezone.utc)
        for i, status in enumerate(
            ["COMPLETED", "COMPLETED", "SCHEDULED", "CONFIRMED", "CANCELLED", "NO_SHOW"]
        ):
            visit = Appointment(
                business_id=business_id,
                client_id=UUID(a["id"]),
                scheduled_start=start + timedelta(days=i),
                scheduled_end=start + timedelta(days=i, hours=1),
                status=status,
                appointment_notes="allowed",
                visit_notes="secret visit",
                calculated_duration_minutes=60,
                final_duration_minutes=60,
                calculated_price=20,
                final_price=20,
            )
            session.add(visit)
            session.flush()
            session.add(
                AppointmentService(
                    business_id=business_id,
                    appointment_id=visit.id,
                    service_id=service.id,
                    service_name_snapshot="Historical cut",
                    service_price_snapshot=20,
                    service_duration_snapshot=60,
                )
            )
            for usage in ["USED", "SOLD"]:
                session.add(
                    AppointmentProduct(
                        business_id=business_id,
                        appointment_id=visit.id,
                        product_id=product.id,
                        product_name_snapshot="Historical product",
                        quantity=1,
                        usage_type=usage,
                    )
                )
        service.name = "Edited"
        service.is_active = False
        product.name = "Edited product"
        session.commit()
    owner = client.get("/clients/" + a["id"] + "/history", headers=headers(sign())).json()
    assert owner["total"] == 2 and owner["items"][0]["scheduled_start"].startswith("2026-01-02")
    assert (
        owner["items"][0]["visit_notes"] == "secret visit"
        and len(owner["items"][0]["products"]) == 2
    )
    restricted = client.get("/clients/" + a["id"] + "/history", headers=headers(sign(staff))).json()
    for visit in restricted["items"]:
        assert "visit_notes" not in visit and visit["appointment_notes"] == "allowed"
        assert visit["products"][0]["usage_type"] == "USED" and len(visit["products"]) == 1
        assert visit["services"][0]["name"] == "Historical cut"
    assert (
        client.get("/clients/" + a["id"], headers=headers(sign(staff))).json()[
            "last_completed_visit"
        ]
        == restricted["items"][0]
    )
