"""Focused stock writes; callers hold the business lock and own the transaction."""
from decimal import Decimal
from uuid import UUID, uuid5
from fastapi import HTTPException
from app.db.models import InventoryMovement, MovementType

OPENING_NAMESPACE = UUID('cb639e5e-8c0e-4fd0-a109-ccf088c29704')

def opening_id(product_id):
    return uuid5(OPENING_NAMESPACE, str(product_id))

def change_stock(session, product, delta, movement_type, identifier=None, notes=None, appointment_id=None, appointment_product_id=None):
    balance = Decimal(product.current_stock) + delta
    if balance < 0:
        raise HTTPException(409, dict(code='insufficient_stock', message=f'Insufficient stock for {product.name}.'))
    if balance > Decimal('999999999.999'):
        raise HTTPException(422, 'Stock balance exceeds supported precision')
    values = dict(business_id=product.business_id, product_id=product.id, movement_type=MovementType(movement_type), quantity=delta, notes=notes, appointment_id=appointment_id, appointment_product_id=appointment_product_id)
    if identifier is not None:
        values['id'] = identifier
    row = InventoryMovement(**values)
    product.current_stock = balance
    session.add(row)
    return row
