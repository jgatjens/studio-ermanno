from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.db.session import get_session
from .service import availability
router = APIRouter(prefix='/public/availability', tags=['availability'])

@router.get('')
def read(response: Response, start: Optional[date] = None, days: int = Query(7, ge=1, le=14), session: Session = Depends(get_session)):
    response.headers['Cache-Control'] = 'no-store'
    return availability(session, start, days)
