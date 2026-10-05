"""Real signature/claims verification with a local JWKS; DB lookup uses SQLAlchemy."""
import json
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from jwt import PyJWKClient
from jwt.algorithms import ECAlgorithm
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.auth import tokens
from app.core.config import Settings
from app.db.models import AdminMembership, Base, Business, MembershipRole
from app.db.session import get_session
from app.main import app

ISSUER = "https://example.supabase.co/auth/v1"


@pytest.fixture(scope="module")
def signing():
    private = ec.generate_private_key(ec.SECP256R1())
    public = json.loads(ECAlgorithm.to_jwk(private.public_key()))
    public.update(kid="test-key", alg="ES256", use="sig")
    document = json.dumps({"keys": [public]}).encode()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(document)

        def log_message(self, *args):
            pass

    # Loopback HTTP JWKS verifies PyJWKClient's fetch/signature wiring, no Supabase secrets.
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield private, f"http://127.0.0.1:{server.server_port}/jwks"
    server.shutdown()
    server.server_close()
    thread.join()


@pytest.fixture
def auth_client(monkeypatch, signing):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    def initialize_sqlite(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
        connection.create_function("now", 0, lambda: datetime.now(timezone.utc).isoformat())
    event.listen(engine, "connect", initialize_sqlite)
    Base.metadata.create_all(engine)
    private, url = signing
    monkeypatch.setattr(tokens, "get_settings", lambda: Settings(_env_file=None, supabase_url="https://example.supabase.co"))
    monkeypatch.setattr(tokens, "get_jwks_client", lambda: PyJWKClient(url))
    owner, staff, outsider = uuid4(), uuid4(), uuid4()
    business_id = uuid4()
    with Session(engine) as session:
        session.add(Business(id=business_id, name="Auth test", timezone="Europe/Rome", currency="EUR"))
        session.flush()
        session.add_all([AdminMembership(business_id=business_id, auth_user_id=owner, role=MembershipRole.OWNER),
                         AdminMembership(business_id=business_id, auth_user_id=staff, role=MembershipRole.STAFF)])
        session.commit()

    def database_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = database_session

    def sign(user=owner, key=private, omit=(), **claims):
        now = datetime.now(timezone.utc)
        payload = {"sub": str(user), "iss": ISSUER, "aud": "authenticated", "iat": now,
                   "exp": now + timedelta(minutes=10)}
        payload.update(claims)
        for field in omit:
            payload.pop(field, None)
        return jwt.encode(payload, key, algorithm="ES256", headers={"kid": "test-key"})

    with TestClient(app) as client:
        yield client, sign, owner, staff, outsider, business_id, engine
    app.dependency_overrides.clear()
    engine.dispose()


def headers(token):
    return {"Authorization": "Bearer " + token}


@pytest.mark.parametrize("path,method", [("/auth/me", "get"), ("/auth/test-read", "get"), ("/auth/test-owner", "post"), ("/auth/test-client-visibility", "get")])
def test_missing_token(auth_client, path, method):
    response = getattr(auth_client[0], method)(path)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("case", ["malformed", "expired", "signature", "issuer", "audience", "subject", "missing_exp", "missing_sub", "future_nbf", "unsigned", "symmetric"])
def test_invalid_tokens(auth_client, case):
    client, sign, *_ = auth_client
    if case == "malformed": token = "bad.token"
    elif case == "expired": token = sign(exp=datetime.now(timezone.utc) - timedelta(minutes=1))
    elif case == "signature": token = sign(key=ec.generate_private_key(ec.SECP256R1()))
    elif case == "issuer": token = sign(iss="https://attacker.test/auth/v1")
    elif case == "audience": token = sign(aud="service_role")
    elif case == "subject": token = sign(sub="not-a-uuid")
    elif case in ("missing_exp", "missing_sub"):
        token = sign(omit=(case.removeprefix("missing_"),))
    elif case == "future_nbf": token = sign(nbf=datetime.now(timezone.utc) + timedelta(minutes=5))
    elif case == "unsigned": token = jwt.encode({"sub": str(uuid4())}, None, algorithm="none")
    else: token = jwt.encode({"sub": str(uuid4())}, "not-a-valid-asymmetric-key-0123456789", algorithm="HS256")
    response = client.get("/auth/me", headers=headers(token))
    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required or token invalid"}


@pytest.mark.parametrize("role", ["OWNER", "STAFF"])
def test_member_and_read(auth_client, role):
    client, sign, owner, staff, _, business_id, _ = auth_client
    user = owner if role == "OWNER" else staff
    token = sign(user, business_id=str(uuid4()), role="OWNER", user_metadata={"role":"OWNER"})
    response = client.get("/auth/me?business_id=" + str(uuid4()) + "&role=OWNER", headers={**headers(token), "X-Business-ID":str(uuid4()), "X-Role":"OWNER"})
    assert response.status_code == 200
    assert response.json()["auth_user_id"] == str(user)
    assert response.json()["business_id"] == str(business_id)
    assert response.json()["role"] == role
    assert client.get("/auth/test-read", headers=headers(token)).status_code == 200
    assert client.post("/auth/test-owner", headers=headers(token), json={"role":"OWNER", "business_id":str(uuid4())}).status_code == (200 if role == "OWNER" else 403)


def test_no_membership(auth_client):
    client, sign, _, _, outsider, *_ = auth_client
    assert client.get("/auth/me", headers=headers(sign(outsider))).status_code == 403
    assert client.post("/auth/test-owner", headers=headers(sign(outsider))).status_code == 403


def test_ambiguous_membership_denied(auth_client):
    client, sign, owner, *_, engine = auth_client
    with Session(engine) as session:
        other = Business(name="Other", timezone="Europe/Rome", currency="EUR")
        session.add(other); session.flush()
        session.add(AdminMembership(business_id=other.id, auth_user_id=owner, role=MembershipRole.OWNER))
        session.commit()
    assert client.get("/auth/me", headers=headers(sign())).status_code == 403


@pytest.mark.parametrize("role", ["OWNER", "STAFF"])
def test_field_visibility(auth_client, role):
    client, sign, owner, staff, *_ = auth_client
    response = client.get("/auth/test-client-visibility", headers=headers(sign(owner if role == "OWNER" else staff)))
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Sample Client"
    visit = data["appointment_history"][0]
    assert visit["services"] == ["Haircut"]
    assert visit["products_used"] == ["Pomade"]
    assert visit["appointment_notes"]
    for field in ("email", "phone", "private_notes", "visit_notes"):
        assert (field in data) == (role == "OWNER")
    assert ("visit_notes" in visit) == (role == "OWNER")


def test_cors_authorization_preflight(auth_client):
    from app.core.config import get_settings
    response = auth_client[0].options("/auth/test-owner", headers={"Origin":str(get_settings().frontend_origin).rstrip("/"), "Access-Control-Request-Method":"POST", "Access-Control-Request-Headers":"authorization"})
    assert response.status_code == 200
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_jwks_outage_is_service_error(auth_client, monkeypatch):
    from jwt.exceptions import PyJWKClientConnectionError
    def unavailable():
        raise PyJWKClientConnectionError("Private transport details")
    monkeypatch.setattr(tokens, "get_jwks_client", unavailable)
    client, sign, *_ = auth_client
    response = client.get("/auth/me", headers=headers(sign()))
    assert response.status_code == 503
    assert response.json() == {"detail":"Authentication service unavailable"}


def test_missing_auth_configuration(auth_client, monkeypatch):
    monkeypatch.setattr(tokens, "get_settings", lambda: Settings(_env_file=None, supabase_url=None))
    client, sign, *_ = auth_client
    assert client.get("/health").status_code == 200
    assert client.get("/auth/me", headers=headers(sign())).status_code == 503
