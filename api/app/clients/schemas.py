from datetime import datetime
from decimal import Decimal
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

class ClientWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: Optional[EmailStr] = Field(default=None, max_length=320)
    phone: Optional[str] = Field(default=None, max_length=50)
    private_notes: Optional[str] = Field(default=None, max_length=10_000)

    @field_validator("first_name", "last_name", "email", "phone", "private_notes", mode="before")
    @classmethod
    def trim(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("email", "phone", "private_notes", mode="before")
    @classmethod
    def optional_blank(cls, value):
        return None if value == "" else value

class ClientSummary(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    created_at: datetime
    updated_at: datetime

class OwnerSummary(ClientSummary):
    email: Optional[str]
    phone: Optional[str]

class ServiceSnapshot(BaseModel):
    name: str
    price: Decimal
    duration_minutes: int

class ProductSnapshot(BaseModel):
    product_id: UUID
    name: str
    quantity: Decimal
    usage_type: str

class Visit(BaseModel):
    id: UUID
    scheduled_start: datetime
    scheduled_end: datetime
    status: str
    appointment_notes: Optional[str]
    final_duration_minutes: int
    final_price: Decimal
    services: list[ServiceSnapshot]
    products: list[ProductSnapshot]

class OwnerVisit(Visit):
    visit_notes: Optional[str]

class ClientProfile(ClientSummary):
    last_completed_visit: Optional[Visit]

class OwnerProfile(OwnerSummary):
    private_notes: Optional[str]
    last_completed_visit: Optional[OwnerVisit]

class Page(BaseModel):
    items: list
    total: int
    limit: int
    offset: int
