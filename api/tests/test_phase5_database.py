"""PostgreSQL-only scheduling races with independently committed transactions."""
import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from datetime import time
from threading import Barrier, Event
from uuid import uuid4
import pytest
from fastapi import HTTPException
from sqlalchemy import text, select, func, event
from sqlalchemy.orm import Session
from app.db.session import Base, get_engine
from app.db.models import Business, Client, Barber, Service, BusinessHours, Appointment, AppointmentService, MembershipRole
from app.db.locking import lock_business
from app.auth.dependencies import AuthenticatedActor
from app.appointments.schemas import AppointmentWrite
from app.appointments.service import save

pytestmark=[pytest.mark.database,pytest.mark.skipif(os.getenv('RUN_DATABASE_TESTS')!='1',reason='Set RUN_DATABASE_TESTS=1 for PostgreSQL concurrency tests')]

@pytest.fixture
def race_database():
    engine=get_engine();schema='phase5_test_'+uuid4().hex
    with engine.begin() as connection:connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    isolated=engine.execution_options(schema_translate_map={None:schema})
    try:
        Base.metadata.create_all(isolated)
        business_id=uuid4();actor=AuthenticatedActor(uuid4(),uuid4(),business_id,MembershipRole.OWNER)
        with Session(isolated) as session:
            session.add(Business(id=business_id,name='Race',timezone='Europe/Rome',currency='EUR'));session.flush()
            customer=Client(business_id=business_id,first_name='Disposable',last_name='Client')
            barber=Barber(business_id=business_id,name='One')
            service=Service(business_id=business_id,name='Cut',duration_minutes=30,price=20)
            session.add_all([customer,barber,service]);session.flush()
            session.add(BusinessHours(business_id=business_id,day_of_week=0,opening_time=time(9),closing_time=time(18),is_closed=False));session.commit()
            data=dict(client_id=customer.id,service_ids=[service.id],barber_id=barber.id,scheduled_start='2026-10-05T10:00:00+02:00')
        yield isolated,actor,data
    finally:
        with engine.begin() as connection:connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))

@pytest.mark.parametrize('assigned',[True,False])
@pytest.mark.parametrize('editing',[False,True])
def test_last_slot_race(race_database,assigned,editing):
    engine,actor,data=race_database
    if not assigned:data={**data,'barber_id':None}
    identifiers=[None,None]
    if editing:
        for i in range(2):
            with Session(engine) as session:
                identifiers[i]=save(session,actor,AppointmentWrite(**{**data,'scheduled_start':f'2026-10-05T{11+i}:00:00+02:00'}))['id']
    gate=Barrier(2)
    def compete(identifier):
        with Session(engine) as session:
            gate.wait(timeout=10)
            try:save(session,actor,AppointmentWrite(**data),identifier);return 201
            except HTTPException as error:return error.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(compete,identifier) for identifier in identifiers]
        results=[future.result(timeout=30) for future in futures]
    assert sorted(results)==[201,409]
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Appointment))==(2 if editing else 1)
        assert session.scalar(select(func.count()).select_from(AppointmentService))==(2 if editing else 1)


def test_configuration_lock_and_current_catalog(race_database):
    engine,actor,data=race_database
    attempting=Event()
    def observe(connection,cursor,statement,parameters,context,many):
        if 'FOR UPDATE' in statement and 'businesses' in statement:attempting.set()
    with Session(engine) as configuration:
        lock_business(configuration,actor.business_id)
        configuration.get(Service,data['service_ids'][0]).duration_minutes=45
        configuration.flush()
        event.listen(engine,'before_cursor_execute',observe)
        try:
            with ThreadPoolExecutor(max_workers=1) as pool:
                def booking():
                    with Session(engine) as session:return save(session,actor,AppointmentWrite(**data))
                future=pool.submit(booking)
                try:
                    assert attempting.wait(timeout=10)
                    with pytest.raises(TimeoutError):future.result(timeout=.2)
                finally:
                    configuration.commit()
                assert future.result(timeout=20)['calculated_duration_minutes']==45
        finally:event.remove(engine,'before_cursor_execute',observe)
