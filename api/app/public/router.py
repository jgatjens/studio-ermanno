"""Anonymous, explicitly projected business and catalog reads."""
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.db.session import get_session
from app.db.models import Business, BusinessHours, Service, Product

router = APIRouter(prefix='/public', tags=['public website'])

def business(session):
    identifier = get_settings().public_business_id
    row = session.get(Business, identifier) if identifier else None
    if row is None:
        raise HTTPException(503, 'Public website is not configured')
    return row

@router.get('/business')
def business_info(response: Response, session: Session = Depends(get_session)):
    row = business(session)
    response.headers['Cache-Control'] = 'no-store'
    result = {field: getattr(row, field) for field in ('name', 'description', 'address', 'phone', 'email', 'whatsapp', 'instagram', 'timezone', 'currency')}
    hours = {h.day_of_week: h for h in session.scalars(select(BusinessHours).where(BusinessHours.business_id == row.id))}
    result['hours'] = []
    for day in range(7):
        hour = hours.get(day)
        closed = hour is None or hour.is_closed
        result['hours'].append(dict(day_of_week=day, is_closed=closed, opening_time=None if closed else hour.opening_time, closing_time=None if closed else hour.closing_time))
    return result

def catalog(session, response, model, fields, limit, offset):
    row = business(session)
    filters = [model.business_id == row.id, model.is_active.is_(True)]
    if model is Product:
        filters.append(Product.is_public.is_(True))
    total = session.scalar(select(func.count()).select_from(model).where(*filters))
    rows = session.scalars(select(model).where(*filters).order_by(model.name, model.id).limit(limit).offset(offset))
    items = []
    for item in rows:
        projected = {field: getattr(item, field) for field in fields}
        price = 'price' if model is Service else 'retail_price'
        projected[price] = str(projected[price])
        items.append(projected)
    response.headers['Cache-Control'] = 'no-store'
    return dict(items=items, total=total, limit=limit, offset=offset)

@router.get('/services')
def services(response: Response, limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0), session: Session = Depends(get_session)):
    return catalog(session, response, Service, ('name', 'description', 'duration_minutes', 'price'), limit, offset)

@router.get('/products')
def products(response: Response, limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0), session: Session = Depends(get_session)):
    return catalog(session, response, Product, ('name', 'brand', 'category', 'description', 'retail_price'), limit, offset)
