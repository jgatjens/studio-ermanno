from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
import pytest
from sqlalchemy.orm import Session
from app.db.models import Business, Client, Appointment, Feedback
from test_auth import auth_client, signing, headers


def add_client(client, sign):
    response = client.post(
        "/clients", json={"first_name": "Delete", "last_name": "Test"}, headers=headers(sign())
    )
    assert response.status_code == 201
    return response.json()["id"]


@pytest.mark.parametrize(
    "kind, status",
    [("missing", 401), ("invalid", 401), ("expired", 401), ("staff", 403), ("outsider", 403)],
)
def test_delete_requires_owner(auth_client, kind, status):
    client, sign, _, staff, outsider, *_ = auth_client
    identifier = add_client(client, sign)
    token = (
        {}
        if kind == "missing"
        else headers(
            "invalid"
            if kind == "invalid"
            else sign(exp=datetime.now(timezone.utc) - timedelta(minutes=1))
            if kind == "expired"
            else sign(staff if kind == "staff" else outsider)
        )
    )
    assert client.delete("/clients/" + identifier, headers=token).status_code == status
    assert client.get("/clients/" + identifier, headers=headers(sign())).status_code == 200


def test_delete_unlinked_client_and_repeat(auth_client):
    client, sign, *_, engine = auth_client
    identifier = add_client(client, sign)
    response = client.delete("/clients/" + identifier, headers=headers(sign()))
    assert response.status_code == 204 and response.content == b""
    assert client.get("/clients/" + identifier, headers=headers(sign())).status_code == 404
    assert client.delete("/clients/" + identifier, headers=headers(sign())).status_code == 404
    with Session(engine) as session:
        assert session.get(Client, UUID(identifier)) is None


def test_delete_business_isolation(auth_client):
    client, sign, *_, engine = auth_client
    with Session(engine) as session:
        business = Business(name="Other", timezone="Europe/Rome", currency="EUR")
        session.add(business)
        session.flush()
        record = Client(business_id=business.id, first_name="Foreign", last_name="Client")
        session.add(record)
        session.commit()
        identifier = record.id
    assert client.delete("/clients/" + str(identifier), headers=headers(sign())).status_code == 404
    with Session(engine) as session:
        assert session.get(Client, identifier) is not None


@pytest.mark.parametrize("status", ["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"])
def test_delete_preserves_all_appointment_statuses(auth_client, status):
    client, sign, _, _, _, business_id, engine = auth_client
    identifier = add_client(client, sign)
    with Session(engine) as session:
        start = datetime(2026, 1, 1, 10, tzinfo=timezone.utc)
        record = Appointment(
            business_id=business_id,
            client_id=UUID(identifier),
            scheduled_start=start,
            scheduled_end=start + timedelta(minutes=30),
            status=status,
            calculated_duration_minutes=30,
            final_duration_minutes=30,
            calculated_price=20,
            final_price=20,
        )
        session.add(record)
        session.commit()
        appointment_id = record.id
    assert client.delete("/clients/" + identifier, headers=headers(sign())).status_code == 409
    with Session(engine) as session:
        assert session.get(Client, UUID(identifier)) is not None
        assert session.get(Appointment, appointment_id).client_id == UUID(identifier)


def test_delete_preserves_linked_feedback(auth_client):
    client, sign, _, _, _, business_id, engine = auth_client
    identifier = add_client(client, sign)
    with Session(engine) as session:
        record = Feedback(
            business_id=business_id, client_id=UUID(identifier), name="Test", rating=5
        )
        session.add(record)
        session.commit()
        feedback_id = record.id
    assert client.delete("/clients/" + identifier, headers=headers(sign())).status_code == 409
    with Session(engine) as session:
        assert session.get(Client, UUID(identifier)) is not None
        assert session.get(Feedback, feedback_id).client_id == UUID(identifier)
