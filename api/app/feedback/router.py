from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.auth.dependencies import AuthenticatedActor, require_authenticated_actor, require_owner
from app.db.session import get_session
from app.db.models import FeedbackStatus
from .schemas import Submission, Moderation
from . import service
router = APIRouter(tags=['feedback'])

@router.post('/public/feedback', status_code=201)
def submit(data: Submission, session: Session = Depends(get_session)):
    return service.submit(session, data)

@router.get('/public/feedback')
def public_list(limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0), session: Session = Depends(get_session)):
    return service.listing(session, limit, offset)

@router.get('/feedback')
def admin_list(status: Optional[FeedbackStatus] = None, limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0), actor: AuthenticatedActor = Depends(require_authenticated_actor), session: Session = Depends(get_session)):
    return service.listing(session, limit, offset, actor, status)

@router.get('/feedback/{identifier}')
def detail(identifier: UUID, actor: AuthenticatedActor = Depends(require_authenticated_actor), session: Session = Depends(get_session)):
    return service.projection(service.scoped(session, actor, identifier), actor)

@router.put('/feedback/{identifier}/moderation')
def moderate(identifier: UUID, data: Moderation, actor: AuthenticatedActor = Depends(require_owner), session: Session = Depends(get_session)):
    return service.moderate(session, actor, identifier, data)
