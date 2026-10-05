from datetime import time
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth.dependencies import AuthenticatedActor, require_authenticated_actor, require_owner
from app.db.models import BusinessHours
from app.db.session import get_session

class DayData(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    day_of_week: int = Field(ge=0, le=6, strict=True)
    opening_time: Optional[time] = None
    closing_time: Optional[time] = None
    break_start: Optional[time] = None
    break_end: Optional[time] = None
    is_closed: bool

    @model_validator(mode="after")
    def valid_times(self):
        if self.is_closed:
            self.opening_time = self.closing_time = None
            self.break_start = self.break_end = None
        elif (self.opening_time is None or self.closing_time is None
              or self.opening_time.tzinfo is not None or self.closing_time.tzinfo is not None
              or self.closing_time <= self.opening_time):
            raise ValueError("Open days need local opening and closing times in order")
        elif self.break_start is not None or self.break_end is not None:
            if (self.break_start is None or self.break_end is None
                    or self.break_start.tzinfo is not None or self.break_end.tzinfo is not None
                    or not self.opening_time < self.break_start < self.break_end < self.closing_time):
                raise ValueError("Break times must be local and strictly inside opening hours")
        return self

class WeekData(BaseModel):
    model_config = ConfigDict(extra="forbid")
    days: list[DayData] = Field(min_length=7, max_length=7)

    @model_validator(mode="after")
    def full_week(self):
        if {day.day_of_week for day in self.days} != set(range(7)):
            raise ValueError("Supply each weekday exactly once")
        return self

router = APIRouter(prefix="/business-hours", tags=["business-hours"])

@router.get("", response_model=list[DayData])
def read(actor: AuthenticatedActor = Depends(require_authenticated_actor), session: Session = Depends(get_session)):
    return session.scalars(select(BusinessHours).where(BusinessHours.business_id == actor.business_id).order_by(BusinessHours.day_of_week)).all()

@router.put("", response_model=list[DayData])
def update(data: WeekData, actor: AuthenticatedActor = Depends(require_owner), session: Session = Depends(get_session)):
    # Serialize concurrent weekly writers through the business row, including first creation.
    from app.db.models import Business
    session.execute(select(Business.id).where(Business.id == actor.business_id).with_for_update())
    existing = {row.day_of_week: row for row in read(actor, session)}
    for day in data.days:
        record = existing.get(day.day_of_week)
        if record is None:
            record = BusinessHours(business_id=actor.business_id, day_of_week=day.day_of_week)
            session.add(record)
        record.opening_time, record.closing_time, record.is_closed = day.opening_time, day.closing_time, day.is_closed
        record.break_start, record.break_end = day.break_start, day.break_end
    session.commit()
    return read(actor, session)
