"""Optional midday closure within existing shared daily business hours."""
from alembic import op
import sqlalchemy as sa

revision = '0003_split_hours'
down_revision = '0002_phase7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('business_hours', sa.Column('break_start', sa.Time(), nullable=True))
    op.add_column('business_hours', sa.Column('break_end', sa.Time(), nullable=True))
    op.create_check_constraint('ck_business_hours_break', 'business_hours',
        '(break_start IS NULL AND break_end IS NULL) OR (NOT is_closed AND break_start IS NOT NULL AND break_end IS NOT NULL AND opening_time IS NOT NULL AND closing_time IS NOT NULL AND opening_time < break_start AND break_start < break_end AND break_end < closing_time)')


def downgrade():
    # Removing breaks would reopen closures under the old application model.
    if op.get_bind().scalar(sa.text('SELECT count(*) FROM business_hours WHERE break_start IS NOT NULL OR break_end IS NOT NULL')):
        raise RuntimeError('Cannot downgrade while split opening periods are configured; reconcile hours first')
    op.drop_constraint('ck_business_hours_break', 'business_hours', type_='check')
    op.drop_column('business_hours', 'break_end')
    op.drop_column('business_hours', 'break_start')
