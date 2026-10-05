from typing import Optional
from uuid import UUID
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth.dependencies import AuthenticatedActor, require_authenticated_actor, require_owner
from app.db.models import Barber
from app.db.session import get_session
from app.db.locking import lock_business

class WriteData(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be blank")
        return value

class ReadData(WriteData):
    model_config = ConfigDict(from_attributes=True)
    id: UUID

router = APIRouter(prefix="/barbers", tags=["barbers"])

@router.get("", response_model=list[ReadData])
def list_records(active: Optional[bool] = None, actor: AuthenticatedActor = Depends(require_authenticated_actor), session: Session = Depends(get_session)):
    query = select(Barber).where(Barber.business_id == actor.business_id)
    if active is not None:
        query = query.where(Barber.is_active == active)
    return session.scalars(query.order_by(Barber.name, Barber.id)).all()

@router.post("", response_model=ReadData, status_code=201)
def create(data: WriteData, actor: AuthenticatedActor = Depends(require_owner), session: Session = Depends(get_session)):
    lock_business(session, actor.business_id)
    record = Barber(business_id=actor.business_id, **data.model_dump())
    session.add(record)
    session.commit()
    session.refresh(record)
    return record

@router.put("/{record_id}", response_model=ReadData)
def update(record_id: UUID, data: WriteData, actor: AuthenticatedActor = Depends(require_owner), session: Session = Depends(get_session)):
    lock_business(session, actor.business_id)
    record = session.scalar(select(Barber).where(Barber.id == record_id, Barber.business_id == actor.business_id))
    if record is None:
        raise HTTPException(404, "Record not found")
    for key, value in data.model_dump().items():
        setattr(record, key, value)
    session.commit()
    session.refresh(record)
    return record
