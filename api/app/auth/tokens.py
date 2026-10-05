"""Verify Supabase access tokens using configured public signing keys."""
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import HTTPException
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError, PyJWTError, PyJWKClientConnectionError

from app.core.config import get_settings


def unauthorized():
    return HTTPException(401, "Authentication required or token invalid", headers={"WWW-Authenticate": "Bearer"})


@lru_cache
def get_jwks_client():
    url = get_settings().supabase_url
    if url is None:
        raise HTTPException(503, "Authentication is not configured")
    return PyJWKClient(str(url).rstrip("/") + "/auth/v1/.well-known/jwks.json", lifespan=300, timeout=10)


def validate_access_token(token: str) -> UUID:
    settings = get_settings()
    if settings.supabase_url is None:
        raise HTTPException(503, "Authentication is not configured")
    try:
        # Do not accept symmetric secrets, unsigned tokens, or token-supplied URLs.
        if jwt.get_unverified_header(token).get("alg") not in ("ES256", "RS256"):
            raise InvalidTokenError()
        key = get_jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token, key.key, algorithms=["ES256", "RS256"],
            issuer=str(settings.supabase_url).rstrip("/") + "/auth/v1",
            audience=settings.supabase_jwt_audience,
            options={"require": ["exp", "iss", "aud", "sub"], "strict_aud": True},
        )
        return UUID(claims["sub"])
    except PyJWKClientConnectionError:
        raise HTTPException(503, "Authentication service unavailable") from None
    except (PyJWTError, ValueError, TypeError, AttributeError):
        raise unauthorized() from None
