from datetime import datetime, timedelta, timezone, time
from decimal import Decimal
from uuid import uuid4
import pytest
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db.models import Appointment, AppointmentService, Business, BusinessHours, Client, Barber, Service
from test_auth import auth_client, signing, headers

@pytest.fixture
def booking(auth_client):
    client, sign, owner, staff, outsider, business_id, engine = auth_client
    with Session(engine) as session:
        customer=Client(business_id=business_id,first_name='Client',last_name='Test',email='secret@example.com',phone='secret phone',private_notes='private')
        barbers=[Barber(business_id=business_id,name='One'),Barber(business_id=business_id,name='Two')]
        services=[Service(business_id=business_id,name='Cut',duration_minutes=30,price=Decimal('20')),Service(business_id=business_id,name='Beard',duration_minutes=15,price=Decimal('5'))]
        session.add_all([customer,*barbers,*services]);session.flush()
        for day in range(7):session.add(BusinessHours(business_id=business_id,day_of_week=day,opening_time=time(9),closing_time=time(18),is_closed=day==6))
        session.commit()
        data=dict(client_id=str(customer.id),scheduled_start='2026-10-05T10:00:00+02:00',service_ids=[str(services[0].id)],barber_id=str(barbers[0].id))
        ids=[barber.id for barber in barbers]+[service.id for service in services]
    return auth_client,data,ids

def post(booking,**patch):
    (client,sign,*_),data,_=booking
    return client.post('/appointments',json={**data,**patch},headers=headers(sign()))

@pytest.mark.parametrize('case',['missing','invalid','expired','outsider'])
def test_authentication(booking,case):
    (client,sign,_,_,outsider,*_),_,_=booking
    auth={} if case=='missing' else headers('bad' if case=='invalid' else sign(exp=datetime.now(timezone.utc)-timedelta(minutes=1)) if case=='expired' else sign(outsider))
    assert client.get('/appointments',headers=auth).status_code==(403 if case=='outsider' else 401)

@pytest.mark.parametrize('patch',[{'service_ids':[]},{'client_id':None},{'scheduled_start':'2026-10-05T10:00'},{'scheduled_start':'2026-10-05T10:00:01Z'},{'duration_override_minutes':0},{'duration_override_minutes':1.5},{'price_override':'1.001'},{'price_override':'-1'},{'business_id':str(uuid4())},{'status':'COMPLETED'},{'visit_notes':'secret'}])
def test_validation(booking,patch):
    assert post(booking,**patch).status_code==422

def test_calculation_preview_overrides_and_staff(booking):
    (client,sign,_,staff,_,_,engine),data,ids=booking
    data['service_ids'].append(str(ids[3]))
    response=client.post('/appointments/preview',json={**data,'price_override':'0','duration_override_minutes':60},headers=headers(sign()))
    assert response.status_code==200
    values=response.json();assert values['calculated_price']==25 and values['calculated_duration_minutes']==45 and values['final_price']==0
    with Session(engine) as session:assert session.scalar(select(func.count()).select_from(Appointment))==0
    created=post(booking,price_override='0',duration_override_minutes=60);assert created.status_code==201,created.text
    record=created.json();assert datetime.fromisoformat(record['scheduled_end'].replace('Z','+00:00'))==datetime(2026,10,5,9,tzinfo=timezone.utc) and record['final_price']==0
    assert client.get('/appointments/context',headers=headers(sign(staff))).json()=={'timezone':'Europe/Rome','currency':'EUR'}
    assert client.get('/appointments',headers=headers(sign(staff))).json()['total']==1
    detail=client.get('/appointments/'+record['id'],headers=headers(sign(staff))).json()
    assert 'email' not in detail['client'] and 'phone' not in detail['client'] and 'visit_notes' not in detail
    for path,method,body in [('/appointments','post',data),('/appointments/preview','post',data),('/appointments/'+record['id'],'put',data),('/appointments/'+record['id']+'/status','post',{'status':'CANCELLED'})]:
        assert getattr(client,method)(path,json=body,headers=headers(sign(staff))).status_code==403
    assert client.delete('/appointments/'+record['id'],headers=headers(sign())).status_code==405

