from fastapi import HTTPException
from sqlalchemy import select, func, or_, delete
from sqlalchemy.exc import IntegrityError
from app.db.models import (
    Client,
    Appointment,
    AppointmentService,
    AppointmentProduct,
    AppointmentStatus,
    MembershipRole,
    ProductUsage,
    Feedback,
)
from .schemas import (
    ClientSummary,
    OwnerSummary,
    ClientProfile,
    OwnerProfile,
    Visit,
    OwnerVisit,
    ServiceSnapshot,
    ProductSnapshot,
)


def find_client(session, actor, client_id):
    record = session.scalar(
        select(Client).where(Client.business_id == actor.business_id, Client.id == client_id)
    )
    if record is None:
        raise HTTPException(404, "Client not found")
    return record


def summary(record, actor):
    fields = {
        key: getattr(record, key)
        for key in ("id", "first_name", "last_name", "created_at", "updated_at")
    }
    if actor.role == MembershipRole.OWNER:
        return OwnerSummary(**fields, email=record.email, phone=record.phone)
    return ClientSummary(**fields)


def list_clients(session, actor, q, limit, offset):
    filters = [Client.business_id == actor.business_id]
    q = q.strip()
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        columns = [Client.first_name, Client.last_name]
        if actor.role == MembershipRole.OWNER:
            columns += [Client.email, Client.phone]
        filters.append(or_(*(column.ilike(f"%{escaped}%", escape="\\") for column in columns)))
    total = session.scalar(select(func.count()).select_from(Client).where(*filters))
    records = session.scalars(
        select(Client)
        .where(*filters)
        .order_by(Client.last_name, Client.first_name, Client.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return dict(
        items=[summary(row, actor) for row in records], total=total, limit=limit, offset=offset
    )


def history(session, actor, client_id, limit, offset):
    filters = [
        Appointment.business_id == actor.business_id,
        Appointment.client_id == client_id,
        Appointment.status == AppointmentStatus.COMPLETED,
    ]
    total = session.scalar(select(func.count()).select_from(Appointment).where(*filters))
    records = session.scalars(
        select(Appointment)
        .where(*filters)
        .order_by(Appointment.scheduled_start.desc(), Appointment.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    ids = [row.id for row in records]
    services, products = {}, {}
    if ids:
        for row in session.scalars(
            select(AppointmentService)
            .where(
                AppointmentService.business_id == actor.business_id,
                AppointmentService.appointment_id.in_(ids),
            )
            .order_by(AppointmentService.id)
        ):
            services.setdefault(row.appointment_id, []).append(
                ServiceSnapshot(
                    name=row.service_name_snapshot,
                    price=row.service_price_snapshot,
                    duration_minutes=row.service_duration_snapshot,
                )
            )
        product_query = select(AppointmentProduct).where(
            AppointmentProduct.business_id == actor.business_id,
            AppointmentProduct.appointment_id.in_(ids),
        )
        if actor.role != MembershipRole.OWNER:
            product_query = product_query.where(AppointmentProduct.usage_type == ProductUsage.USED)
        for row in session.scalars(product_query.order_by(AppointmentProduct.id)):
            products.setdefault(row.appointment_id, []).append(
                ProductSnapshot(
                    product_id=row.product_id,
                    name=row.product_name_snapshot,
                    quantity=row.quantity,
                    usage_type=row.usage_type.value,
                )
            )
    visits = []
    for row in records:
        fields = {
            key: getattr(row, key)
            for key in (
                "id",
                "scheduled_start",
                "scheduled_end",
                "appointment_notes",
                "final_duration_minutes",
                "final_price",
            )
        }
        fields.update(
            status=row.status.value,
            services=services.get(row.id, []),
            products=products.get(row.id, []),
        )
        visits.append(
            OwnerVisit(**fields, visit_notes=row.visit_notes)
            if actor.role == MembershipRole.OWNER
            else Visit(**fields)
        )
    return dict(items=visits, total=total, limit=limit, offset=offset)


def profile(session, actor, record):
    fields = summary(record, actor).model_dump()
    visits = history(session, actor, record.id, 1, 0)["items"]
    fields["last_completed_visit"] = visits[0] if visits else None
    if actor.role == MembershipRole.OWNER:
        return OwnerProfile(**fields, private_notes=record.private_notes)
    return ClientProfile(**fields)


def save(session, record):
    try:
        session.add(record)
        session.commit()
        session.refresh(record)
    except Exception:
        session.rollback()
        raise


DELETE_CONFLICT = "Clients with linked appointments or feedback cannot be deleted."


def delete_client(session, actor, client_id):
    # Serialize deletion with PostgreSQL foreign-key checks for concurrent links.
    record = session.scalar(
        select(Client)
        .where(Client.business_id == actor.business_id, Client.id == client_id)
        .with_for_update()
    )
    if record is None:
        raise HTTPException(404, "Client not found")
    for model in (Appointment, Feedback):
        linked = session.scalar(
            select(model.id)
            .where(model.business_id == actor.business_id, model.client_id == client_id)
            .limit(1)
        )
        if linked is not None:
            raise HTTPException(409, DELETE_CONFLICT)
    try:
        # Bulk delete leaves linked records untouched; FK RESTRICT is the final guard.
        session.execute(
            delete(Client).where(Client.business_id == actor.business_id, Client.id == client_id)
        )
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, DELETE_CONFLICT) from None
    except Exception:
        session.rollback()
        raise
