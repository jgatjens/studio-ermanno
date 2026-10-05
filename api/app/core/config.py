from uuid import UUID
import os
from functools import lru_cache
from typing import Literal, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import AnyHttpUrl, SecretStr, Field, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    app_env: Literal["development", "test", "production"] = "development"
    supabase_url: Optional[AnyHttpUrl] = None
    supabase_jwt_audience: str = "authenticated"
    public_business_id: Optional[UUID] = None
    seed_timezone: str = "Europe/Rome"
    database_url: Optional[SecretStr] = None
    frontend_origin: AnyHttpUrl = "http://localhost:5173"
    database_pool_size: int = Field(default=2, ge=1, le=10)
    database_max_overflow: int = Field(default=1, ge=0, le=10)

    @model_validator(mode="after")
    def validate_production(self):
        if self.app_env != "production":
            return self
        if not self.database_url or not self.supabase_url or not self.public_business_id:
            raise ValueError(
                "Production requires DATABASE_URL, SUPABASE_URL and PUBLIC_BUSINESS_ID"
            )
        for origin in (self.frontend_origin, self.supabase_url):
            if origin.scheme != "https" or origin.host in ("localhost", "127.0.0.1", "::1"):
                raise ValueError("Production origins must use public HTTPS URLs")
        url = make_url(self.database_url.get_secret_value())
        if url.query.get("sslmode") not in ("require", "verify-ca", "verify-full"):
            raise ValueError("Production DATABASE_URL must explicitly enable TLS with sslmode")
        return self

    @field_validator("public_business_id", mode="before")
    @classmethod
    def empty_public_business(cls, value):
        return None if value == "" else value

    @field_validator("supabase_url", mode="before")
    @classmethod
    def empty_supabase_url(cls, value):
        return None if value == "" else value

    @field_validator("supabase_url")
    @classmethod
    def validate_supabase_url(cls, value):
        if value and (
            value.path not in (None, "/")
            or value.query
            or value.fragment
            or value.username
            or value.password
        ):
            raise ValueError("SUPABASE_URL must be an HTTP origin")
        return value

    @field_validator("supabase_jwt_audience")
    @classmethod
    def validate_audience(cls, value):
        if not value.strip():
            raise ValueError("SUPABASE_JWT_AUDIENCE cannot be empty")
        return value

    @field_validator("seed_timezone")
    @classmethod
    def validate_seed_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("SEED_TIMEZONE must be a valid IANA timezone") from None
        return value

    @field_validator("database_url", mode="before")
    @classmethod
    def validate_database_url(cls, value):
        if value is None or value == "":
            return None
        raw = value.get_secret_value() if isinstance(value, SecretStr) else value
        try:
            url = make_url(raw)
            if (
                url.drivername not in ("postgresql", "postgresql+psycopg")
                or not url.host
                or not url.database
            ):
                raise ValueError()
        except Exception:
            raise ValueError("DATABASE_URL must be a PostgreSQL connection URL") from None
        return raw

    @field_validator("frontend_origin")
    @classmethod
    def validate_origin(cls, value):
        if (
            value.path not in (None, "/")
            or value.query
            or value.fragment
            or value.username
            or value.password
        ):
            raise ValueError("FRONTEND_ORIGIN must be an HTTP origin without credentials or a path")
        return value


@lru_cache
def get_settings() -> Settings:
    selected_file = os.environ.get("APP_ENV_FILE")
    if selected_file is not None and not os.path.isfile(selected_file):
        raise RuntimeError("APP_ENV_FILE must name an existing configuration file")
    try:
        return Settings(_env_file=selected_file if selected_file is not None else ".env")
    except ValidationError:
        # Pydantic errors can include raw input values, including connection URLs.
        raise RuntimeError(
            "Invalid application configuration; review environment settings"
        ) from None
