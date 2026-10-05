import { FormError } from '../form-error'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { ApiError, apiRequest } from '@/lib/api'
import { useAdminKey } from '../query-provider'
import { displayTime, localStamp, nextDate, timeChoices, toInstant } from './time'
import type { Appointment, Barber, CatalogService, Client, Context, Page, Totals } from './types'
import { ArrowRight, CalendarDays, Clock, Plus, Scissors, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
const field = 'block w-full min-w-0 rounded border p-3'
const action = 'rounded border px-3 py-2'
function ErrorView({error,retry}:{error:Error;retry:()=>void}) {return <div role="alert"><p>{error instanceof ApiError&&error.status===404?'Appointment not found.':error.message}</p><button type="button" className={action} onClick={retry}>Retry</button></div>}
function Pagination({offset,total,setOffset}:{offset:number;total:number;setOffset:(n:number)=>void}) {
  return <div className="appointment-pagination"><p className="text-sm text-muted-foreground">{total} appointments</p><div className="flex gap-2"><Button variant="outline" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous</Button><Button variant="outline" disabled={offset+25>=total} onClick={()=>setOffset(offset+25)}>Next</Button></div></div>
}
const statusNames: Record<string,string> = { SCHEDULED:'Scheduled', CONFIRMED:'Confirmed', COMPLETED:'Completed', CANCELLED:'Cancelled', NO_SHOW:'No-show' }
function appointmentTime(instant:string, timezone:string) { return new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(instant)) }
function appointmentDate(day:string) { return new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(day+'T12:00:00Z')) }
function AppointmentCards({items,context}:{items:Appointment[];context:Context}) {
  const groups = new Map<string, Appointment[]>()
  for (const item of items) { const day=localStamp(item.scheduled_start,context.timezone).slice(0,10);groups.set(day,[...(groups.get(day)||[]),item]) }
  return <div className="space-y-6">{Array.from(groups,([day,appointments])=><section key={day} className="space-y-3"><h2 className="appointment-day-heading">{appointmentDate(day)}</h2><ul className="appointment-list">{appointments.map(item=><li key={item.id}><Card className="appointment-card"><Link className="appointment-card-link" to={`/admin/appointments/${item.id}`} aria-label={`${item.client.first_name} ${item.client.last_name}`}>
    <div className="appointment-time"><strong>{appointmentTime(item.scheduled_start,context.timezone)}</strong><span>to {appointmentTime(item.scheduled_end,context.timezone)}</span><span className="appointment-duration"><Clock size={14} aria-hidden="true"/>{item.final_duration_minutes} min</span></div>
    <div className="appointment-card-body"><div className="appointment-card-heading"><h3>{item.client.first_name} {item.client.last_name}</h3><Badge variant="outline" className="appointment-status" data-status={item.status}>{statusNames[item.status]||item.status}</Badge></div>
      <p className="appointment-service"><Scissors size={16} aria-hidden="true"/><span>{item.main_service?.name||'No service recorded'}</span></p>
      <div className="appointment-meta"><span className={item.barber?'':'appointment-unassigned'}><UserRound size={16} aria-hidden="true"/>{item.barber?.name||'Unassigned'}</span><span>{item.final_price} {context.currency}</span></div>
    </div><ArrowRight className="appointment-open-icon" size={18} aria-hidden="true"/>
  </Link></Card></li>)}</ul></section>)}</div>
}
function useContext() {const key=useAdminKey('appointments');return useQuery({queryKey:[...key,'context'],queryFn:({signal})=>apiRequest<Context>('/appointments/context',{signal})})}
export function AppointmentsPage() {
  const context=useContext()
  if(context.isPending)return <p role="status">Loading business timezone…</p>
  if(context.isError)return <ErrorView error={context.error} retry={()=>void context.refetch()}/>
  return <AppointmentList context={context.data}/>
}
function AppointmentList({context}:{context:Context}) {
  const owner=useAuth().actor?.role==='OWNER';const key=useAdminKey('appointments')
  const today=localStamp(new Date(),context.timezone).slice(0,10)
  const [from,setFrom]=useState(today);const [to,setTo]=useState(today);const [status,setStatus]=useState('');const [offset,setOffset]=useState(0)
  let dateError='';let params=new URLSearchParams({limit:'25',offset:String(offset)})
  try {if(from>to)throw new Error('End date must follow start date.');params.set('from',timeChoices(from+'T00:00',context.timezone)[0]?.instant||toInstant(from+'T00:00',context.timezone));params.set('to',timeChoices(nextDate(to)+'T00:00',context.timezone)[0]?.instant||toInstant(nextDate(to)+'T00:00',context.timezone))}catch(error){dateError=(error as Error).message}
  if(status)params.set('status',status)
  const query=useQuery({queryKey:[...key,'list',params.toString()],enabled:!dateError,queryFn:({signal})=>apiRequest<Page<Appointment>>('/appointments?'+params,{signal})})
  function resetFilters() {setFrom(today);setTo(today);setStatus('');setOffset(0)}
  return <section className="appointments-workspace space-y-6">
    <div className="appointment-page-heading"><div><h1>Appointments</h1><p className="text-sm text-muted-foreground">Review the schedule and open an appointment for details.</p></div>{owner&&<Button asChild><Link to="/admin/appointments/new"><Plus size={18} aria-hidden="true"/>Create appointment</Link></Button>}</div>
    <Card><CardContent>
      <div className="appointment-filter-heading"><div><p className="font-medium">Schedule filters</p><p className="text-sm text-muted-foreground">Business timezone: {context.timezone}</p></div><Button variant="outline" onClick={()=>{setFrom(today);setTo(today);setOffset(0)}}><CalendarDays size={16} aria-hidden="true"/>Today</Button></div>
      <div className="appointment-filters"><Field><FieldLabel htmlFor="appointments-from">From date</FieldLabel><Input className="h-11" id="appointments-from" type="date" required value={from} aria-invalid={!!dateError} aria-describedby={dateError?'appointments-date-error':undefined} onChange={e=>{setFrom(e.target.value);setOffset(0)}}/></Field>
        <Field><FieldLabel htmlFor="appointments-to">Through date</FieldLabel><Input className="h-11" id="appointments-to" type="date" required value={to} aria-invalid={!!dateError} aria-describedby={dateError?'appointments-date-error':undefined} onChange={e=>{setTo(e.target.value);setOffset(0)}}/></Field>
        <Field><FieldLabel htmlFor="appointments-status">Status</FieldLabel><NativeSelect className="h-11" id="appointments-status" value={status} onChange={e=>{setStatus(e.target.value);setOffset(0)}}><NativeSelectOption value="">All statuses</NativeSelectOption>{Object.entries(statusNames).map(([value,label])=><NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></Field>
      </div>
      <div className="appointment-filter-footer"><p className="text-xs text-muted-foreground">Dates and times follow the business timezone.</p><Button variant="outline" onClick={resetFilters}>Reset filters</Button></div>
      {dateError&&<p role="alert" id="appointments-date-error">{dateError}</p>}
    </CardContent></Card>
    {dateError?null:query.isPending?<div role="status"><span className="sr-only">Loading appointments…</span><div className="space-y-3" aria-hidden="true">{Array.from({length:3},(_,i)=><Skeleton key={i} className="h-32 rounded-xl" />)}</div></div>:query.isError?<ErrorView error={query.error} retry={()=>void query.refetch()}/>:<>
      {query.data.items.length>0?<AppointmentCards items={query.data.items} context={context}/>:<Card><CardContent className="appointment-empty"><CalendarDays size={32} aria-hidden="true"/><h2>No appointments in this range.</h2><p className="text-sm text-muted-foreground">{status?'Try a different status or reset your filters.':'Choose another date range to explore the schedule.'}</p>{owner&&<Button asChild><Link to="/admin/appointments/new"><Plus size={16} aria-hidden="true"/>Create appointment</Link></Button>}</CardContent></Card>}
      <Pagination offset={offset} total={query.data.total} setOffset={setOffset}/>
    </>}
  </section>
}
export function AppointmentDetailPage() {
  const {appointmentId}=useParams();const owner=useAuth().actor?.role==='OWNER';const key=useAdminKey('appointments');const clientsKey=useAdminKey('clients');const cache=useQueryClient();const context=useContext();const location=useLocation();const [confirm,setConfirm]=useState('')
  const query=useQuery({queryKey:[...key,'detail',appointmentId],queryFn:({signal})=>apiRequest<Appointment>(`/appointments/${appointmentId}`,{signal})})
  const mutation=useMutation({mutationFn:(status:string)=>apiRequest<Appointment>(`/appointments/${appointmentId}/status`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})}),onSuccess:async()=>{setConfirm('');await Promise.all([cache.invalidateQueries({queryKey:key}),cache.invalidateQueries({queryKey:clientsKey})])}})
  if(query.isError||context.isError)return <ErrorView error={query.error||context.error!} retry={()=>{void query.refetch();void context.refetch()}}/>
  if(query.isPending||context.isPending)return <p role="status">Loading appointment…</p>
  const item=query.data;const active=['SCHEDULED','CONFIRMED'].includes(item.status)
  return <section className="space-y-4 break-words"><Link to="/admin/appointments">Back to appointments</Link><h1>Appointment</h1>{location.state?.saved&&<p role="status">Appointment saved.</p>}{location.state?.completed&&<p role="status">Appointment completed.</p>}<Link to={`/admin/clients/${item.client.id}`}>{item.client.first_name} {item.client.last_name}</Link>{owner&&<p>{item.client.email} {item.client.phone}</p>}<p>{displayTime(item.scheduled_start,context.data.timezone)} – {displayTime(item.scheduled_end,context.data.timezone)} ({context.data.timezone})</p><p>{item.status} · {item.barber?.name||'Unassigned'}</p><p>Final: {item.final_duration_minutes} minutes · {item.final_price} {context.data.currency}</p><p>Calculated: {item.calculated_duration_minutes} minutes · {item.calculated_price} {context.data.currency}</p><ul>{item.services.map(s=><li key={s.service_id}>{s.name} · {s.duration_minutes} minutes · {s.price}</li>)}</ul>{item.appointment_notes&&<p>Appointment notes: {item.appointment_notes}</p>}{owner&&item.visit_notes&&<p>Visit notes: {item.visit_notes}</p>}<ul>{item.products.filter(p=>owner||p.usage_type==='USED').map((p,i)=><li key={i}>{p.name} · {p.quantity} · {p.usage_type}</li>)}</ul>{owner&&active&&<div className="flex flex-wrap gap-3"><Link to={`/admin/appointments/${item.id}/edit`}>Edit appointment</Link><Link to={`/admin/appointments/${item.id}/complete`}>Complete appointment</Link>{item.status==='SCHEDULED'&&<button className={action} disabled={mutation.isPending} onClick={()=>mutation.mutate('CONFIRMED')}>Confirm appointment</button>}<button className={`${action} admin-danger`} onClick={()=>setConfirm('CANCELLED')}>Cancel appointment</button><button className={`${action} admin-danger`} onClick={()=>setConfirm('NO_SHOW')}>Mark no-show</button></div>}{confirm&&<div role="group" aria-label="Confirm status change"><p>Change the appointment for {item.client.first_name} {item.client.last_name} to {confirm}? This removes it from active scheduling.</p><button className={action} disabled={mutation.isPending} onClick={()=>mutation.mutate(confirm)}>Yes, change status</button><button className={action} onClick={()=>setConfirm('')}>Keep appointment</button></div>}{mutation.isPending&&<p role="status">Saving status…</p>}{mutation.isSuccess&&<p role="status">Status saved.</p>}{mutation.isError&&<FormError message={mutation.error.message}/>}</section>
}
export function AppointmentFormPage() {
  const owner=useAuth().actor?.role==='OWNER';const {appointmentId}=useParams();const key=useAdminKey('appointments');const context=useContext()
  const query=useQuery({queryKey:[...key,'detail',appointmentId],enabled:owner&&!!appointmentId,queryFn:({signal})=>apiRequest<Appointment>(`/appointments/${appointmentId}`,{signal})})
  if(!owner)return <p role="alert">Access denied.</p>
  if(context.isError||query.isError)return <ErrorView error={context.error||query.error!} retry={()=>{void context.refetch();void query.refetch()}}/>
  if(context.isPending||(appointmentId&&query.isPending))return <p role="status">Loading appointment form…</p>
  if(query.data&&!['SCHEDULED','CONFIRMED'].includes(query.data.status))return <p role="alert">This appointment is read only.</p>
  return <AppointmentForm key={appointmentId||'new'} context={context.data} existing={query.data}/>
}
function AppointmentForm({context,existing}:{context:Context;existing?:Appointment}) {
  const key=useAdminKey('appointments');const clientsKey=useAdminKey('clients');const cache=useQueryClient();const navigate=useNavigate()
  const [client,setClient]=useState<Client|null>(existing?.client||null);const [search,setSearch]=useState('');const [q,setQ]=useState('')
  const [local,setLocal]=useState(existing?localStamp(existing.scheduled_start,context.timezone):'');const [offset,setOffset]=useState(()=>existing?timeChoices(localStamp(existing.scheduled_start,context.timezone),context.timezone).find(c=>c.instant===new Date(existing.scheduled_start).toISOString())?.offset||'':'')
  const [serviceIds,setServiceIds]=useState(existing?.services.map(s=>s.service_id)||[]);const [barber,setBarber]=useState(existing?.barber?.id||'');const [notes,setNotes]=useState(existing?.appointment_notes||'')
  const [duration,setDuration]=useState(existing&&existing.final_duration_minutes!==existing.calculated_duration_minutes?String(existing.final_duration_minutes):'');const [price,setPrice]=useState(existing&&Number(existing.final_price)!==Number(existing.calculated_price)?String(existing.final_price):'')
  const [notice,setNotice]=useState('');const [leaving,setLeaving]=useState(false)
  useEffect(()=>{const timer=setTimeout(()=>setQ(search.trim()),300);return()=>clearTimeout(timer)},[search])
  const clients=useQuery({queryKey:[...clientsKey,'selection',q],queryFn:({signal})=>apiRequest<Page<Client>>(`/clients?q=${encodeURIComponent(q)}&limit=25`,{signal})})
  const services=useQuery({queryKey:[...key,'active-services'],queryFn:({signal})=>apiRequest<CatalogService[]>('/services?active=true',{signal})})
  const barbers=useQuery({queryKey:[...key,'active-barbers'],queryFn:({signal})=>apiRequest<Barber[]>('/barbers?active=true',{signal})})
  const choices=useMemo(()=>timeChoices(local,context.timezone),[local,context.timezone])
  let timeError='';let instant='';if(local)try{instant=toInstant(local,context.timezone,offset)}catch(error){timeError=(error as Error).message}
  const payload={client_id:client?.id,scheduled_start:instant,service_ids:serviceIds,barber_id:barber||null,appointment_notes:notes.trim()||null,duration_override_minutes:duration===''?null:Number(duration),price_override:price===''?null:price}
  const preview=useQuery({queryKey:[...key,'preview',existing?.id,payload],enabled:!!client&&!!instant&&serviceIds.length>0,queryFn:({signal})=>apiRequest<Totals>('/appointments/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,appointment_id:existing?.id||null}),signal}),staleTime:0})
  const mutation=useMutation({mutationFn:()=>apiRequest<Appointment>('/appointments'+(existing?'/'+existing.id:''),{method:existing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),onSuccess:async item=>{await Promise.all([cache.invalidateQueries({queryKey:key}),cache.invalidateQueries({queryKey:clientsKey})]);navigate(`/admin/appointments/${item.id}`,{state:{saved:true}})}})
  const options=[...(services.data||[])];for(const old of existing?.services||[])if(!options.some(s=>s.id===old.service_id))options.push({id:old.service_id,name:old.name,price:old.price,duration_minutes:old.duration_minutes,is_active:false})
  return <section className="space-y-4"><Link to={existing?`/admin/appointments/${existing.id}`:'/admin/appointments'}>Back</Link><h1>{existing?'Edit appointment':'Create appointment'}</h1><p>Business timezone: {context.timezone}</p><form className="space-y-4" onSubmit={event=>{event.preventDefault();setNotice('');if(!client||!instant||!serviceIds.length||!preview.data){setNotice(timeError||'Choose a client, date/time and services, then review the preview.');return}mutation.mutate()}}><label>Search existing client<input className={field} maxLength={200} value={search} onChange={e=>setSearch(e.target.value)}/></label><Link to="/admin/clients/new" onClick={event=>{if(client||local||serviceIds.length||notes||duration||price){event.preventDefault();setLeaving(true)}}}>Create client first</Link>{leaving&&<div role="group" aria-label="Leave appointment draft"><p>Creating a client leaves this appointment form. Unsaved appointment details will be discarded.</p><button type="button" onClick={()=>navigate('/admin/clients/new')}>Leave and create client</button><button type="button" onClick={()=>setLeaving(false)}>Keep editing appointment</button></div>}{clients.isPending||search.trim()!==q?<p>Loading clients…</p>:clients.isError?<ErrorView error={clients.error} retry={()=>void clients.refetch()}/>:<ul>{clients.data.items.map(c=><li key={c.id}><button type="button" className={action} onClick={()=>setClient(c)}>{c.first_name} {c.last_name}</button></li>)}{!clients.data.total&&<li>No matching clients.</li>}</ul>}{client&&<p>Selected client: {client.first_name} {client.last_name}</p>}<label>Business-local date and time<input className={field} type="datetime-local" required aria-invalid={!!timeError} aria-describedby={timeError?'appointment-time-error':undefined} value={local} onChange={e=>{setLocal(e.target.value);setOffset('')}}/></label>{choices.length>1&&<label>UTC offset<select className={field} value={offset} onChange={e=>setOffset(e.target.value)}><option value="">Choose offset</option>{choices.map(c=><option key={c.offset}>{c.offset}</option>)}</select></label>}{timeError&&<p role="alert" id="appointment-time-error">{timeError}</p>}<fieldset className="space-y-2"><legend>Services</legend>{services.isPending?<p>Loading services…</p>:services.isError?<ErrorView error={services.error} retry={()=>void services.refetch()}/>:options.map(s=><label className="block" key={s.id}><input type="checkbox" checked={serviceIds.includes(s.id)} onChange={e=>setServiceIds(e.target.checked?[...serviceIds,s.id]:serviceIds.filter(id=>id!==s.id))}/>{s.name}{!s.is_active?' (retained inactive service)':''}</label>)}</fieldset><label>Barber<select className={field} value={barber} onChange={e=>setBarber(e.target.value)}><option value="">Unassigned</option>{barbers.data?.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}{existing?.barber&&!barbers.data?.some(b=>b.id===existing.barber?.id)&&<option value={existing.barber.id}>{existing.barber.name} (inactive; reassign to reschedule)</option>}</select></label>{barbers.isError&&<ErrorView error={barbers.error} retry={()=>void barbers.refetch()}/>}<label>Appointment notes<textarea className={field} maxLength={10000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>{preview.isFetching&&<p role="status">Calculating preview…</p>}{preview.isError&&<p role="alert">{preview.error.message}</p>}{preview.data&&!!instant&&<div aria-label="Appointment preview"><p>Calculated: {preview.data.calculated_duration_minutes} minutes · {preview.data.calculated_price} {context.currency}</p><p>Final: {preview.data.final_duration_minutes} minutes · {preview.data.final_price} {context.currency}</p><p>Ends: {displayTime(preview.data.scheduled_end,context.timezone)}</p><p>Capacity is checked again when saving.</p></div>}<label>Duration override (minutes)<input className={field} type="number" min={1} max={1440} step={1} value={duration} onChange={e=>setDuration(e.target.value)}/></label><label>Price override<input className={field} type="number" min={0} step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label><p>Leave overrides blank to use calculated totals. An override equal to its calculated value is not separately remembered.</p>{notice&&<FormError message={notice}/>}{mutation.isError&&<FormError message={mutation.error.message}/>}<button className={action} disabled={mutation.isPending||preview.isFetching||!preview.data}>{mutation.isPending?'Saving…':'Save appointment'}</button></form></section>
}
