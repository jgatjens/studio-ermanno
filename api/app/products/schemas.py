from decimal import Decimal
from typing import Optional, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Metadata(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    brand: Optional[str] = Field(default=None, max_length=200)
    category: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = Field(default=None, max_length=10000)
    sku: Optional[str] = Field(default=None, max_length=100)
    cost_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    retail_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    minimum_stock: Decimal = Field(default=Decimal(0), ge=0, max_digits=12, decimal_places=3)
    is_active: bool = True
    is_public: bool = False

    @field_validator("name", "brand", "category", "description", "sku", mode="before")
    @classmethod
    def trim(cls, value):
        return value.strip() or None if isinstance(value, str) else value


class Update(Metadata):
    brand: Optional[str] = Field(max_length=200)
    category: Optional[str] = Field(max_length=100)
    description: Optional[str] = Field(max_length=10000)
    sku: Optional[str] = Field(max_length=100)
    minimum_stock: Decimal = Field(ge=0, max_digits=12, decimal_places=3)
    is_active: bool
    is_public: bool


class Create(Metadata):
    request_id: UUID
    opening_quantity: Decimal = Field(default=Decimal(0), ge=0, max_digits=12, decimal_places=3)


class MovementWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    movement_type: Literal["STOCK_IN", "ADJUSTMENT", "DAMAGED"]
    quantity: Decimal = Field(max_digits=12, decimal_places=3)
    notes: Optional[str] = Field(default=None, max_length=10000)

    @field_validator("notes", mode="before")
    @classmethod
    def trim(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @model_validator(mode="after")
    def valid_delta(self):
        if self.quantity == 0 or (self.movement_type != "ADJUSTMENT" and self.quantity < 0):
            raise ValueError("Supply a nonzero adjustment or positive stock-in/damaged quantity")
        return self
