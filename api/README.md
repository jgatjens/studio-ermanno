# API backend

The API is a FastAPI application using PostgreSQL through SQLAlchemy and Alembic. Supabase Auth provides identity; backend membership records determine staff authorization.

## Requirements

- Python 3.9 or later (Python 3.12 or later recommended)
- pip and `venv`
- A Supabase project with PostgreSQL and Auth enabled for data-backed functionality

## Install and configure

From the repository root:

```sh
python3 -m venv api/.venv
api/.venv/bin/python -m pip install -r api/requirements.txt
cp api/.env.example api/.env
```

Edit `api/.env` for your local Supabase development project:

- `DATABASE_URL`: PostgreSQL connection URL. Use a reachable direct or session-pooler connection with TLS (`sslmode=require`); do not use transaction pooling for migrations.
- `SUPABASE_URL`: the Supabase project HTTPS origin, for example `https://your-project.supabase.co`.
- `SUPABASE_JWT_AUDIENCE`: normally `authenticated`.
- `FRONTEND_ORIGIN`: the exact frontend origin, normally `http://localhost:5173`.
- `APP_ENV`: use `development` for local work.
- `PUBLIC_BUSINESS_ID`: set the business UUID when using public feedback or availability functionality that requires it.

Keep `.env` local and private. Do not commit database credentials or other secrets.

## Start the API

From the repository root:

```sh
cd api
.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The interactive API documentation is at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). Check [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) for the health response. The health endpoint can run without a database connection; database-backed features require valid configuration and a migrated database.

## Database setup

Once `DATABASE_URL` points to a development database, run these commands from `api/`:

```sh
.venv/bin/alembic upgrade head
.venv/bin/alembic current
.venv/bin/python -m app.db.check
```

Only run schema changes against the intended development database. Do not use production for local experiments or database tests.

## Tests

From `api/`:

```sh
.venv/bin/python -m pytest
```

Database-backed tests require the additional setup described in the project verification and planning documents under [`../docs/`](../docs/).

## Formatting

Install development tools with `.venv/bin/python -m pip install -r requirements-dev.txt`. Run `make format` to format Python or `make format-check` to check formatting without editing files. `pyproject.toml` defines the shared Ruff settings; the formatter is a development dependency and is not added to production requirements.
