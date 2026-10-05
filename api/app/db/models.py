"""Persistent models, tenant constraints, and inventory linkage."""

from __future__ import annotations

from datetime import datetime, time, timezone
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    Uuid,
    func,
    true,
    false,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.db.session import Base


class MembershipRole(str, Enum):
    OWNER = "OWNER"
    STAFF = "STAFF"


class AppointmentStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class ProductUsage(str, Enum):
    USED = "USED"
    SOLD = "SOLD"


class MovementType(str, Enum):
    STOCK_IN = "STOCK_IN"
    USED = "USED"
    SOLD = "SOLD"
    ADJUSTMENT = "ADJUSTMENT"
    DAMAGED = "DAMAGED"


class FeedbackStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


def enum_type(enum, name):
    # VARCHAR + CHECK avoids native enum lifecycle complexity in migrations.
    return SAEnum(enum, name=name, native_enum=False, create_constraint=True, validate_strings=True)


def same_business(target, field):
    return ForeignKeyConstraint(
        ["business_id", field],
        [f"{target}.business_id", f"{target}.id"],
        name=f"fk_{field}_{target}_business",
        ondelete="RESTRICT",
    )


class Identity:
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Updated:
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class Owned:
    business_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("businesses.id", ondelete="RESTRICT"), index=True
    )

    @declared_attr
    def business(cls):
        return relationship("Business", viewonly=True)


class Business(Identity, Updated, Base):
    __tablename__ = "businesses"
    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(320))
    address: Mapped[Optional[str]] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(String(100))
    currency: Mapped[str] = mapped_column(String(3))
    whatsapp: Mapped[Optional[str]] = mapped_column(String(50))
    instagram: Mapped[Optional[str]] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text)


class AdminMembership(Identity, Updated, Owned, Base):
    __tablename__ = "admin_memberships"
    __table_args__ = (
        UniqueConstraint("business_id", "auth_user_id", name="uq_membership_identity"),
    )
    # External Supabase identity reference; no local identity/profile duplication.
    # No auth.users FK: deterministic development placeholders are not Auth users.
    auth_user_id: Mapped[UUID] = mapped_column(Uuid)
    role: Mapped[MembershipRole] = mapped_column(enum_type(MembershipRole, "membership_role"))


class Barber(Identity, Updated, Owned, Base):
    __tablename__ = "barbers"
    __table_args__ = (UniqueConstraint("business_id", "id", name="uq_barber_business_id"),)
    name: Mapped[str] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())


class Client(Identity, Updated, Owned, Base):
    __tablename__ = "clients"
    __table_args__ = (UniqueConstraint("business_id", "id", name="uq_client_business_id"),)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[Optional[str]] = mapped_column(String(320))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    private_notes: Mapped[Optional[str]] = mapped_column(Text)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    appointments: Mapped[list["Appointment"]] = relationship(
        back_populates="client", foreign_keys="Appointment.client_id"
    )


class Service(Identity, Updated, Owned, Base):
    __tablename__ = "services"
    __table_args__ = (
        UniqueConstraint("business_id", "id", name="uq_service_business_id"),
        CheckConstraint("duration_minutes >= 0", name="ck_service_duration"),
        CheckConstraint("price >= 0", name="ck_service_price"),
    )
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())


class Appointment(Identity, Updated, Owned, Base):
    __tablename__ = "appointments"
    __table_args__ = (
        UniqueConstraint("business_id", "id", name="uq_appointment_business_id"),
        same_business("clients", "client_id"),
        same_business("barbers", "barber_id"),
        CheckConstraint(
            "calculated_duration_minutes >= 0 AND final_duration_minutes >= 0",
            name="ck_appointment_duration",
        ),
        CheckConstraint("calculated_price >= 0 AND final_price >= 0", name="ck_appointment_price"),
        CheckConstraint("scheduled_end > scheduled_start", name="ck_appointment_times"),
    )
    client_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    barber_id: Mapped[Optional[UUID]] = mapped_column(Uuid, index=True)
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[AppointmentStatus] = mapped_column(
        enum_type(AppointmentStatus, "appointment_status"),
        default=AppointmentStatus.SCHEDULED,
        server_default="SCHEDULED",
    )
    appointment_notes: Mapped[Optional[str]] = mapped_column(Text)
    visit_notes: Mapped[Optional[str]] = mapped_column(Text)
    calculated_duration_minutes: Mapped[int] = mapped_column(Integer)
    final_duration_minutes: Mapped[int] = mapped_column(Integer)
    calculated_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    final_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    client: Mapped[Client] = relationship(back_populates="appointments", foreign_keys=[client_id])
    barber: Mapped[Optional[Barber]] = relationship(foreign_keys=[barber_id])
    services: Mapped[list["AppointmentService"]] = relationship(
        back_populates="appointment", foreign_keys="AppointmentService.appointment_id"
    )
    products: Mapped[list["AppointmentProduct"]] = relationship(
        back_populates="appointment", foreign_keys="AppointmentProduct.appointment_id"
    )


class AppointmentService(Identity, Owned, Base):
    __tablename__ = "appointment_services"
    __table_args__ = (
        same_business("appointments", "appointment_id"),
        same_business("services", "service_id"),
        CheckConstraint("service_price_snapshot >= 0", name="ck_snapshot_price"),
        CheckConstraint("service_duration_snapshot >= 0", name="ck_snapshot_duration"),
    )
    appointment_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    service_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    service_name_snapshot: Mapped[str] = mapped_column(String(200))
    service_price_snapshot: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    service_duration_snapshot: Mapped[int] = mapped_column(Integer)
    appointment: Mapped[Appointment] = relationship(
        back_populates="services", foreign_keys=[appointment_id]
    )
    service: Mapped[Service] = relationship(foreign_keys=[service_id])


