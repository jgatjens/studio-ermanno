"""Atomic history and inventory completion with historical no-replay retries."""
from app.inventory.service import change_stock
from decimal import Decimal
from typing import Optional, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select, func, or_
from app.db.models import Appointment, AppointmentService, AppointmentProduct, AppointmentStatus, Product, ProductUsage
from app.db.locking import lock_business
from .service import scoped, detail
from .scheduling import ACTIVE, conflict


class ProductEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    product_id: UUID
    usage_type: Literal["USED", "SOLD"]
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)


class CompletionWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    service_ids: list[UUID] = Field(min_length=1, max_length=50)
    products: list[ProductEntry] = Field(default_factory=list, max_length=50)
    visit_notes: Optional[str] = Field(default=None, max_length=10_000)

    @field_validator("visit_notes", mode="before")
    @classmethod
    def notes(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @model_validator(mode="after")
    def unique_selections(self):
        if len(self.service_ids) != len(set(self.service_ids)):
            raise ValueError("Confirm each service once")
        pairs = [(row.product_id, row.usage_type) for row in self.products]
        if len(pairs) != len(set(pairs)):
            raise ValueError("Combine duplicate product and usage selections")
        return self


def product_selector(session, actor, q, limit, offset):
    filters = [Product.business_id == actor.business_id, Product.is_active.is_(True)]
    q = q.strip()
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        filters.append(or_(*(column.ilike(f"%{escaped}%", escape="\\") for column in [Product.name, Product.brand])))
    total = session.scalar(select(func.count()).select_from(Product).where(*filters))
    rows = session.scalars(select(Product).where(*filters).order_by(Product.name, Product.id).limit(limit).offset(offset)).all()
    return dict(items=[dict(id=row.id, name=row.name, brand=row.brand, category=row.category) for row in rows], total=total, limit=limit, offset=offset)


def product_commands(rows):
    return {(row.product_id, str(row.usage_type.value if isinstance(row.usage_type, ProductUsage) else row.usage_type), Decimal(row.quantity)) for row in rows}


def complete(session, actor, identifier, data):
    try:
        lock_business(session, actor.business_id)
        record = scoped(session, Appointment, actor.business_id, identifier)
        service_ids = set(session.scalars(select(AppointmentService.service_id).where(AppointmentService.business_id == actor.business_id, AppointmentService.appointment_id == identifier)))
        products = session.scalars(select(AppointmentProduct).where(AppointmentProduct.business_id == actor.business_id, AppointmentProduct.appointment_id == identifier)).all()
        if record.status == AppointmentStatus.COMPLETED:
            # Retry comparison uses stored commands/snapshots, never current catalogs.
            if (set(data.service_ids) != service_ids or product_commands(data.products) != product_commands(products)
                    or data.visit_notes != record.visit_notes or len(products) != len(data.products)):
                conflict("already_completed", "This appointment was already completed with different details.")
            result = detail(session, actor, identifier)
            session.commit()  # Release the serialization lock on a successful retry.
            return result
        if record.status.value not in ACTIVE:
            conflict("invalid_transition", "Only scheduled or confirmed appointments can be completed.")
        if set(data.service_ids) != service_ids or products:
            conflict("appointment_changed", "Appointment details changed. Reload and review before completing.")
        selected = []
        for entry in data.products:
            product = scoped(session, Product, actor.business_id, entry.product_id)
            if not product.is_active:
                conflict("inactive_reference", "Choose active products for this completion.")
            selected.append((entry, product))
        totals = {}
        for entry, product in selected:
            totals[product.id] = totals.get(product.id, Decimal(0)) + entry.quantity
        for entry, product in selected:
            if product.current_stock < totals[product.id]:
                conflict("insufficient_stock", f"Insufficient stock for {product.name}.")
        for entry, product in selected:
            row = AppointmentProduct(business_id=actor.business_id, appointment_id=identifier,
                                     product_id=entry.product_id, usage_type=ProductUsage(entry.usage_type),
                                     quantity=entry.quantity, product_name_snapshot=product.name)
            session.add(row)
            session.flush()
            change_stock(session, product, -entry.quantity, entry.usage_type,
                         appointment_id=identifier, appointment_product_id=row.id)
        record.visit_notes = data.visit_notes
        record.status = AppointmentStatus.COMPLETED
        session.commit()
        return detail(session, actor, identifier)
    except Exception:
        session.rollback()
        raise
