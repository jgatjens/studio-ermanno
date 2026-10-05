"""Completion races use independent PostgreSQL transactions in disposable schemas."""
import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import pytest
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db.models import Product, AppointmentProduct, Appointment, Service, InventoryMovement
from app.appointments.schemas import AppointmentWrite
from app.appointments.completion import CompletionWrite, complete
from app.appointments.service import save, change_status
from test_phase5_database import race_database

pytestmark=[pytest.mark.database,pytest.mark.skipif(os.getenv('RUN_DATABASE_TESTS')!='1',reason='Set RUN_DATABASE_TESTS=1 for PostgreSQL completion races')]

@pytest.mark.parametrize('competitor',['identical','different','cancel','edit'])
def test_completion_races(race_database,competitor):
    engine,actor,data=race_database
    with Session(engine) as session:
        identifier=save(session,actor,AppointmentWrite(**data))['id']
        product=Product(business_id=actor.business_id,name='Race product',cost_price=1,retail_price=2,current_stock=10)
        another=Service(business_id=actor.business_id,name='Other service',duration_minutes=20,price=10)
        session.add_all([product,another]);session.commit()
        body=dict(service_ids=data['service_ids'],products=[dict(product_id=product.id,usage_type='USED',quantity='1')],visit_notes='Visit')
        other_service=another.id;product_id=product.id
    gate=Barrier(2)
    def operation(second):
        with Session(engine) as session:
            gate.wait(timeout=10)
            try:
                if second and competitor=='cancel':change_status(session,actor,identifier,'CANCELLED')
                elif second and competitor=='edit':save(session,actor,AppointmentWrite(**{**data,'service_ids':[other_service]}),identifier)
                else:
                    command={**body,'products':[{**body['products'][0],'quantity':'2'}]} if second and competitor=='different' else body
                    complete(session,actor,identifier,CompletionWrite(**command))
                return 200
            except HTTPException as error:return error.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(operation,False),pool.submit(operation,True)]
        results=[future.result(timeout=30) for future in futures]
    assert sorted(results)==([200,200] if competitor=='identical' else [200,409])
    with Session(engine) as session:
        record=session.get(Appointment,identifier)
        expected=1 if record.status.value=='COMPLETED' else 0
        assert session.scalar(select(func.count()).select_from(AppointmentProduct))==expected
        quantity = session.scalar(select(AppointmentProduct.quantity)) or 0
        assert session.get(Product,product_id).current_stock==10-quantity
        assert session.scalar(select(func.count()).select_from(InventoryMovement))==expected
