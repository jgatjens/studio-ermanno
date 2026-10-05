from functools import lru_cache
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


@lru_cache
def get_engine():
    configured = get_settings().database_url
    if configured is None:
        raise RuntimeError("Set DATABASE_URL before using the database")
    from sqlalchemy.engine import make_url

    url = make_url(configured.get_secret_value()).set(drivername="postgresql+psycopg")
    settings = get_settings()
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        hide_parameters=True,
        connect_args={"connect_timeout": 10},
    )


@lru_cache
def get_session_factory():
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_session():
    with get_session_factory()() as session:
        yield session
