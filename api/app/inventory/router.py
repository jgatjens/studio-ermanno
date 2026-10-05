from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.auth.dependencies import AuthenticatedActor, require_authenticated_actor
from app.db.session import get_session
from app.products.service import listing
router = APIRouter(prefix='/inventory', tags=['inventory'])

@router.get('')
def inventory(q: str = Query('', max_length=200), active: Optional[bool] = True, include_inactive: bool = False, low_stock: Optional[bool] = None, limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0), actor: AuthenticatedActor = Depends(require_authenticated_actor), session: Session = Depends(get_session)):
    return listing(session, actor, q, None if include_inactive else active, low_stock, limit, offset)
