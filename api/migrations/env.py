from alembic import context
from app.db.models import Base
from app.db.session import get_engine


def migrate(connection):
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        version_table_schema=context.config.attributes.get("test_schema"),
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connection = context.config.attributes.get("connection")
    if connection is not None:
        migrate(connection)
    else:
        with get_engine().connect() as connection:
            migrate(connection)


if context.is_offline_mode():
    raise RuntimeError("Use online Alembic commands with DATABASE_URL configured")
else:
    run_migrations_online()
