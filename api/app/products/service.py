from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.exc import IntegrityError
from app.db.models import Product, InventoryMovement, MembershipRole
from app.db.locking import lock_business
from app.inventory.service import change_stock, opening_id
from .schemas import Metadata


def scoped(session, actor, identifier):
    record = session.scalar(
        select(Product).where(Product.business_id == actor.business_id, Product.id == identifier)
    )
    if record is None:
        raise HTTPException(404, "Product not found")
    return record


def view(row):
    return dict(
        id=row.id,
        **{
            key: str(getattr(row, key))
            if isinstance(getattr(row, key), Decimal)
            else getattr(row, key)
            for key in Metadata.model_fields
        },
        current_stock=str(row.current_stock),
        low_stock=row.current_stock <= row.minimum_stock,
    )


def listing(session, actor, q, active, low_stock, limit, offset):
    filters = [Product.business_id == actor.business_id]
    if active is not None:
        filters.append(Product.is_active == active)
    if low_stock is not None:
        filters.append(
            (Product.current_stock <= Product.minimum_stock)
            if low_stock
            else (Product.current_stock > Product.minimum_stock)
        )
    q = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    if q:
        filters.append(
            or_(
                *(
                    c.ilike(f"%{q}%", escape="\\")
                    for c in [Product.name, Product.brand, Product.category, Product.sku]
                )
            )
        )
    total = session.scalar(select(func.count()).select_from(Product).where(*filters))
    rows = session.scalars(
        select(Product)
        .where(*filters)
        .order_by(Product.name, Product.id)
        .limit(limit)
        .offset(offset)
    )
    return dict(items=[view(row) for row in rows], total=total, limit=limit, offset=offset)


def conflict(code="request_conflict"):
    raise HTTPException(
        409,
        dict(
            code=code,
            message="This command conflicts with an existing record."
            if code == "request_conflict"
            else "SKU is already in use.",
        ),
    )


def metadata_write(session, actor, data, identifier=None):
    try:
        lock_business(session, actor.business_id)
        values = data.model_dump(include=set(Metadata.model_fields))
        created = identifier is None
        if not created:
            scoped(session, actor, identifier)
        command_id = data.request_id if created else identifier
        if (
            values["sku"] is not None
            and session.scalar(
                select(Product.id).where(
                    Product.business_id == actor.business_id,
                    Product.sku == values["sku"],
                    Product.id != command_id,
                )
            )
            is not None
        ):
            conflict("sku_conflict")
        if created:
            identifier = data.request_id
            existing = session.get(Product, identifier)
            if existing is not None:
                opening = session.get(InventoryMovement, opening_id(identifier))
                if (
                    existing.business_id != actor.business_id
                    or any(getattr(existing, k) != v for k, v in values.items())
                    or (opening.quantity if opening else 0) != data.opening_quantity
                ):
                    conflict()
                result = view(existing)
                session.commit()
                return result, False
            row = Product(id=identifier, business_id=actor.business_id, current_stock=0, **values)
            session.add(row)
            session.flush()
            if data.opening_quantity:
                change_stock(
                    session, row, data.opening_quantity, "STOCK_IN", opening_id(identifier)
                )
        else:
            row = scoped(session, actor, identifier)
            for key, value in values.items():
                setattr(row, key, value)
        session.commit()
        return view(row), created
    except IntegrityError:
        session.rollback()
        conflict()
    except Exception:
        session.rollback()
        raise


def movements(session, actor, identifier, movement_type, limit, offset):
    scoped(session, actor, identifier)
    filters = [
        InventoryMovement.business_id == actor.business_id,
        InventoryMovement.product_id == identifier,
    ]
    staff = actor.role == MembershipRole.STAFF
    if staff:
        filters.append(InventoryMovement.movement_type != "SOLD")
    if movement_type:
        filters.append(InventoryMovement.movement_type == movement_type)
    total = session.scalar(select(func.count()).select_from(InventoryMovement).where(*filters))
    rows = session.scalars(
        select(InventoryMovement)
        .where(*filters)
        .order_by(InventoryMovement.created_at.desc(), InventoryMovement.id.desc())
        .limit(limit)
        .offset(offset)
    )
    items = []
    for row in rows:
        item = dict(
            id=row.id,
            movement_type=row.movement_type,
            quantity=str(row.quantity),
            created_at=row.created_at,
            appointment_id=row.appointment_id,
            appointment_product_id=row.appointment_product_id,
        )
        if not staff:
            item["notes"] = row.notes
        items.append(item)
    return dict(items=items, total=total, limit=limit, offset=offset)


def manual(session, actor, identifier, data):
    try:
        lock_business(session, actor.business_id)
        product = scoped(session, actor, identifier)
        delta = -data.quantity if data.movement_type == "DAMAGED" else data.quantity
        row = session.get(InventoryMovement, data.request_id)
        fresh = row is None
        if row is not None:
            if (
                row.business_id,
                row.product_id,
                row.movement_type.value,
                row.quantity,
                row.notes,
            ) != (actor.business_id, identifier, data.movement_type, delta, data.notes):
                conflict()
        else:
            row = change_stock(
                session, product, delta, data.movement_type, data.request_id, data.notes
            )
        session.commit()
        return dict(movement_id=row.id, product=view(product)), fresh
    except IntegrityError:
        session.rollback()
        conflict()
    except Exception:
        session.rollback()
        raise
