import json
from uuid import uuid4
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.exc import StatementError

from app.core.config import Settings
from app.core.request_logging import SafeRequestLogging, logger
from app.main import app


def production_settings(**overrides):
    values = dict(
        app_env="production",
        database_url="postgresql://user:password@db.example.test/database?sslmode=require",
        frontend_origin="https://business.pages.dev",
        supabase_url="https://project.supabase.co",
        public_business_id=uuid4(),
    )
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_production_configuration():
    assert production_settings().database_pool_size == 2
    for overrides in (
        {"database_url": None},
        {"public_business_id": None},
        {"supabase_url": None},
        {"frontend_origin": "http://localhost:5173"},
        {"supabase_url": "http://auth.example.test"},
        {"database_url": "postgresql://user:password@db.example.test/database"},
        {"database_pool_size": 0},
        {"database_max_overflow": -1},
    ):
        with pytest.raises(ValidationError):
            production_settings(**overrides)


def test_engine_pool_and_parameter_hiding(monkeypatch):
    from app.db import session

    with (
        patch.object(session, "get_settings", return_value=production_settings()),
        patch.object(session, "create_engine") as create,
    ):
        session.get_engine.cache_clear()
        try:
            session.get_engine()
            kwargs = create.call_args.kwargs
            assert kwargs["pool_size"] == 2 and kwargs["max_overflow"] == 1
            assert kwargs["hide_parameters"] is True and kwargs["pool_pre_ping"] is True
        finally:
            session.get_engine.cache_clear()
    engine = create_engine("sqlite://", hide_parameters=True)
    with engine.connect() as connection, pytest.raises(StatementError) as failure:
        connection.execute(text("SELECT :value"), {"value": object()})
    assert "SQL parameters hidden" in str(failure.value)
    engine.dispose()


def test_logs_omit_query_headers_body_and_dynamic_path():
    test_app = FastAPI()
    test_app.add_middleware(SafeRequestLogging)

    @test_app.post("/clients/{client_id}")
    def fail(client_id: str):
        raise ValueError("secret-db-password private-note")

    with patch.object(logger, "info") as logged, TestClient(test_app) as client:
        response = client.post(
            "/clients/private-id?q=private-email",
            headers={"Authorization": "Bearer private-token", "X-Request-ID": "untrusted-id"},
            json={"notes": "private-note"},
        )
        assert response.status_code == 500
        assert response.json() == {"detail": "Internal server error"}
        record = json.loads(logged.call_args.args[0])
        assert record["route"] == "/clients/{client_id}"
        assert record["status"] == 500 and record["error_type"] == "ValueError"
        assert response.headers["x-request-id"] == record["request_id"]
        assert all(
            value not in logged.call_args.args[0]
            for value in (
                "private-id",
                "private-email",
                "private-note",
                "private-token",
                "secret-db-password",
                "untrusted-id",
            )
        )


def test_unknown_routes_and_health_logging():
    with patch.object(logger, "info") as logged, TestClient(app) as client:
        assert client.get("/health?secret=hidden").json() == {"status": "ok"}
        assert json.loads(logged.call_args.args[0])["route"] == "/health"
        assert client.get("/private-unknown-path").status_code == 404
        assert json.loads(logged.call_args.args[0])["route"] == "unmatched"


def test_startup_configuration_error_does_not_expose_secret():
    from app.core import config

    with pytest.raises(ValidationError) as error:
        production_settings(database_url="postgresql://user:private-password@db.test/database")
    config.get_settings.cache_clear()
    try:
        with (
            patch.object(config, "Settings", side_effect=error.value),
            pytest.raises(RuntimeError) as failure,
        ):
            config.get_settings()
        assert "private-password" not in str(failure.value)
        assert failure.value.__suppress_context__ is True
    finally:
        config.get_settings.cache_clear()


def test_explicit_environment_file_preserves_development_file(tmp_path, monkeypatch):
    from app.core.config import get_settings

    selected = tmp_path / ".env.production"
    selected.write_text("APP_ENV=test\nFRONTEND_ORIGIN=https://selected.example.test\n")
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("FRONTEND_ORIGIN", raising=False)
    monkeypatch.setenv("APP_ENV_FILE", str(selected))
    get_settings.cache_clear()
    try:
        assert str(get_settings().frontend_origin) == "https://selected.example.test/"
        assert get_settings().app_env == "test"
    finally:
        get_settings.cache_clear()


def test_missing_selected_environment_file_does_not_fall_back(tmp_path, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setenv("APP_ENV_FILE", str(tmp_path / "missing.env"))
    get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="existing configuration file"):
            get_settings()
    finally:
        get_settings.cache_clear()
