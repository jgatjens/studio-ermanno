"""Availability uses a consistent snapshot without blocking business writers."""
import os
from datetime import date
import pytest
from sqlalchemy import event, select
from sqlalchemy.orm import Session
from app.db.models import Barber
from app.core.config import Settings
from app.db.locking import lock_business
from app.availability import service
from test_phase5_database import race_database
pytestmark=[pytest.mark.database,pytest.mark.skipif(os.getenv('RUN_DATABASE_TESTS')!='1',reason='Set RUN_DATABASE_TESTS=1 for PostgreSQL availability snapshot verification')]

def test_availability_snapshot_and_next_request(race_database,monkeypatch):
    engine,actor,_=race_database
    monkeypatch.setattr(service,'get_settings',lambda:Settings(_env_file=None,public_business_id=actor.business_id))
    updated=[]
    def after_read(connection,cursor,statement,parameters,context,many):
        if 'business_hours' in statement and statement.lstrip().startswith('SELECT') and not updated:
            updated.append(True)
            with Session(engine) as writer:
                lock_business(writer,actor.business_id)
                for row in writer.scalars(select(Barber)):row.is_active=False
                writer.commit()
    event.listen(engine,'after_cursor_execute',after_read)
    try:
        with Session(engine) as reader:
            first=service.availability(reader,date(2026,10,5),1)
        assert updated and first['items'][0]['state']=='AVAILABLE'
    finally:event.remove(engine,'after_cursor_execute',after_read)
    with Session(engine) as reader:
        second=service.availability(reader,date(2026,10,5),1)
        assert second['items'][0]['state']=='FULL'