def test_conflicts_and_release(booking):
    (client,sign,*_),data,ids=booking
    first=post(booking).json()
    assert post(booking).json()['detail']['code']=='barber_conflict'
    assert post(booking,barber_id=str(ids[1])).status_code==201
    assert post(booking,barber_id=None).json()['detail']['code']=='capacity_full'
    assert client.post('/appointments/'+first['id']+'/status',json={'status':'CANCELLED'},headers=headers(sign())).status_code==200
    assert post(booking,barber_id=None).status_code==201
    assert post(booking,scheduled_start='2026-10-05T10:30:00+02:00').status_code==201

@pytest.mark.parametrize('start',['2026-10-05T08:59:00+02:00','2026-10-05T17:45:00+02:00','2026-10-11T10:00:00+02:00','2026-10-05T23:00:00+02:00'])
def test_hours(booking,start):
    assert post(booking,scheduled_start=start).json()['detail']['code']=='outside_business_hours'

def test_snapshot_edit_atomicity_and_terminal_status(booking):
    (client,sign,_,_,_,_,engine),data,ids=booking
    value=post(booking).json();path='/appointments/'+value['id']
    with Session(engine) as session:
        service=session.get(Service,ids[2]);service.name='Changed';service.price=99;service.is_active=False;session.commit()
    updated=client.put(path,json={**data,'appointment_notes':'Changed note'},headers=headers(sign()))
    assert updated.status_code==200
    assert updated.json()['services'][0]['name']=='Cut' and updated.json()['calculated_price']==20
    assert post(booking,scheduled_start='2026-10-05T12:00:00+02:00').json()['detail']['code']=='inactive_reference'
    assert client.put(path,json={**data,'scheduled_start':'2026-10-05T08:00:00+02:00','service_ids':[str(ids[3])]},headers=headers(sign())).status_code==409
    assert client.get(path,headers=headers(sign())).json()['calculated_price']==20
    for status in ['CONFIRMED','CONFIRMED','NO_SHOW','NO_SHOW']:
        assert client.post(path+'/status',json={'status':status},headers=headers(sign())).status_code==200
    assert client.put(path,json=data,headers=headers(sign())).status_code==409
    assert client.post(path+'/status',json={'status':'CONFIRMED'},headers=headers(sign())).status_code==409
    assert client.post(path+'/status',json={'status':'COMPLETED'},headers=headers(sign())).status_code==422

def test_isolation_filters_and_inactive_barber(booking):
    (client,sign,_,_,_,_,engine),data,ids=booking
    value=post(booking).json()
    with Session(engine) as session:
        other=Business(name='Other',timezone='UTC',currency='EUR');session.add(other);session.flush()
        foreign=Client(business_id=other.id,first_name='Foreign',last_name='Client');session.add(foreign);session.commit();foreign_id=str(foreign.id)
        session.get(Barber,ids[0]).is_active=False;session.commit()
    assert post(booking,client_id=foreign_id).status_code==404
    assert client.get('/appointments?client_id='+foreign_id,headers=headers(sign())).status_code==404
    assert client.get('/appointments/'+str(uuid4()),headers=headers(sign())).status_code==404
    assert client.post('/appointments/'+value['id']+'/status',json={'status':'CONFIRMED'},headers=headers(sign())).json()['detail']['code']=='inactive_reference'
    assert client.put('/appointments/'+value['id'],json={**data,'appointment_notes':'Still allowed'},headers=headers(sign())).status_code==200
    assert client.put('/appointments/'+value['id'],json={**data,'scheduled_start':'2026-10-05T11:00:00+02:00'},headers=headers(sign())).status_code==409
    for suffix in ['?limit=0','?offset=-1','?from=2026-10-05T10:00:00','?from=2026-10-06T00:00:00Z&to=2026-10-05T00:00:00Z']:
        assert client.get('/appointments'+suffix,headers=headers(sign())).status_code==422
    assert client.get('/appointments?from=2026-10-05T08:30:00Z',headers=headers(sign())).json()['total']==0
    assert client.get('/clients/'+data['client_id']+'/history',headers=headers(sign())).json()['total']==0

