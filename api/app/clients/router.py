from uuid import UUID
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.auth.dependencies import AuthenticatedActor, require_authenticated_actor, require_owner
from app.db.session import get_session
from app.db.models import Client
from .schemas import ClientWrite
from . import service

router = APIRouter(prefix="/clients", tags=["clients"])


# Each response is an explicit role-specific Pydantic projection. Avoid union
# response coercion, which can accidentally drop Owner-only fields.
@router.get("")
def list_clients(
    q: str = Query(default="", max_length=200),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    actor: AuthenticatedActor = Depends(require_authenticated_actor),
    session: Session = Depends(get_session),
):
    return service.list_clients(session, actor, q, limit, offset)


@router.post("", status_code=201)
def create(
    data: ClientWrite,
    actor: AuthenticatedActor = Depends(require_owner),
    session: Session = Depends(get_session),
):
    record = Client(business_id=actor.business_id, **data.model_dump())
    service.save(session, record)
    return service.profile(session, actor, record)


@router.get("/{client_id}")
def get_profile(
    client_id: UUID,
    actor: AuthenticatedActor = Depends(require_authenticated_actor),
    session: Session = Depends(get_session),
):
    return service.profile(session, actor, service.find_client(session, actor, client_id))


@router.put("/{client_id}")
def update(
    client_id: UUID,
    data: ClientWrite,
    actor: AuthenticatedActor = Depends(require_owner),
    session: Session = Depends(get_session),
):
    record = service.find_client(session, actor, client_id)
    for key, value in data.model_dump().items():
        setattr(record, key, value)
    service.save(session, record)
    return service.profile(session, actor, record)


@router.get("/{client_id}/history")
def get_history(
    client_id: UUID,
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    actor: AuthenticatedActor = Depends(require_authenticated_actor),
    session: Session = Depends(get_session),
):
    service.find_client(session, actor, client_id)
    return service.history(session, actor, client_id, limit, offset)


@router.delete("/{client_id}", status_code=204)
def delete_client(
    client_id: UUID,
    actor: AuthenticatedActor = Depends(require_owner),
    session: Session = Depends(get_session),
):
    service.delete_client(session, actor, client_id)
    return Response(status_code=204)
