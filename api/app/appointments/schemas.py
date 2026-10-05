from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


class AppointmentWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_id: UUID
    scheduled_start: datetime
    service_ids: list[UUID] = Field(min_length=1, max_length=50)
    barber_id: Optional[UUID] = None
    appointment_notes: Optional[str] = Field(default=None, max_length=10_000)
    duration_override_minutes: Optional[int] = Field(default=None, gt=0, le=1440, strict=True)
    price_override: Optional[Decimal] = Field(default=None, ge=0, max_digits=12, decimal_places=2)

    @field_validator("scheduled_start")
    @classmethod
    def aware_start(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Supply a timestamp with an explicit offset")
        if value.second or value.microsecond:
            raise ValueError("Use minute precision")
        return value.astimezone(timezone.utc)

    @field_validator("service_ids")
    @classmethod
    def unique_services(cls, value):
        if len(value) != len(set(value)):
            raise ValueError("Select each service once")
        return value

    @field_validator("appointment_notes", mode="before")
    @classmethod
    def notes(cls, value):
        return value.strip() or None if isinstance(value, str) else value


class PreviewWrite(AppointmentWrite):
    appointment_id: Optional[UUID] = None


class StatusWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["CONFIRMED", "CANCELLED", "NO_SHOW"]
