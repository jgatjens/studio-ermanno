from datetime import datetime, date, timedelta, timezone, time
from uuid import uuid4
import pytest
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.db.models import Appointment, Business, BusinessHours, Barber, Client
from app.core.config import Settings
from app.availability import service
from test_auth import auth_client, signing
from test_phase5 import booking, post


@pytest.fixture
def availability_case(booking, monkeypatch):
    monkeypatch.setattr(
        service, "get_settings", lambda: Settings(_env_file=None, public_business_id=booking[0][5])
    )
    return booking


def read(case, **params):
    return case[0][0].get(
        "/public/availability", params={"start": "2026-10-05", "days": 1, **params}
    )


def slot(case, index=2):
    response = read(case)
    assert response.status_code == 200, response.text
    return response.json()["items"][0]["intervals"][index]["state"]


def reservation(case, start, end, barber=None, status="SCHEDULED"):
    with Session(case[0][-1]) as session:
        row = Appointment(
            business_id=case[0][5],
            client_id=case[1]["client_id"],
            barber_id=barber,
            scheduled_start=datetime.fromisoformat(start),
            scheduled_end=datetime.fromisoformat(end),
            status=status,
            calculated_duration_minutes=30,
            final_duration_minutes=30,
            calculated_price=1,
            final_price=1,
            appointment_notes="PRIVATE APPOINTMENT",
            visit_notes="PRIVATE VISIT",
        )
        from uuid import UUID

        row.client_id = UUID(row.client_id)
        session.add(row)
        session.commit()


def test_empty_capacity_hours_and_privacy(availability_case):
    case = availability_case
    response = read(case)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    data = response.json()
    assert set(data) == {"timezone", "interval_minutes", "start", "days", "items"}
    assert data["timezone"] == "Europe/Rome" and data["interval_minutes"] == 30
    day = data["items"][0]
    assert set(day) == {"date", "state", "intervals"} and day["state"] == "AVAILABLE"
    assert len(day["intervals"]) == 18 and day["intervals"][0]["start"].startswith(
        "2026-10-05T07:00:00"
    )
    assert all(set(interval) == {"start", "end", "state"} for interval in day["intervals"])
    assert post(case).status_code == 201
    body = read(case).text
    for secret in [
        "Client",
        "Test",
        "secret@example.com",
        "secret phone",
        "Cut",
        "Beard",
        case[1]["client_id"],
        *map(str, case[2]),
    ]:
        assert secret not in body
    assert slot(case) == "LIMITED"


@pytest.mark.parametrize("assigned", [True, False])
def test_assigned_unassigned_full_and_daily_summary(availability_case, assigned):
    case = availability_case
    assert post(case).status_code == 201
    assert slot(case) == "LIMITED"
    assert post(case, barber_id=str(case[2][1]) if assigned else None).status_code == 201
    data = read(case).json()
    assert data["items"][0]["intervals"][2]["state"] == "FULL"
    assert data["items"][0]["state"] == "AVAILABLE"  # Other times remain unused.


@pytest.mark.parametrize("status", ["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"])
def test_status_occupancy(availability_case, status):
    reservation(
        availability_case, "2026-10-05T08:00:00+00:00", "2026-10-05T08:30:00+00:00", status=status
    )
    assert slot(availability_case) == (
        "LIMITED" if status in ["SCHEDULED", "CONFIRMED"] else "AVAILABLE"
    )


@pytest.mark.parametrize("count", [0, 1, 2, 3])
def test_active_capacity_thresholds(availability_case, count):
    case = availability_case
    with Session(case[0][-1]) as session:
        for row in session.scalars(select(Barber)):
            row.is_active = False
        for i in range(count):
            session.add(Barber(business_id=case[0][5], name="Private barber " + str(i)))
        session.commit()
    assert slot(case) == ("FULL" if count == 0 else "AVAILABLE")
    reservation(case, "2026-10-05T08:00:00+00:00", "2026-10-05T08:30:00+00:00", barber=case[2][0])
    assert slot(case) == ("FULL" if count <= 1 else "LIMITED" if count == 2 else "AVAILABLE")


def test_peak_half_open_back_to_back_and_clipping(availability_case):
    case = availability_case
    for start, end in [
        ("07:45", "08:15"),
        ("08:15", "08:30"),
        ("07:30", "08:00"),
        ("08:30", "09:00"),
    ]:
        reservation(case, "2026-10-05T" + start + ":00+00:00", "2026-10-05T" + end + ":00+00:00")
    assert slot(case) == "LIMITED"  # Neither touching ends nor successive bookings overlap.
    reservation(case, "2026-10-05T08:10:00+00:00", "2026-10-05T08:20:00+00:00")
    assert slot(case) == "FULL"


