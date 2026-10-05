import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.core.config import Settings, get_settings
from app.db.session import get_engine, get_session_factory, get_session
from app.main import app


def test_app_and_health():
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_configuration(monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGIN", "http://localhost:5173")
    assert str(Settings(_env_file=None).frontend_origin) == "http://localhost:5173/"
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url="sqlite:///test.db")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, frontend_origin="*")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env="invalid")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, seed_timezone="Invalid/Timezone")
    assert Settings(_env_file=None, supabase_url="").supabase_url is None
    with pytest.raises(ValidationError):
        Settings(_env_file=None, supabase_url="https://example.test/untrusted-path")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, supabase_jwt_audience="")


def test_database_configuration(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    engine = get_engine()
    try:
        assert engine.dialect.name == "postgresql"
        assert engine.dialect.driver == "psycopg"
        assert get_session_factory().kw["bind"] is engine
        sessions = get_session()
        session = next(sessions)
        assert session.bind is engine
        sessions.close()
    finally:
        engine.dispose()
        get_session_factory.cache_clear()
        get_engine.cache_clear()
        get_settings.cache_clear()


def test_cors():
    with TestClient(app) as client:
        response = client.options(
            "/health",
            headers={
                "Origin": str(get_settings().frontend_origin).rstrip("/"),
                "Access-Control-Request-Method": "GET",
            },
        )
        denied = client.options(
            "/health",
            headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "GET"},
        )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == str(
        get_settings().frontend_origin
    ).rstrip("/")
    assert "access-control-allow-origin" not in denied.headers
