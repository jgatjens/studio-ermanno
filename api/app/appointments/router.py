from datetime import datetime
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.auth.dependencies import AuthenticatedActor, require_authenticated_actor, require_owner
from app.db.session import get_session
from app.db.models import Business, Appointment, AppointmentStatus
from .schemas import AppointmentWrite, PreviewWrite, StatusWrite
from . import service, completion

router = APIRouter(prefix="/appointments", tags=["appointments"])

@router.get("/context")
def context(actor: AuthenticatedActor = Depends(require_authenticated_actor), session: Session = Depends(get_session)):
    business = session.get(Business, actor.business_id)
    return dict(timezone=business.timezone, currency=business.currency)

@router.post("/preview")
def preview(data: PreviewWrite, actor: AuthenticatedActor = Depends(require_owner), session: Session = Depends(get_session)):
    record = service.scoped(session, Appointment, actor.business_id, data.appointment_id) if data.appointment_id else None
    return service.calculate(session, actor, data, record)

@router.get("")
def list_records(start: Optional[datetime] = Query(default=None, alias="from"), end: Optional[datetime] = Query(default=None, alias="to"), status: Optional[AppointmentStatus] = None, client_id: Optional[UUID] = None, barber_id: Optional[UUID] = None, limit: int = Query(default=25, ge=1, le=100), offset: int = Query(default=0, ge=0), actor: AuthenticatedActor = Depends(require_authenticated_actor), session: Session = Depends(get_session)):
    return service.list_records(session, actor, start, end, status, client_id, barber_id, limit, offset)

@router.post("", status_code=201)
def create(data: AppointmentWrite, actor: AuthenticatedActor = Depends(require_owner), session: Session = Depends(get_session)):
    return service.save(session, actor, data)

@router.get("/completion-products")
def completion_products(q: str = Query(default="", max_length=200), limit: int = Query(default=25, ge=1, le=100), offset: int = Query(default=0, ge=0), actor: AuthenticatedActor = Depends(require_owner), session: Session = Depends(get_session)):
    return completion.product_selector(session, actor, q, limit, offset)

@router.post("/{identifier}/complete")
def complete(identifier: UUID, data: completion.CompletionWrite, actor: AuthenticatedActor = Depends(require_owner), session: Session = Depends(get_session)):
    return completion.complete(session, actor, identifier, data)

@router.get("/{identifier}")
def detail(identifier: UUID, actor: AuthenticatedActor = Depends(require_authenticated_actor), session: Session = Depends(get_session)):
    return service.detail(session, actor, identifier)

@router.put("/{identifier}")
def update(identifier: UUID, data: AppointmentWrite, actor: AuthenticatedActor = Depends(require_owner), session: Session = Depends(get_session)):
    return service.save(session, actor, data, identifier)

@router.post("/{identifier}/status")
def change_status(identifier: UUID, data: StatusWrite, actor: AuthenticatedActor = Depends(require_owner), session: Session = Depends(get_session)):
    return service.change_status(session, actor, identifier, data.status)
