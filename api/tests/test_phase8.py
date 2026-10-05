from uuid import uuid4, UUID
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.core.config import Settings
from app.db.models import Business, Feedback, FeedbackStatus
from app.feedback import service
from test_auth import auth_client, signing, headers

DATA = dict(name=" Visitor ", email=" visitor@example.com ", rating=5, comment=" Great service ")


@pytest.fixture
def feedback_case(auth_client, monkeypatch):
    monkeypatch.setattr(
        service, "get_settings", lambda: Settings(_env_file=None, public_business_id=auth_client[5])
    )
    return auth_client


def submitted(case, **patch):
    response = case[0].post("/public/feedback", json={**DATA, **patch})
    assert response.status_code == 201, response.text
    with Session(case[-1]) as session:
        identifier = session.scalar(
            select(Feedback.id).order_by(Feedback.created_at.desc(), Feedback.id.desc())
        )
    return str(identifier)


def moderate(case, identifier, **patch):
    return case[0].put(
        "/feedback/" + identifier + "/moderation",
        json={**dict(status="APPROVED", is_public=False), **patch},
        headers=headers(case[1]()),
    )


def test_anonymous_submission_defaults_and_owner_staff_privacy(feedback_case):
    client, sign, _, staff, _, business, engine = feedback_case
    response = client.post("/public/feedback", json=DATA)
    assert response.status_code == 201 and response.json() == {"status": "received"}
    assert client.get("/public/feedback").json()["total"] == 0
    with Session(engine) as session:
        row = session.scalar(select(Feedback))
        identifier = str(row.id)
        assert (
            row.business_id == business
            and row.status == FeedbackStatus.PENDING
            and not row.is_public
        )
        assert row.client_id is None and row.appointment_id is None
        assert (
            row.name == "Visitor"
            and row.email == "visitor@example.com"
            and row.comment == "Great service"
        )
    owner = client.get("/feedback/" + identifier, headers=headers(sign())).json()
    assert owner["email"] == "visitor@example.com"
    for path in ["/feedback", "/feedback/" + identifier]:
        data = client.get(path, headers=headers(sign(staff))).json()
        for row in data.get("items", [data]):
            assert "email" not in row and row["name"] == "Visitor"
    assert (
        client.put(
            "/feedback/" + identifier + "/moderation",
            json=dict(status="APPROVED", is_public=True),
            headers=headers(sign(staff)),
        ).status_code
        == 403
    )
    assert (
        client.put(
            "/feedback/" + str(uuid4()) + "/moderation",
            json=dict(status="APPROVED", is_public=True),
            headers=headers(sign(staff)),
        ).status_code
        == 403
    )


@pytest.mark.parametrize(
    "patch",
    [
        {"name": " "},
        {"name": "x" * 201},
        {"comment": ""},
        {"comment": " "},
        {"comment": "x" * 10001},
        {"rating": 0},
        {"rating": 6},
        {"rating": 1.5},
        {"rating": True},
        {"rating": "5"},
        {"email": "bad"},
        {"email": "x" * 321},
        {"business_id": str(uuid4())},
        {"client_id": str(uuid4())},
        {"appointment_id": str(uuid4())},
        {"status": "APPROVED"},
        {"is_public": True},
        {"id": str(uuid4())},
        {"role": "OWNER"},
    ],
)
def test_submission_validation_and_ownership(feedback_case, patch):
    assert feedback_case[0].post("/public/feedback", json={**DATA, **patch}).status_code == 422
    with Session(feedback_case[-1]) as session:
        assert session.scalar(select(func.count()).select_from(Feedback)) == 0


@pytest.mark.parametrize("email", [None, "", "   "])
def test_optional_email(feedback_case, email):
    identifier = submitted(feedback_case, email=email)
    assert (
        feedback_case[0]
        .get("/feedback/" + identifier, headers=headers(feedback_case[1]()))
        .json()["email"]
        is None
    )


@pytest.mark.parametrize("identifier", [None, "foreign"])
def test_missing_or_unavailable_public_config(feedback_case, monkeypatch, identifier):
    monkeypatch.setattr(
        service,
        "get_settings",
        lambda: Settings(
            _env_file=None, public_business_id=None if identifier is None else uuid4()
        ),
    )
    for response in [
        feedback_case[0].get("/public/feedback"),
        feedback_case[0].post("/public/feedback", json=DATA),
    ]:
        assert (
            response.status_code == 503
            and response.json()["detail"] == "Public feedback is not configured"
        )
    assert feedback_case[0].get("/feedback", headers=headers(feedback_case[1]())).status_code == 200


