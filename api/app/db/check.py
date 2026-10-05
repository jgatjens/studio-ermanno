"""Read-only database connectivity check: python -m app.db.check."""

from sqlalchemy import text
from app.db.session import get_engine


def main():
    try:
        with get_engine().connect() as connection:
            if connection.scalar(text("SELECT 1")) != 1:
                raise RuntimeError()
    except Exception:
        raise SystemExit(
            "Database connectivity failed. Check DATABASE_URL and network access."
        ) from None
    print("Database connectivity: OK")


if __name__ == "__main__":
    main()
