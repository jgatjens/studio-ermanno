from typing import Optional
from uuid import UUID
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth.dependencies import AuthenticatedActor, require_authenticated_actor, require_owner
from app.db.models import Service
from app.db.session import get_session
from app.db.locking import lock_business


class WriteData(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    is_active: bool = True
    description: Optional[str] = None
    duration_minutes: int = Field(gt=0, strict=True)
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)

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


router = APIRouter(prefix="/services", tags=["services"])


@router.get("", response_model=list[ReadData])
def list_records(
    active: Optional[bool] = None,
    actor: AuthenticatedActor = Depends(require_authenticated_actor),
    session: Session = Depends(get_session),
):
    query = select(Service).where(Service.business_id == actor.business_id)
    if active is not None:
        query = query.where(Service.is_active == active)
    return session.scalars(query.order_by(Service.name, Service.id)).all()


@router.post("", response_model=ReadData, status_code=201)
def create(
    data: WriteData,
    actor: AuthenticatedActor = Depends(require_owner),
    session: Session = Depends(get_session),
):
    lock_business(session, actor.business_id)
    record = Service(business_id=actor.business_id, **data.model_dump())
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.put("/{record_id}", response_model=ReadData)
def update(
    record_id: UUID,
    data: WriteData,
    actor: AuthenticatedActor = Depends(require_owner),
    session: Session = Depends(get_session),
):
    lock_business(session, actor.business_id)
    record = session.scalar(
        select(Service).where(Service.id == record_id, Service.business_id == actor.business_id)
    )
    if record is None:
        raise HTTPException(404, "Record not found")
    for key, value in data.model_dump().items():
        setattr(record, key, value)
    session.commit()
    session.refresh(record)
    return record