@pytest.mark.parametrize("case", ["missing", "invalid", "expired", "outsider"])
def test_admin_authentication(feedback_case, case):
    client, sign, _, _, outsider, *_ = feedback_case
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
    for path in ["/feedback", "/feedback/" + str(uuid4())]:
        assert client.get(path, headers=auth).status_code == (403 if case == "outsider" else 401)
    assert client.put(
        "/feedback/" + str(uuid4()) + "/moderation",
        json=dict(status="APPROVED", is_public=True),
        headers=auth,
    ).status_code == (403 if case == "outsider" else 401)


def test_approval_separate_publication_and_rejection(feedback_case):
    client, sign, *_ = feedback_case
    identifier = submitted(feedback_case)
    assert moderate(feedback_case, identifier).status_code == 200
    assert client.get("/public/feedback").json()["total"] == 0
    assert moderate(feedback_case, identifier, is_public=True).status_code == 200
    public = client.get("/public/feedback").json()
    assert public["total"] == 1
    assert set(public["items"][0]) == {"name", "rating", "comment", "created_at"}
    assert public["items"][0]["comment"] == "Great service"
    assert moderate(feedback_case, identifier, is_public=True).status_code == 200
    assert client.get("/public/feedback").json()["total"] == 1
    assert (
        moderate(feedback_case, identifier, status="REJECTED", is_public=False).status_code == 200
    )
    assert client.get("/public/feedback").json()["total"] == 0
    assert moderate(feedback_case, identifier, status="PENDING", is_public=False).status_code == 200
    original = client.get("/feedback/" + identifier, headers=headers(sign())).json()
    assert (
        original["name"] == "Visitor"
        and original["comment"] == "Great service"
        and original["email"] == "visitor@example.com"
    )


@pytest.mark.parametrize(
    "patch",
    [
        {"status": "PENDING", "is_public": True},
        {"status": "REJECTED", "is_public": True},
        {"status": "BOGUS"},
        {"comment": "Rewrite"},
        {"email": "changed@example.com"},
        {"business_id": str(uuid4())},
        {"role": "OWNER"},
        {"is_public": None},
    ],
)
def test_moderation_validation(feedback_case, patch):
    identifier = submitted(feedback_case)
    assert moderate(feedback_case, identifier, **patch).status_code == 422


@pytest.mark.parametrize("status", ["PENDING", "APPROVED", "REJECTED"])
@pytest.mark.parametrize("is_public", [False, True])
def test_public_intersection_even_for_legacy_invalid_rows(feedback_case, status, is_public):
    with Session(feedback_case[-1]) as session:
        session.add(
            Feedback(
                business_id=feedback_case[5],
                name="Legacy",
                email="secret@example.com",
                rating=3,
                comment="Comment",
                status=status,
                is_public=is_public,
            )
        )
        session.commit()
    assert feedback_case[0].get("/public/feedback").json()["total"] == int(
        status == "APPROVED" and is_public
    )


def test_scoping_filters_and_no_content_edit_or_delete(feedback_case):
    client, sign, _, staff, _, business, engine = feedback_case
    first = submitted(feedback_case)
    moderate(feedback_case, first)
    submitted(feedback_case, name="Second")
    submitted(feedback_case, name="Third")
    with Session(engine) as session:
        other = Business(name="Other", timezone="UTC", currency="EUR")
        session.add(other)
        session.flush()
        row = Feedback(
            business_id=other.id,
            name="Foreign",
            email="secret@example.com",
            rating=5,
            comment="Foreign",
            status="APPROVED",
            is_public=True,
        )
        session.add(row)
        session.commit()
        foreign = str(row.id)
    assert client.get("/public/feedback").json()["total"] == 0
    assert client.get("/feedback?status=PENDING", headers=headers(sign())).json()["total"] == 2
    page = client.get("/feedback?limit=1&offset=1", headers=headers(sign(staff))).json()
    assert page["total"] == 3 and len(page["items"]) == 1
    for identifier in [foreign, str(uuid4())]:
        assert client.get("/feedback/" + identifier, headers=headers(sign())).status_code == 404
        assert moderate(feedback_case, identifier).status_code == 404
    for suffix in ["?limit=0", "?limit=101", "?offset=-1"]:
        for path in ["/public/feedback", "/feedback"]:
            assert client.get(path + suffix, headers=headers(sign())).status_code == 422
    assert client.get("/feedback?status=BOGUS", headers=headers(sign())).status_code == 422
    assert client.delete("/feedback/" + first, headers=headers(sign())).status_code == 405
    assert client.put("/feedback/" + first, json=DATA, headers=headers(sign())).status_code == 405


def test_public_business_config_validation():
    assert Settings(_env_file=None, public_business_id="").public_business_id is None
    with pytest.raises(ValueError):
        Settings(_env_file=None, public_business_id="invalid")