def test_sweep_boundaries_and_totals_reset(booking):
    (client,sign,*_),data,ids=booking
    assert post(booking,barber_id=None).status_code==201
    assert post(booking,barber_id=None,scheduled_start='2026-10-05T10:30:00+02:00').status_code==201
    response=post(booking,barber_id=None,duration_override_minutes=60);assert response.status_code==201
    updated=client.put('/appointments/'+response.json()['id'],json={**data,'barber_id':None,'service_ids':[str(ids[3])],'price_override':None,'duration_override_minutes':None},headers=headers(sign()))
    assert updated.status_code==200 and updated.json()['final_duration_minutes']==15 and updated.json()['final_price']==5

@pytest.mark.parametrize('patch',[{'service_ids':'duplicate'},{'duration_override_minutes':1441},{'price_override':'10000000000.00'},{'scheduled_end':'2026-10-05T14:00:00Z'},{'products':[]}])
def test_additional_validation(booking,patch):
    if patch.get('service_ids')=='duplicate':patch={'service_ids':booking[1]['service_ids']*2}
    assert post(booking,**patch).status_code==422

def test_missing_hours_zero_capacity_and_overflow(booking):
    (client,sign,_,_,_,business_id,engine),data,ids=booking
    with Session(engine) as session:
        for barber in session.scalars(select(Barber)):barber.is_active=False
        session.commit()
    assert post(booking,barber_id=None).json()['detail']['code']=='capacity_full'
    with Session(engine) as session:
        session.get(Barber,ids[0]).is_active=True
        day=session.scalar(select(BusinessHours).where(BusinessHours.day_of_week==0));session.delete(day);session.commit()
    assert post(booking).json()['detail']['code']=='outside_business_hours'
    with Session(engine) as session:
        session.get(Service,ids[2]).price=Decimal('9999999999.99');session.commit()
    assert post(booking,service_ids=[str(ids[2]),str(ids[3])]).status_code==422

def test_completed_detail_privacy_and_immutable(booking):
    from app.db.models import Product, AppointmentProduct, AppointmentStatus
    (client,sign,_,staff,_,business_id,engine),data,ids=booking
    value=post(booking).json();path='/appointments/'+value['id']
    from uuid import UUID
    with Session(engine) as session:
        record=session.get(Appointment,UUID(value['id']));record.status=AppointmentStatus.COMPLETED;record.visit_notes='Private visit'
        product=Product(business_id=business_id,name='Shampoo',cost_price=1,retail_price=2);session.add(product);session.flush()
        for usage in ['USED','SOLD']:session.add(AppointmentProduct(business_id=business_id,appointment_id=record.id,product_id=product.id,product_name_snapshot='Old shampoo',quantity=1,usage_type=usage))
        session.commit()
    owner=client.get(path,headers=headers(sign())).json();staff_data=client.get(path,headers=headers(sign(staff))).json()
    assert owner['visit_notes']=='Private visit' and len(owner['products'])==2
    assert 'visit_notes' not in staff_data and 'private_notes' not in staff_data['client']
    assert len(staff_data['products'])==1 and staff_data['products'][0]['usage_type']=='USED'
    assert client.put(path,json=data,headers=headers(sign())).status_code==409
    assert client.post(path+'/status',json={'status':'CANCELLED'},headers=headers(sign())).status_code==409
    assert client.get('/clients/'+data['client_id']+'/history',headers=headers(sign())).json()['total']==1


def test_timezone_boundary_and_offsets(booking):
    from app.appointments.scheduling import check_hours
    from types import SimpleNamespace
    hours=[SimpleNamespace(day_of_week=6,is_closed=False,opening_time=time(1),closing_time=time(4))]
    # Both occurrences of 02:30 local are valid explicit instants; duration is elapsed time.
    for start in [datetime(2026,10,25,0,30,tzinfo=timezone.utc),datetime(2026,10,25,1,30,tzinfo=timezone.utc)]:
        check_hours(start,start+timedelta(minutes=15),'Europe/Rome',hours)
    assert post(booking,scheduled_start='2026-10-05T07:00:00Z').status_code==201
    assert post(booking,scheduled_start='2026-10-05T17:30:00+02:00').status_code==201
