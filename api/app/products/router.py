from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.auth.dependencies import AuthenticatedActor, require_authenticated_actor, require_owner
from app.db.models import MovementType
from app.db.session import get_session
from .schemas import Create, Update, MovementWrite
from . import service

router = APIRouter(prefix="/products", tags=["products"])


@router.get("")
def listing(
    q: str = Query("", max_length=200),
    active: Optional[bool] = None,
    low_stock: Optional[bool] = None,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    actor: AuthenticatedActor = Depends(require_authenticated_actor),
    session: Session = Depends(get_session),
):
    return service.listing(session, actor, q, active, low_stock, limit, offset)


@router.get("/{identifier}")
def detail(
    identifier: UUID,
    actor: AuthenticatedActor = Depends(require_authenticated_actor),
    session: Session = Depends(get_session),
):
    return service.view(service.scoped(session, actor, identifier))


@router.post("", status_code=201)
def create(
    data: Create,
    response: Response,
    actor: AuthenticatedActor = Depends(require_owner),
    session: Session = Depends(get_session),
):
    result, fresh = service.metadata_write(session, actor, data)
    response.status_code = 201 if fresh else 200
    return result


@router.put("/{identifier}")
def update(
    identifier: UUID,
    data: Update,
    actor: AuthenticatedActor = Depends(require_owner),
    session: Session = Depends(get_session),
):
    return service.metadata_write(session, actor, data, identifier)[0]


@router.get("/{identifier}/movements")
def movements(
    identifier: UUID,
    movement_type: Optional[MovementType] = None,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    actor: AuthenticatedActor = Depends(require_authenticated_actor),
    session: Session = Depends(get_session),
):
    return service.movements(session, actor, identifier, movement_type, limit, offset)


@router.post("/{identifier}/movements", status_code=201)
def manual(
    identifier: UUID,
    data: MovementWrite,
    response: Response,
    actor: AuthenticatedActor = Depends(require_owner),
    session: Session = Depends(get_session),
):
    result, fresh = service.manual(session, actor, identifier, data)
    response.status_code = 201 if fresh else 200
    return result
