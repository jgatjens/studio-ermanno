"""Add reversible client archiving."""

from alembic import op
import sqlalchemy as sa

revision = "0004_archive_clients"
down_revision = "0003_split_hours"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("clients", sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column("clients", "is_archived")
