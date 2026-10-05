from datetime import time
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.models import BusinessHours
from app.business_hours.router import DayData
from app.public import router as public_router
from app.availability import service
from app.core.config import Settings
from test_auth import auth_client, signing, headers
from test_phase5 import booking, post


def split_day(**patch):
    return dict(day_of_week=0, is_closed=False, opening_time='08:00', closing_time='19:00', break_start='12:00', break_end='14:00', **patch)


@pytest.mark.parametrize('patch', [dict(break_start=None), dict(break_end=None), dict(break_start='08:00'), dict(break_end='19:00'), dict(break_start='15:00'), dict(break_start='12:00+02:00')])
def test_invalid_breaks_rejected(patch):
    with pytest.raises(ValueError):
        DayData(**{**split_day(), **patch})


def test_owner_split_week_and_staff_read(auth_client):
    client, sign, _, staff, _, _, _ = auth_client
    days = [dict(split_day(), day_of_week=i, is_closed=i in (0, 6)) for i in range(7)]
    response = client.put('/business-hours', json={'days': days}, headers=headers(sign()))
    assert response.status_code == 200
    assert response.json()[1]['break_start'] == '12:00:00'
    assert response.json()[0]['break_end'] is None
    assert client.get('/business-hours', headers=headers(sign(staff))).json() == response.json()
    assert client.put('/business-hours', json={'days': days}, headers=headers(sign(staff))).status_code == 403
    days[1]['break_end'] = '07:00'
    assert client.put('/business-hours', json={'days': days}, headers=headers(sign())).status_code == 422
    assert client.get('/business-hours', headers=headers(sign())).json() == response.json()


@pytest.fixture
def split_booking(booking):
    with Session(booking[0][-1]) as session:
        day = session.scalar(select(BusinessHours).where(BusinessHours.business_id == booking[0][5], BusinessHours.day_of_week == 0))
        day.opening_time, day.closing_time = time(8), time(19)
        day.break_start, day.break_end = time(12), time(14)
        session.commit()
    return booking


@pytest.mark.parametrize('start,expected', [('08:00',201), ('11:30',201), ('11:45',409), ('12:00',409), ('13:45',409), ('14:00',201), ('18:30',201), ('19:00',409)])
def test_appointments_fit_one_period(split_booking, start, expected):
    response = post(split_booking, scheduled_start=f'2026-10-05T{start}:00+02:00')
    assert response.status_code == expected
    if expected == 409:
        assert response.json()['detail']['code'] == 'outside_business_hours'


def test_availability_and_public_hours_exclude_lunch(split_booking, monkeypatch):
    settings = Settings(_env_file=None, public_business_id=split_booking[0][5])
    monkeypatch.setattr(service, 'get_settings', lambda: settings)
    monkeypatch.setattr(public_router, 'get_settings', lambda: settings)
    client = split_booking[0][0]
    intervals = client.get('/public/availability', params={'start':'2026-10-05','days':1}).json()['items'][0]['intervals']
    assert len(intervals) == 18
    assert intervals[7]['end'].startswith('2026-10-05T10:00:00')
    assert intervals[8]['start'].startswith('2026-10-05T12:00:00')
    hour = client.get('/public/business').json()['hours'][0]
    assert hour['break_start'] == '12:00:00' and hour['break_end'] == '14:00:00'
    assert set(hour) == {'day_of_week','is_closed','opening_time','closing_time','break_start','break_end'}
