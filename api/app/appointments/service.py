from datetime import timedelta
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select, func, delete
from app.db.models import (
    Appointment,
    AppointmentService,
    AppointmentProduct,
    AppointmentStatus,
    Client,
    Service,
    Barber,
    Business,
    BusinessHours,
    MembershipRole,
    ProductUsage,
)
from app.db.locking import lock_business
from .scheduling import ACTIVE, conflict, utc, check_hours, check_capacity


def scoped(session, model, business_id, identifier):
    record = session.scalar(
        select(model)
        .where(model.business_id == business_id, model.id == identifier)
        .execution_options(populate_existing=True)
    )
    if record is None:
        raise HTTPException(404, "Record not found")
    return record


def editable(record):
    if record.status.value not in ACTIVE:
        conflict("invalid_transition", "This appointment is read only.")


def calculate(session, actor, data, record=None):
    if record:
        editable(record)
    scoped(session, Client, actor.business_id, data.client_id)
    retained = {}
    if record:
        retained = {
            row.service_id: row
            for row in session.scalars(
                select(AppointmentService).where(
                    AppointmentService.business_id == actor.business_id,
                    AppointmentService.appointment_id == record.id,
                )
            )
        }
    selected = []
    for identifier in data.service_ids:
        if identifier in retained:
            old = retained[identifier]
            selected.append(
                dict(
                    service_id=identifier,
                    name=old.service_name_snapshot,
                    price=old.service_price_snapshot,
                    duration_minutes=old.service_duration_snapshot,
                )
            )
        else:
            row = scoped(session, Service, actor.business_id, identifier)
            if not row.is_active:
                conflict("inactive_reference", "New selections must use active services.")
            selected.append(
                dict(
                    service_id=identifier,
                    name=row.name,
                    price=row.price,
                    duration_minutes=row.duration_minutes,
                )
            )
    duration = sum(row["duration_minutes"] for row in selected)
    price = sum((row["price"] for row in selected), Decimal("0"))
    if not 0 < duration <= 1440 or price > Decimal("9999999999.99"):
        raise HTTPException(422, "Calculated totals exceed appointment limits")
    final_duration = (
        data.duration_override_minutes if data.duration_override_minutes is not None else duration
    )
    final_price = data.price_override if data.price_override is not None else price
    end = data.scheduled_start + timedelta(minutes=final_duration)
    if data.barber_id is not None:
        barber = scoped(session, Barber, actor.business_id, data.barber_id)
        unchanged = (
            record
            and record.barber_id == data.barber_id
            and utc(record.scheduled_start) == data.scheduled_start
            and utc(record.scheduled_end) == end
        )
        if not barber.is_active and not unchanged:
            conflict("inactive_reference", "Choose an active barber.")
    return dict(
        services=selected,
        calculated_duration_minutes=duration,
        calculated_price=price,
        final_duration_minutes=final_duration,
        final_price=final_price,
        scheduled_end=end,
    )


def validate_schedule(session, actor, business, data, totals, record):
    if (
        record
        and record.barber_id == data.barber_id
        and utc(record.scheduled_start) == data.scheduled_start
        and utc(record.scheduled_end) == totals["scheduled_end"]
    ):
        return
    hours = session.scalars(
        select(BusinessHours).where(BusinessHours.business_id == actor.business_id)
    ).all()
    check_hours(data.scheduled_start, totals["scheduled_end"], business.timezone, hours)
    count = session.scalar(
        select(func.count())
        .select_from(Barber)
        .where(Barber.business_id == actor.business_id, Barber.is_active.is_(True))
    )
    query = select(Appointment).where(
        Appointment.business_id == actor.business_id,
        Appointment.status.in_(ACTIVE),
        Appointment.scheduled_start < totals["scheduled_end"],
        Appointment.scheduled_end > data.scheduled_start,
    )
    if record:
        query = query.where(Appointment.id != record.id)
    check_capacity(
        data.scheduled_start,
        totals["scheduled_end"],
        data.barber_id,
        count,
        session.scalars(query).all(),
    )


def save(session, actor, data, identifier=None):
    try:
        business = lock_business(session, actor.business_id)
        record = scoped(session, Appointment, actor.business_id, identifier) if identifier else None
        totals = calculate(session, actor, data, record)
        validate_schedule(session, actor, business, data, totals, record)
        if record is None:
            record = Appointment(business_id=actor.business_id, status=AppointmentStatus.SCHEDULED)
            session.add(record)
        for field in ("client_id", "scheduled_start", "barber_id", "appointment_notes"):
            setattr(record, field, getattr(data, field))
        for field, value in totals.items():
            if field != "services":
                setattr(record, field, value)
        session.flush()
        session.execute(
            delete(AppointmentService).where(
                AppointmentService.business_id == actor.business_id,
                AppointmentService.appointment_id == record.id,
            )
        )
        for row in totals["services"]:
            session.add(
                AppointmentService(
                    business_id=actor.business_id,
                    appointment_id=record.id,
                    service_id=row["service_id"],
                    service_name_snapshot=row["name"],
                    service_price_snapshot=row["price"],
                    service_duration_snapshot=row["duration_minutes"],
                )
            )
        session.commit()
        return detail(session, actor, record.id)
    except Exception:
        session.rollback()
        raise


