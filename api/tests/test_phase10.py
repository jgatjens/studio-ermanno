from datetime import time
from uuid import uuid4
import pytest
from sqlalchemy.orm import Session
from app.core.config import Settings
from app.db.models import Business, BusinessHours, Product, Service
from app.public import router
from test_auth import auth_client, signing, headers


@pytest.fixture
def website(auth_client, monkeypatch):
    monkeypatch.setattr(
        router, "get_settings", lambda: Settings(_env_file=None, public_business_id=auth_client[5])
    )
    return auth_client


def test_business_projection_and_missing_hours(website):
    with Session(website[-1]) as session:
        session.add(
            BusinessHours(
                business_id=website[5],
                day_of_week=0,
                opening_time=time(9),
                closing_time=time(17),
                is_closed=False,
            )
        )
        session.commit()
    response = website[0].get("/public/business")
    data = response.json()
    assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
    assert set(data) == {
        "name",
        "description",
        "address",
        "phone",
        "email",
        "whatsapp",
        "instagram",
        "timezone",
        "currency",
        "hours",
    }
    assert [hour["day_of_week"] for hour in data["hours"]] == list(range(7))
    assert data["hours"][0]["opening_time"] == "09:00:00"
    assert all(
        h["is_closed"] and h["opening_time"] is None and h["closing_time"] is None
        for h in data["hours"][1:]
    )


@pytest.mark.parametrize("configured", [False, True])
def test_configuration_failure(website, monkeypatch, configured):
    monkeypatch.setattr(
        router,
        "get_settings",
        lambda: Settings(_env_file=None, public_business_id=uuid4() if configured else None),
    )
    for path in ["business", "services", "products"]:
        assert website[0].get("/public/" + path).status_code == 503


@pytest.mark.parametrize("resource", ["services", "products"])
def test_catalog_scope_filters_pagination_projection_and_visibility(website, resource):
    client, sign, _, staff, _, business, engine = website
    model = Service if resource == "services" else Product
    with Session(engine) as session:
        other = Business(name="Foreign", timezone="UTC", currency="USD")
        session.add(other)
        session.flush()
        foreign_id = other.id
        for name, active, public, tenant in [
            ("B", True, True, business),
            ("A", True, True, business),
            ("Inactive", False, True, business),
            ("Private", True, False, business),
            ("Foreign", True, True, other.id),
        ]:
            fields = (
                dict(duration_minutes=30, price="12.50")
                if model is Service
                else dict(
                    retail_price="12.50",
                    cost_price="1.00",
                    current_stock="9",
                    minimum_stock="2",
                    sku="secret-" + name,
                    is_public=public,
                )
            )
            session.add(model(name=name, business_id=tenant, is_active=active, **fields))
        session.commit()
    response = client.get(
        "/public/"
        + resource
        + "?limit=1&offset=1&business_id="
        + str(foreign_id)
        + "&role=OWNER&is_active=false&is_public=false"
    )
    data = response.json()
    assert data["total"] == (3 if model is Service else 2)
    assert data["items"][0]["name"] == "B"
    assert set(data["items"][0]) == (
        {"name", "description", "duration_minutes", "price"}
        if model is Service
        else {"name", "brand", "category", "description", "retail_price"}
    )
    assert data["items"][0]["price" if model is Service else "retail_price"] == "12.50"
    assert response.headers["cache-control"] == "no-store"
    for suffix in ["?limit=0", "?limit=101", "?offset=-1"]:
        assert client.get("/public/" + resource + suffix).status_code == 422
    assert client.post("/public/" + resource, json={}).status_code == 405
    assert client.get("/" + resource).status_code == 401
    assert client.post("/" + resource, json={}, headers=headers(sign(staff))).status_code == 403
    # Existing Owner workflow changes visibility; public reads reflect it without stock edits.
    owner_data = client.get("/" + resource, headers=headers(sign())).json()
    owner_rows = owner_data if model is Service else owner_data["items"]
    identifier = next(row["id"] for row in owner_rows if row["name"] == "A")
    if model is Product:
        original = client.get("/products/" + identifier, headers=headers(sign())).json()
        payload = {
            key: original[key]
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
        payload["is_public"] = False
    else:
        payload = dict(
            name="A", description=None, duration_minutes=30, price="12.50", is_active=False
        )
    assert (
        client.put(
            "/" + resource + "/" + identifier, json=payload, headers=headers(sign())
        ).status_code
        == 200
    )
    assert all(row["name"] != "A" for row in client.get("/public/" + resource).json()["items"])
    if model is Product:
        assert (
            client.get("/products/" + identifier, headers=headers(sign())).json()["current_stock"]
            == original["current_stock"]
        )
