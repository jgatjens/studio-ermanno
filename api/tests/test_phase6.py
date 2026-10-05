from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4
import pytest
from sqlalchemy import select, func, event
from sqlalchemy.orm import Session
from app.db.models import (Appointment, AppointmentProduct, Product, InventoryMovement, Business, Service, AppointmentStatus)
from test_phase5 import booking, auth_client, signing, headers, post

@pytest.fixture
def completion_case(booking):
    auth,data,ids=booking
    client,sign,_,_,_,business_id,engine=auth
    appointment=post(booking).json()
    with Session(engine) as session:
        product=Product(business_id=business_id,name='Original pomade',brand='Brand',category='Styling',cost_price=1,retail_price=3,current_stock=10,minimum_stock=2)
        session.add(product);session.commit();product_id=str(product.id)
    body=dict(service_ids=data['service_ids'],products=[dict(product_id=product_id,usage_type='USED',quantity='1.250'),dict(product_id=product_id,usage_type='SOLD',quantity='2')],visit_notes=' Private visit ')
    return booking,appointment,body,product_id

def send(case,body=None,user=None):
    booking,appointment,original,_=case
    client,sign,*_=booking[0]
    return client.post('/appointments/'+appointment['id']+'/complete',json=original if body is None else body,headers=headers(sign() if user is None else sign(user)))

@pytest.mark.parametrize('case',['missing','invalid','expired','outsider','staff'])
def test_auth(completion_case,case):
    booking,appointment,body,_=completion_case
    client,sign,_,staff,outsider,*_=booking[0]
    auth={} if case=='missing' else headers('bad' if case=='invalid' else sign(exp=datetime.now(timezone.utc)-timedelta(minutes=1)) if case=='expired' else sign(outsider if case=='outsider' else staff))
    assert client.post('/appointments/'+appointment['id']+'/complete',json=body,headers=auth).status_code==(403 if case in ['outsider','staff'] else 401)

@pytest.mark.parametrize('patch',[{'service_ids':[]},{'service_ids':[str(uuid4())]*2},{'visit_notes':'x'*10001},{'business_id':str(uuid4())},{'status':'COMPLETED'},{'final_price':0}])
def test_command_validation(completion_case,patch):
    assert send(completion_case,{**completion_case[2],**patch}).status_code==422

@pytest.mark.parametrize('patch',[{'quantity':'0'},{'quantity':'-1'},{'quantity':'1.0001'},{'quantity':'1000000000'},{'usage_type':'DAMAGED'},{'product_name_snapshot':'Forged'},{'quantity':'NaN'}])
def test_product_validation(completion_case,patch):
    body=completion_case[2]
    assert send(completion_case,{**body,'products':[{**body['products'][0],**patch}]}).status_code==422

def test_duplicates_and_stale_service_review(completion_case):
    body=completion_case[2]
    assert send(completion_case,{**body,'products':[body['products'][0]]*2}).status_code==422
    assert send(completion_case,{**body,'service_ids':[str(uuid4())]}).json()['detail']['code']=='appointment_changed'


def test_history_privacy_retries_snapshots_and_stock(completion_case):
    booking,appointment,body,product_id=completion_case
    client,sign,_,staff,_,_,engine=booking[0]
    before=appointment.copy()
    first=send(completion_case);assert first.status_code==200,first.text
    completed=first.json();assert completed['status']=='COMPLETED' and completed['visit_notes']=='Private visit'
    for key in ['services','calculated_price','final_price','final_duration_minutes','scheduled_start','scheduled_end','appointment_notes']:
        assert completed[key]==before[key]
    assert send(completion_case).status_code==200
    assert send(completion_case,{**body,'visit_notes':'Different'}).json()['detail']['code']=='already_completed'
    with Session(engine) as session:
        product=session.get(Product,UUID(product_id));assert product.current_stock==Decimal("6.750")
        assert session.scalar(select(func.count()).select_from(InventoryMovement))==2
        assert session.scalar(select(func.count()).select_from(AppointmentProduct))==2
        product.name='Renamed';product.is_active=False
        service=session.get(Service,UUID(body['service_ids'][0]));service.name='Renamed service';service.price=999;service.is_active=False;session.commit()
    retried=send(completion_case);assert retried.status_code==200 and retried.json()==completed
    profile=client.get('/clients/'+booking[1]['client_id'],headers=headers(sign())).json()
    assert profile['last_completed_visit']['id']==appointment['id']
    assert len(profile['last_completed_visit']['products'])==2
    staff_profile=client.get('/clients/'+booking[1]['client_id'],headers=headers(sign(staff))).json()
    assert not {'email','phone','private_notes'} & staff_profile.keys()
    visit=staff_profile['last_completed_visit'];assert 'visit_notes' not in visit
    assert len(visit['products'])==1 and visit['products'][0]['usage_type']=='USED' and visit['products'][0]['name']=='Original pomade'
    detail=client.get('/appointments/'+appointment['id'],headers=headers(sign(staff))).json()
    assert 'visit_notes' not in detail and 'email' not in detail['client'] and len(detail['products'])==1
    assert client.get('/appointments/completion-products',headers=headers(sign(staff))).status_code==403

@pytest.mark.parametrize('status',['SCHEDULED','CONFIRMED','CANCELLED','NO_SHOW'])
def test_statuses_and_empty_products(completion_case,status):
    booking,appointment,body,_=completion_case
    client,sign,*_=booking[0]
    if status!='SCHEDULED':assert client.post('/appointments/'+appointment['id']+'/status',json={'status':status},headers=headers(sign())).status_code==200
    result=send(completion_case,dict(service_ids=body['service_ids'],visit_notes=' '))
    assert result.status_code==(200 if status in ['SCHEDULED','CONFIRMED'] else 409)
    if result.status_code==200:assert result.json()['products']==[] and result.json()['visit_notes'] is None
    assert client.post('/appointments/'+appointment['id']+'/status',json={'status':'COMPLETED'},headers=headers(sign())).status_code==422