def change_status(session, actor, identifier, status):
    try:
        lock_business(session, actor.business_id)
        record = scoped(session, Appointment, actor.business_id, identifier)
        if record.status.value != status:
            editable(record)
            if status == "CONFIRMED":
                if record.status != AppointmentStatus.SCHEDULED:
                    conflict("invalid_transition", "This status transition is not allowed.")
                if (
                    record.barber_id is not None
                    and not scoped(session, Barber, actor.business_id, record.barber_id).is_active
                ):
                    conflict("inactive_reference", "Choose an active barber before confirming.")
            record.status = AppointmentStatus(status)
            session.commit()
        return detail(session, actor, identifier)
    except Exception:
        session.rollback()
        raise


def projections(session, actor, records, full=False):
    ids = [record.id for record in records]
    if not ids:
        return []
    clients = {
        row.id: row
        for row in session.scalars(
            select(Client).where(
                Client.business_id == actor.business_id,
                Client.id.in_([r.client_id for r in records]),
            )
        )
    }
    barbers = {
        row.id: row
        for row in session.scalars(
            select(Barber).where(
                Barber.business_id == actor.business_id,
                Barber.id.in_([r.barber_id for r in records if r.barber_id]),
            )
        )
    }
    services, products = {}, {}
    for row in session.scalars(
        select(AppointmentService)
        .where(
            AppointmentService.business_id == actor.business_id,
            AppointmentService.appointment_id.in_(ids),
        )
        .order_by(AppointmentService.service_name_snapshot, AppointmentService.service_id)
    ):
        services.setdefault(row.appointment_id, []).append(
            dict(
                service_id=row.service_id,
                name=row.service_name_snapshot,
                price=row.service_price_snapshot,
                duration_minutes=row.service_duration_snapshot,
            )
        )
    owner = actor.role == MembershipRole.OWNER
    if full:
        query = select(AppointmentProduct).where(
            AppointmentProduct.business_id == actor.business_id,
            AppointmentProduct.appointment_id.in_(ids),
        )
        if not owner:
            query = query.where(AppointmentProduct.usage_type == ProductUsage.USED)
        for row in session.scalars(query.order_by(AppointmentProduct.id)):
            products.setdefault(row.appointment_id, []).append(
                dict(
                    product_id=row.product_id,
                    name=row.product_name_snapshot,
                    quantity=row.quantity,
                    usage_type=row.usage_type.value,
                )
            )
    result = []
    for row in records:
        client = clients[row.client_id]
        barber = barbers.get(row.barber_id)
        value = dict(
            id=row.id,
            client=dict(id=client.id, first_name=client.first_name, last_name=client.last_name),
            barber=dict(id=barber.id, name=barber.name, is_active=barber.is_active)
            if barber
            else None,
            scheduled_start=utc(row.scheduled_start),
            scheduled_end=utc(row.scheduled_end),
            status=row.status.value,
            final_duration_minutes=row.final_duration_minutes,
            final_price=row.final_price,
            main_service=services.get(row.id, [None])[0],
        )
        if full:
            value.update(
                services=services.get(row.id, []),
                products=products.get(row.id, []),
                calculated_duration_minutes=row.calculated_duration_minutes,
                calculated_price=row.calculated_price,
                appointment_notes=row.appointment_notes,
            )
            if owner:
                value["client"].update(email=client.email, phone=client.phone)
                value["visit_notes"] = row.visit_notes
        result.append(value)
    return result


def detail(session, actor, identifier):
    return projections(
        session, actor, [scoped(session, Appointment, actor.business_id, identifier)], full=True
    )[0]


def list_records(session, actor, start, end, status, client_id, barber_id, limit, offset):
    if (
        start
        and (start.tzinfo is None or start.utcoffset() is None)
        or end
        and (end.tzinfo is None or end.utcoffset() is None)
    ):
        raise HTTPException(422, "Date filters need an explicit offset")
    if start and end and (start >= end or end - start > timedelta(days=366)):
        raise HTTPException(422, "Invalid date range")
    filters = [Appointment.business_id == actor.business_id]
    if start:
        filters.append(Appointment.scheduled_end > start)
    if end:
        filters.append(Appointment.scheduled_start < end)
    if status:
        filters.append(Appointment.status == status)
    if client_id:
        scoped(session, Client, actor.business_id, client_id)
        filters.append(Appointment.client_id == client_id)
    if barber_id:
        scoped(session, Barber, actor.business_id, barber_id)
        filters.append(Appointment.barber_id == barber_id)
    total = session.scalar(select(func.count()).select_from(Appointment).where(*filters))
    records = session.scalars(
        select(Appointment)
        .where(*filters)
        .order_by(Appointment.scheduled_start, Appointment.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return dict(items=projections(session, actor, records), total=total, limit=limit, offset=offset)
