import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from app.core.config import Settings


def test_both_domains_allowed_and_unknown_domain_rejected(monkeypatch):
    monkeypatch.setenv(
        "FRONTEND_ORIGINS", '["https://studio-ermanno.pages.dev","https://iminatiparrucchieri.com"]'
    )
    settings = Settings(_env_file=None, frontend_origin="https://studio-ermanno.pages.dev")
    assert len(settings.cors_origins) == 2
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["Authorization"],
    )
    with TestClient(app) as client:
        for origin in settings.cors_origins:
            response = client.options(
                "/auth/me",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": "authorization",
                },
            )
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == origin
        assert (
            client.options(
                "/auth/me",
                headers={
                    "Origin": "https://unknown.example",
                    "Access-Control-Request-Method": "GET",
                },
            ).status_code
            == 400
        )


@pytest.mark.parametrize(
    "url",
    [
        "*",
        "https://example.com/login",
        "https://user:password@example.com",
        "https://example.com?x=1",
    ],
)
def test_invalid_extra_origin_rejected(url):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, frontend_origins=[url])