def test_product_selector_and_isolation(completion_case):
    booking,appointment,body,product_id=completion_case
    client,sign,_,_,_,business_id,engine=booking[0]
    with Session(engine) as session:
        other=Business(name='Other',timezone='UTC',currency='EUR');session.add(other);session.flush()
        foreign=Product(business_id=other.id,name='Foreign',cost_price=1,retail_price=2)
        inactive=Product(business_id=business_id,name='Inactive',is_active=False,cost_price=1,retail_price=2)
        session.add_all([foreign,inactive]);session.commit();foreign_id=str(foreign.id);inactive_id=str(inactive.id)
    selector=client.get('/appointments/completion-products?q=BRAND',headers=headers(sign())).json()
    assert selector['total']==1 and set(selector['items'][0])=={'id','name','brand','category'}
    assert client.get('/appointments/completion-products?q=%25',headers=headers(sign())).json()['total']==0
    for suffix in ['?limit=0','?limit=101','?offset=-1','?q='+'x'*201]:
        assert client.get('/appointments/completion-products'+suffix,headers=headers(sign())).status_code==422
    for identifier in [foreign_id,str(uuid4())]:
        assert send(completion_case,{**body,'products':[{**body['products'][0],'product_id':identifier}]}).status_code==404
    assert send(completion_case,{**body,'products':[{**body['products'][0],'product_id':inactive_id}]}).json()['detail']['code']=='inactive_reference'
    assert client.post('/appointments/'+str(uuid4())+'/complete',json=body,headers=headers(sign())).status_code==404
    with Session(engine) as session:
        assert session.get(Appointment,UUID(appointment['id'])).status==AppointmentStatus.SCHEDULED
        assert session.scalar(select(func.count()).select_from(AppointmentProduct))==0


def test_rollback_on_insert_failure(completion_case):
    booking,appointment,body,_=completion_case
    engine=booking[0][-1]
    def fail(session,context,instances):
        if any(isinstance(row,AppointmentProduct) for row in session.new):raise RuntimeError('Synthetic insert failure')
    event.listen(Session,'before_flush',fail)
    try:
        with pytest.raises(RuntimeError,match='Synthetic'):send(completion_case)
    finally:event.remove(Session,'before_flush',fail)
    with Session(engine) as session:
        record=session.get(Appointment,UUID(appointment['id']));assert record.status==AppointmentStatus.SCHEDULED and record.visit_notes is None
        assert session.scalar(select(func.count()).select_from(AppointmentProduct))==0
        assert session.scalar(select(func.count()).select_from(InventoryMovement))==0


def test_preexisting_products_protected(completion_case):
    booking,appointment,body,product_id=completion_case
    with Session(booking[0][-1]) as session:
        session.add(AppointmentProduct(business_id=booking[0][5],appointment_id=UUID(appointment['id']),product_id=UUID(product_id),usage_type='USED',quantity=1,product_name_snapshot='Legacy'));session.commit()
    assert send(completion_case).json()['detail']['code']=='appointment_changed'


def test_latest_visit_and_released_capacity(completion_case):
    booking,appointment,body,_=completion_case
    client,sign,*_=booking[0]
    newer=post(booking,scheduled_start='2026-10-05T11:00:00+02:00').json()
    assert client.post('/appointments/'+newer['id']+'/complete',json={'service_ids':body['service_ids']},headers=headers(sign())).status_code==200
    assert send(completion_case).status_code==200
    profile=client.get('/clients/'+booking[1]['client_id'],headers=headers(sign())).json()
    assert profile['last_completed_visit']['id']==newer['id']
    assert client.get('/clients/'+booking[1]['client_id']+'/history',headers=headers(sign())).json()['total']==2
    assert post(booking).status_code==201

def test_retained_inactive_services_and_canonical_retry(completion_case):
    booking,appointment,body,product_id=completion_case
    with Session(booking[0][-1]) as session:
        service=session.get(Service,UUID(body['service_ids'][0]));service.is_active=False;service.price=99;service.name='New definition';session.commit()
    assert send(completion_case).status_code==200
    reversed_body={**body,'products':list(reversed(body['products'])),'visit_notes':'Private visit'}
    reversed_body['products'][1]={**reversed_body['products'][1],'quantity':'1.25'}
    assert send(completion_case,reversed_body).status_code==200
    values=send(completion_case).json();assert values['services']==appointment['services'] and values['final_price']==appointment['final_price']

def test_foreign_appointment_and_entry_limits(completion_case):
    booking,appointment,body,_=completion_case
    client,sign,_,_,_,_,engine=booking[0]
    with Session(engine) as session:
        other=Business(name='Other',timezone='UTC',currency='EUR');session.add(other);session.flush()
        from app.db.models import Client
        customer=Client(business_id=other.id,first_name='Other',last_name='Client');session.add(customer);session.flush()
        start=datetime(2026,10,5,10,tzinfo=timezone.utc)
        record=Appointment(business_id=other.id,client_id=customer.id,scheduled_start=start,scheduled_end=start+timedelta(minutes=30),calculated_duration_minutes=30,final_duration_minutes=30,calculated_price=10,final_price=10)
        session.add(record);session.commit();identifier=str(record.id)
    assert client.post('/appointments/'+identifier+'/complete',json=body,headers=headers(sign())).status_code==404
    assert send(completion_case,{**body,'products':body['products']*26}).status_code==422