@pytest.mark.parametrize(
    "scenario", ["closed", "missing", "all_full", "all_limited", "no_barbers", "partial"]
)
def test_daily_states_and_shared_hours(availability_case, scenario):
    case = availability_case
    with Session(case[0][-1]) as session:
        hours = session.scalar(select(BusinessHours).where(BusinessHours.day_of_week == 0))
        if scenario == "closed":
            hours.is_closed = True
        if scenario == "missing":
            session.delete(hours)
        if scenario == "partial":
            hours.opening_time = time(9, 5)
            hours.closing_time = time(9, 50)
        if scenario == "no_barbers":
            for row in session.scalars(select(Barber)):
                row.is_active = False
        session.commit()
    if scenario in ["all_full", "all_limited"]:
        reservation(case, "2026-10-05T06:00:00+00:00", "2026-10-05T17:00:00+00:00")
        if scenario == "all_full":
            reservation(case, "2026-10-05T06:00:00+00:00", "2026-10-05T17:00:00+00:00")
    day = read(case).json()["items"][0]
    expected = {
        "closed": "CLOSED",
        "missing": "CLOSED",
        "all_full": "FULL",
        "all_limited": "LIMITED",
        "no_barbers": "FULL",
        "partial": "AVAILABLE",
    }[scenario]
    assert day["state"] == expected
    if scenario in ["closed", "missing"]:
        assert day["intervals"] == []
    if scenario == "partial":
        assert len(day["intervals"]) == 2
        assert day["intervals"][0]["start"].startswith("2026-10-05T07:05:00")
        assert day["intervals"][1]["end"].startswith("2026-10-05T07:50:00")


@pytest.mark.parametrize(
    "params",
    [
        {"start": "bad"},
        {"start": "2026-02-30"},
        {"days": 0},
        {"days": 15},
        {"days": 1.5},
        {"start": "9999-12-31", "days": 14},
    ],
)
def test_range_validation(availability_case, params):
    assert read(availability_case, **params).status_code == 422


def test_range_closed_sunday_and_read_only(availability_case):
    case = availability_case
    data = read(case, days=7).json()
    assert (
        len(data["items"]) == 7
        and data["items"][-1]["date"] == "2026-10-11"
        and data["items"][-1]["state"] == "CLOSED"
    )
    for method in ["post", "put", "delete"]:
        assert getattr(case[0][0], method)("/public/availability").status_code == 405
    with Session(case[0][-1]) as session:
        assert session.scalar(select(func.count()).select_from(Appointment)) == 0


@pytest.mark.parametrize("missing", [True, False])
def test_missing_public_configuration(availability_case, monkeypatch, missing):
    monkeypatch.setattr(
        service,
        "get_settings",
        lambda: Settings(_env_file=None, public_business_id=None if missing else uuid4()),
    )
    assert read(availability_case).status_code == 503


def test_tenant_isolation(availability_case):
    case = availability_case
    with Session(case[0][-1]) as session:
        other = Business(name="Foreign", timezone="UTC", currency="EUR")
        session.add(other)
        session.flush()
        client = Client(business_id=other.id, first_name="FOREIGN PRIVATE", last_name="Client")
        session.add(client)
        session.flush()
        session.add(
            Appointment(
                business_id=other.id,
                client_id=client.id,
                scheduled_start=datetime(2026, 10, 5, 7, tzinfo=timezone.utc),
                scheduled_end=datetime(2026, 10, 5, 20, tzinfo=timezone.utc),
                calculated_duration_minutes=30,
                final_duration_minutes=30,
                calculated_price=1,
                final_price=1,
            )
        )
        for i in range(5):
            session.add(Barber(business_id=other.id, name="Foreign " + str(i)))
        session.commit()
        other_id = other.id
    assert slot(case) == "AVAILABLE"
    assert post(case).status_code == 201 and slot(case) == "LIMITED"
    assert "FOREIGN" not in read(case).text
    assert (
        read(case, business_id=str(other_id)).json()["items"][0]["intervals"][2]["state"]
        == "LIMITED"
    )


@pytest.mark.parametrize(
    "day,opening,closing,count",
    [
        ("2026-03-29", time(1), time(4), 4),
        ("2026-10-25", time(1), time(4), 8),
        ("2026-10-25", time(2), time(3), 4),
    ],
)
def test_dst_elapsed_intervals(availability_case, day, opening, closing, count):
    case = availability_case
    with Session(case[0][-1]) as session:
        hours = session.scalar(select(BusinessHours).where(BusinessHours.day_of_week == 6))
        hours.is_closed = False
        hours.opening_time = opening
        hours.closing_time = closing
        session.commit()
    response = read(case, start=day)
    assert response.status_code == 200, response.text
    intervals = response.json()["items"][0]["intervals"]
    assert len(intervals) == count
    assert len({row["start"] for row in intervals}) == count
    for left, right in zip(intervals, intervals[1:]):
        assert left["end"] == right["start"]


@pytest.mark.parametrize("scenario", ["gap", "invalid_zone"])
def test_invalid_hours_timezone_fail_safely(availability_case, scenario):
    case = availability_case
    with Session(case[0][-1]) as session:
        if scenario == "invalid_zone":
            session.get(Business, case[0][5]).timezone = "Not/AZone"
        else:
            hours = session.scalar(select(BusinessHours).where(BusinessHours.day_of_week == 6))
            hours.is_closed = False
            hours.opening_time = time(2, 15)
            hours.closing_time = time(4)
        session.commit()
    assert read(case, start="2026-03-29").status_code == 503


def test_default_today_is_business_local(availability_case, monkeypatch):
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 10, 4, 23, 30, tzinfo=timezone.utc)

    monkeypatch.setattr(service, "datetime", Clock)
    result = availability_case[0][0].get("/public/availability?days=1").json()
    assert result["start"] == "2026-10-05"


def test_boundary_date_overflow_returns_validation_error(availability_case):
    case = availability_case
    with Session(case[0][-1]) as session:
        session.get(Business, case[0][5]).timezone = "America/New_York"
        for hours in session.scalars(select(BusinessHours)):
            hours.is_closed = False
            hours.opening_time = time(9)
            hours.closing_time = time(23, 30)
        session.commit()
    assert read(case, start="9999-12-31").status_code == 422
