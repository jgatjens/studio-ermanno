from uuid import uuid4
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.models import Business, Service, Barber, BusinessHours

# Reuse the signature/JWKS/membership fixture; no authorization bypass.
from test_auth import auth_client, signing, headers


@pytest.mark.parametrize("resource", ["services", "barbers", "business-hours"])
def test_protected_lists(auth_client, resource):
    client, sign, _, staff, *_ = auth_client
    assert client.get("/" + resource).status_code == 401
    assert client.get("/" + resource, headers=headers(sign(staff))).status_code == 200


@pytest.mark.parametrize("resource", ["services", "barbers"])
def test_catalog_creation_edits_inactive_and_isolation(auth_client, resource):
    client, sign, owner, staff, _, business_id, engine = auth_client
    data = {"name": "Sample", "is_active": True}
    if resource == "services":
        data.update(description="Description", duration_minutes=30, price="25.00")
    assert client.post("/" + resource, json=data, headers=headers(sign(staff))).status_code == 403
    created = client.post("/" + resource, json=data, headers=headers(sign(owner)))
    assert created.status_code == 201
    value = created.json()
    identifier = value["id"]
    assert (
        client.put(
            "/" + resource + "/" + identifier, json=data, headers=headers(sign(staff))
        ).status_code
        == 403
    )
    data.update(name="Changed", is_active=False)
    assert (
        client.put(
            "/" + resource + "/" + identifier, json=data, headers=headers(sign(owner))
        ).status_code
        == 200
    )
    assert client.get("/" + resource + "?active=true", headers=headers(sign())).json() == []
    assert len(client.get("/" + resource, headers=headers(sign())).json()) == 1
    model = Service if resource == "services" else Barber
    with Session(engine) as session:
        other = Business(name="Other", timezone="Europe/Rome", currency="EUR")
        session.add(other)
        session.flush()
        foreign = model(
            business_id=other.id,
            name="Foreign",
            **({"duration_minutes": 20, "price": 10} if resource == "services" else {}),
        )
        session.add(foreign)
        session.commit()
        foreign_id = foreign.id
        assert (
            session.scalar(select(model).where(model.id == foreign.id)).business_id != business_id
        )
    assert len(client.get("/" + resource, headers=headers(sign())).json()) == 1
    assert (
        client.put(
            "/" + resource + "/" + str(foreign_id), json=data, headers=headers(sign())
        ).status_code
        == 404
    )
    assert (
        client.delete("/" + resource + "/" + identifier, headers=headers(sign())).status_code == 405
    )


@pytest.mark.parametrize(
    "patch",
    [
        {"name": "  "},
        {"price": "-1"},
        {"price": "1.001"},
        {"duration_minutes": 0},
        {"duration_minutes": 1.5},
        {"business_id": str(uuid4())},
    ],
)
def test_service_validation(auth_client, patch):
    data = {"name": "Haircut", "duration_minutes": 30, "price": "25.00", **patch}
    client, sign, *_ = auth_client
    assert client.post("/services", json=data, headers=headers(sign())).status_code == 422


def test_weekly_hours_atomic_owner_update(auth_client):
    client, sign, _, staff, *_ = auth_client
    days = [
        {"day_of_week": i, "is_closed": i == 6, "opening_time": "09:00", "closing_time": "18:00"}
        for i in range(7)
    ]
    assert (
        client.put("/business-hours", json={"days": days}, headers=headers(sign(staff))).status_code
        == 403
    )
    response = client.put("/business-hours", json={"days": days}, headers=headers(sign()))
    assert response.status_code == 200
    assert response.json()[6]["opening_time"] is None
    baseline = client.get("/business-hours", headers=headers(sign())).json()
    days[0]["closing_time"] = "08:00"
    assert (
        client.put("/business-hours", json={"days": days}, headers=headers(sign())).status_code
        == 422
    )
    assert client.get("/business-hours", headers=headers(sign())).json() == baseline
    days[0]["closing_time"] = "18:00"
    days[6]["day_of_week"] = 0
    assert (
        client.put("/business-hours", json={"days": days}, headers=headers(sign())).status_code
        == 422
    )
    assert (
        client.put("/business-hours", json={"days": days[:6]}, headers=headers(sign())).status_code
        == 422
    )
