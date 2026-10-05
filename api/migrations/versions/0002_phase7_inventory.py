"""Inventory baseline and completion linkage.

Downgrade preserves movements but loses appointment-product linkage semantics.
"""

from uuid import UUID, uuid5
from decimal import Decimal
from alembic import op
import sqlalchemy as sa

revision = "0002_phase7"
down_revision = "0001_phase1"
branch_labels = None
depends_on = None
BASELINE_NAMESPACE = UUID("8c8f12b5-b62b-44cb-835d-5a08acfb01cf")


def upgrade():
    connection = op.get_bind()
    invalid = connection.execute(
        sa.text(
            "SELECT id FROM products WHERE current_stock < 0 UNION ALL SELECT id FROM inventory_movements WHERE quantity = 0 OR appointment_id IS NOT NULL OR movement_type IN ('USED','SOLD') OR (movement_type = 'STOCK_IN' AND quantity < 0) OR (movement_type = 'DAMAGED' AND quantity > 0)"
        )
    ).first()
    if invalid:
        raise RuntimeError(
            "Phase 7 preflight: invalid stock or legacy movement links/signs; reconcile record "
            + str(invalid[0])
            + " before upgrading."
        )
    baselines = connection.execute(
        sa.text(
            "SELECT p.id, p.business_id, p.current_stock - COALESCE(SUM(m.quantity),0) AS delta FROM products p LEFT JOIN inventory_movements m ON m.product_id=p.id AND m.business_id=p.business_id GROUP BY p.id,p.business_id,p.current_stock"
        )
    ).all()
    if any(abs(row.delta) > Decimal("999999999.999") for row in baselines):
        raise RuntimeError(
            "Phase 7 preflight: baseline delta exceeds numeric precision; reconcile ledger before upgrading."
        )
    op.add_column(
        "inventory_movements", sa.Column("appointment_product_id", sa.Uuid(), nullable=True)
    )
    op.create_unique_constraint(
        "uq_appointment_product_link",
        "appointment_products",
        ["business_id", "id", "appointment_id", "product_id"],
    )
    op.create_unique_constraint(
        "uq_movement_appointment_product", "inventory_movements", ["appointment_product_id"]
    )
    op.create_foreign_key(
        "fk_movement_product_link",
        "inventory_movements",
        "appointment_products",
        ["business_id", "appointment_product_id", "appointment_id", "product_id"],
        ["business_id", "id", "appointment_id", "product_id"],
    )
    op.create_check_constraint("ck_product_stock", "products", "current_stock >= 0")
    op.create_check_constraint(
        "ck_movement_delta",
        "inventory_movements",
        "quantity <> 0 AND ((movement_type = 'STOCK_IN' AND quantity > 0) OR (movement_type IN ('USED','SOLD','DAMAGED') AND quantity < 0) OR movement_type = 'ADJUSTMENT')",
    )
    op.create_check_constraint(
        "ck_movement_links",
        "inventory_movements",
        "(movement_type IN ('USED','SOLD') AND appointment_id IS NOT NULL AND appointment_product_id IS NOT NULL) OR (movement_type NOT IN ('USED','SOLD') AND appointment_id IS NULL AND appointment_product_id IS NULL)",
    )
    for row in baselines:
        if row.delta:
            connection.execute(
                sa.text(
                    "INSERT INTO inventory_movements (id,business_id,product_id,movement_type,quantity,notes) VALUES (:id,:business,:product,'ADJUSTMENT',:delta,:notes)"
                ),
                dict(
                    id=uuid5(BASELINE_NAMESPACE, str(row.id)),
                    business=row.business_id,
                    product=row.id,
                    delta=row.delta,
                    notes="Phase 7 opening ledger baseline; existing balance preserved.",
                ),
            )


def downgrade():
    for name in ["ck_movement_links", "ck_movement_delta"]:
        op.drop_constraint(name, "inventory_movements", type_="check")
    op.drop_constraint("ck_product_stock", "products", type_="check")
    op.drop_constraint("fk_movement_product_link", "inventory_movements", type_="foreignkey")
    op.drop_constraint("uq_movement_appointment_product", "inventory_movements", type_="unique")
    op.drop_constraint("uq_appointment_product_link", "appointment_products", type_="unique")
    op.drop_column("inventory_movements", "appointment_product_id")
