"""Private application-schema backup using native PostgreSQL client tools.

Run from api/. Does not include Supabase-managed Auth identities or settings.
"""

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.config import get_settings
from sqlalchemy.engine import make_url


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--pg-dump", default=shutil.which("pg_dump"))
    args = parser.parse_args()
    if not args.pg_dump:
        parser.error("Provide --pg-dump with the native PostgreSQL client path")
    settings = get_settings()
    if not settings.database_url:
        parser.error("DATABASE_URL is required")
    url = make_url(settings.database_url.get_secret_value())
    environment = dict(
        os.environ,
        PGHOST=url.host,
        PGPORT=str(url.port or 5432),
        PGUSER=url.username or "",
        PGPASSWORD=url.password or "",
        PGDATABASE=url.database,
        PGSSLMODE=url.query.get("sslmode", "require"),
    )
    # Exclusive creation prevents overwriting an existing backup or other file.
    with args.output.open("xb"):
        args.output.chmod(0o600)
    try:
        result = subprocess.run(
            [
                args.pg_dump,
                "--format=custom",
                "--column-inserts",
                "--schema=public",
                "--no-owner",
                "--no-acl",
                "--file",
                str(args.output),
            ],
            env=environment,
            capture_output=True,
            timeout=120,
        )
    except (OSError, subprocess.TimeoutExpired):
        args.output.unlink()
        raise SystemExit(
            "Database backup could not finish; check the native client and connectivity."
        ) from None
    if result.returncode:
        args.output.unlink()
        raise SystemExit(
            "Database backup failed; check client version and connectivity. Credentials were not logged."
        )
    print(f"Private application backup saved: {args.output}")


if __name__ == "__main__":
    main()
