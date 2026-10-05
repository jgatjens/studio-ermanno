from datetime import timezone
from zoneinfo import ZoneInfo
from fastapi import HTTPException

ACTIVE = ("SCHEDULED", "CONFIRMED")


def conflict(code, message):
    raise HTTPException(409, {"code": code, "message": message})


def utc(value):
    # SQLite test fixtures lose offsets; production PostgreSQL retains them.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def check_hours(start, end, zone, hours):
    start, end = utc(start).astimezone(ZoneInfo(zone)), utc(end).astimezone(ZoneInfo(zone))
    day = next((day for day in hours if day.day_of_week == start.weekday()), None)
    if (day is None or day.is_closed or start.date() != end.date()
            or start.time() < day.opening_time or end.time() > day.closing_time):
        conflict("outside_business_hours", "Appointment must fit within an open business day.")


def check_capacity(start, end, barber_id, active_barbers, reservations):
    start, end = utc(start), utc(end)
    events = [(start, 1), (end, -1)]
    for row in reservations:
        row_start, row_end = utc(row.scheduled_start), utc(row.scheduled_end)
        if row_start >= end or row_end <= start:
            continue
        if barber_id is not None and row.barber_id == barber_id:
            conflict("barber_conflict", "This barber already has an appointment at that time.")
        events += [(max(start, row_start), 1), (min(end, row_end), -1)]
    occupancy = 0
    for _, delta in sorted(events, key=lambda event: (event[0], event[1])):
        occupancy += delta
        if occupancy > active_barbers:
            conflict("capacity_full", "No barber capacity remains at that time.")
