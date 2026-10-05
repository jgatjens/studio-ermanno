"""Read-only, privacy-safe capacity intervals in the business timezone."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import HTTPException
from sqlalchemy import select, func
from app.core.config import get_settings
from app.db.models import Business, BusinessHours, Barber, Appointment
from app.appointments.scheduling import ACTIVE, utc

INTERVAL_MINUTES = 30


def boundary(day, wall_time, zone, opening):
    local = datetime.combine(day, wall_time)
    candidates = []
    for fold in (0, 1):
        try:
            instant = local.replace(tzinfo=zone, fold=fold).astimezone(timezone.utc)
            roundtrip = instant.astimezone(zone).replace(tzinfo=None)
        except OverflowError:
            raise HTTPException(422, "Availability date range is outside supported dates") from None
        if roundtrip == local:
            candidates.append(instant)
    if not candidates:
        raise HTTPException(503, "Availability hours are unavailable")
    return min(candidates) if opening else max(candidates)


def peak_occupancy(start, end, reservations):
    events = []
    for row in reservations:
        left, right = utc(row.scheduled_start), utc(row.scheduled_end)
        if left < end and right > start:
            events.extend([(max(left, start), 1), (min(right, end), -1)])
    peak = occupied = 0
    for _, delta in sorted(events, key=lambda event: (event[0], event[1])):
        occupied += delta
        peak = max(peak, occupied)
    return peak


def interval_state(capacity, occupied):
    remaining = capacity - occupied
    if remaining <= 0:
        return "FULL"
    if occupied == 0 or remaining >= 2:
        return "AVAILABLE"
    return "LIMITED"


def availability(session, start, days):
    # A fresh anonymous request has not yet started its DB transaction. PostgreSQL
    # snapshot isolation keeps separate configuration/reservation reads coherent.
    if session.get_bind().dialect.name == "postgresql":
        session.connection(execution_options={"isolation_level": "REPEATABLE READ"})
    identifier = get_settings().public_business_id
    business = session.get(Business, identifier) if identifier else None
    if business is None:
        raise HTTPException(503, "Public availability is not configured")
    try:
        zone = ZoneInfo(business.timezone)
    except (ValueError, ZoneInfoNotFoundError):
        raise HTTPException(503, "Availability timezone is unavailable") from None
    start = start or datetime.now(timezone.utc).astimezone(zone).date()
    try:
        dates = [start + timedelta(days=index) for index in range(days)]
    except OverflowError:
        raise HTTPException(422, "Availability date range is outside supported dates") from None
    hours = {
        row.day_of_week: row
        for row in session.scalars(
            select(BusinessHours).where(BusinessHours.business_id == identifier)
        )
    }
    capacity = session.scalar(
        select(func.count())
        .select_from(Barber)
        .where(Barber.business_id == identifier, Barber.is_active.is_(True))
    )
    windows = []
    for day in dates:
        hours_day = hours.get(day.weekday())
        if hours_day is None or hours_day.is_closed:
            windows.append([])
        else:
            left = boundary(day, hours_day.opening_time, zone, True)
            right = boundary(day, hours_day.closing_time, zone, False)
            if right <= left:
                raise HTTPException(503, "Availability hours are unavailable")
            if hours_day.break_start is not None:
                pause = boundary(day, hours_day.break_start, zone, True)
                resume = boundary(day, hours_day.break_end, zone, False)
                if not left < pause < resume < right:
                    raise HTTPException(503, "Availability hours are unavailable")
                windows.append([(left, pause), (resume, right)])
            else:
                windows.append([(left, right)])
    open_windows = [window for periods in windows for window in periods]
    reservations = []
    if open_windows:
        reservations = session.execute(
            select(Appointment.scheduled_start, Appointment.scheduled_end).where(
                Appointment.business_id == identifier,
                Appointment.status.in_(ACTIVE),
                Appointment.scheduled_start < max(window[1] for window in open_windows),
                Appointment.scheduled_end > min(window[0] for window in open_windows),
            )
        ).all()
    items = []
    for day, periods in zip(dates, windows):
        intervals = []
        if periods:
            for left, closing in periods:
                while left < closing:
                    right = min(left + timedelta(minutes=INTERVAL_MINUTES), closing)
                    state = interval_state(capacity, peak_occupancy(left, right, reservations))
                    intervals.append(dict(start=left, end=right, state=state))
                    left = right
            states = {row["state"] for row in intervals}
            state = (
                "AVAILABLE"
                if "AVAILABLE" in states
                else "LIMITED"
                if "LIMITED" in states
                else "FULL"
            )
        else:
            state = "CLOSED"
        items.append(dict(date=day, state=state, intervals=intervals))
    return dict(
        timezone=business.timezone,
        interval_minutes=INTERVAL_MINUTES,
        start=start,
        days=days,
        items=items,
    )