class Product(Identity, Updated, Owned, Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("business_id", "id", name="uq_product_business_id"),
        UniqueConstraint("business_id", "sku", name="uq_product_sku"),
        CheckConstraint("current_stock >= 0", name="ck_product_stock"),
        CheckConstraint("minimum_stock >= 0", name="ck_product_minimum_stock"),
        CheckConstraint("cost_price >= 0 AND retail_price >= 0", name="ck_product_prices"),
    )
    name: Mapped[str] = mapped_column(String(200))
    brand: Mapped[Optional[str]] = mapped_column(String(200))
    category: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    sku: Mapped[Optional[str]] = mapped_column(String(100))
    cost_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    retail_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    current_stock: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, server_default="0")
    minimum_stock: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    inventory_movements: Mapped[list["InventoryMovement"]] = relationship(
        back_populates="product", foreign_keys="InventoryMovement.product_id"
    )


class AppointmentProduct(Identity, Owned, Base):
    __tablename__ = "appointment_products"
    __table_args__ = (
        same_business("appointments", "appointment_id"),
        same_business("products", "product_id"),
        UniqueConstraint(
            "business_id", "id", "appointment_id", "product_id", name="uq_appointment_product_link"
        ),
        CheckConstraint("quantity > 0", name="ck_appointment_product_quantity"),
    )
    appointment_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    product_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    product_name_snapshot: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    usage_type: Mapped[ProductUsage] = mapped_column(enum_type(ProductUsage, "product_usage"))
    appointment: Mapped[Appointment] = relationship(
        back_populates="products", foreign_keys=[appointment_id]
    )
    product: Mapped[Product] = relationship(foreign_keys=[product_id])


class InventoryMovement(Identity, Owned, Base):
    __tablename__ = "inventory_movements"
    __table_args__ = (
        same_business("products", "product_id"),
        same_business("appointments", "appointment_id"),
        UniqueConstraint("appointment_product_id", name="uq_movement_appointment_product"),
        ForeignKeyConstraint(
            ["business_id", "appointment_product_id", "appointment_id", "product_id"],
            [
                "appointment_products.business_id",
                "appointment_products.id",
                "appointment_products.appointment_id",
                "appointment_products.product_id",
            ],
            name="fk_movement_product_link",
        ),
        CheckConstraint(
            "quantity <> 0 AND ((movement_type = 'STOCK_IN' AND quantity > 0) OR (movement_type IN ('USED','SOLD','DAMAGED') AND quantity < 0) OR movement_type = 'ADJUSTMENT')",
            name="ck_movement_delta",
        ),
        CheckConstraint(
            "(movement_type IN ('USED','SOLD') AND appointment_id IS NOT NULL AND appointment_product_id IS NOT NULL) OR (movement_type NOT IN ('USED','SOLD') AND appointment_id IS NULL AND appointment_product_id IS NULL)",
            name="ck_movement_links",
        ),
    )
    appointment_product_id: Mapped[Optional[UUID]] = mapped_column(Uuid)
    product_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    appointment_id: Mapped[Optional[UUID]] = mapped_column(Uuid, index=True)
    movement_type: Mapped[MovementType] = mapped_column(enum_type(MovementType, "movement_type"))
    # Signed delta; inventory service updates its balance in the same transaction.
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    product: Mapped[Product] = relationship(
        back_populates="inventory_movements", foreign_keys=[product_id]
    )
    appointment: Mapped[Optional[Appointment]] = relationship(foreign_keys=[appointment_id])


class Feedback(Identity, Updated, Owned, Base):
    __tablename__ = "feedback"
    __table_args__ = (
        same_business("clients", "client_id"),
        same_business("appointments", "appointment_id"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_feedback_rating"),
    )
    client_id: Mapped[Optional[UUID]] = mapped_column(Uuid, index=True)
    appointment_id: Mapped[Optional[UUID]] = mapped_column(Uuid, index=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[Optional[str]] = mapped_column(String(320))
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[FeedbackStatus] = mapped_column(
        enum_type(FeedbackStatus, "feedback_status"),
        default=FeedbackStatus.PENDING,
        server_default="PENDING",
    )
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    client: Mapped[Optional[Client]] = relationship(foreign_keys=[client_id])
    appointment: Mapped[Optional[Appointment]] = relationship(foreign_keys=[appointment_id])


class BusinessHours(Identity, Updated, Owned, Base):
    __tablename__ = "business_hours"
    __table_args__ = (
        UniqueConstraint("business_id", "day_of_week", name="uq_business_hours_day"),
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="ck_business_hours_day"),
        CheckConstraint(
            "is_closed OR (opening_time IS NOT NULL AND closing_time IS NOT NULL AND closing_time > opening_time)",
            name="ck_business_hours_times",
        ),
        CheckConstraint(
            "(break_start IS NULL AND break_end IS NULL) OR (NOT is_closed AND break_start IS NOT NULL AND break_end IS NOT NULL AND opening_time IS NOT NULL AND closing_time IS NOT NULL AND opening_time < break_start AND break_start < break_end AND break_end < closing_time)",
            name="ck_business_hours_break",
        ),
    )
    # ISO-style Python weekday: Monday=0, Sunday=6. Times are local to Business.timezone.
    day_of_week: Mapped[int] = mapped_column(Integer)
    opening_time: Mapped[Optional[time]] = mapped_column(Time)
    closing_time: Mapped[Optional[time]] = mapped_column(Time)
    break_start: Mapped[Optional[time]] = mapped_column(Time)
    break_end: Mapped[Optional[time]] = mapped_column(Time)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
