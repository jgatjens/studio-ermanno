import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { apiRequest } from '@/lib/api'
import { useAdminKey } from './query-provider'
import { displayTime, localStamp, nextDate, timeChoices } from './appointments/time'
import type { Appointment, Context, Page } from './appointments/types'

type Stock = { id: string; name: string; current_stock: string; minimum_stock: string }
type Feedback = { id: string; name: string; rating: number; comment: string }
export function dayRange(now: Date, zone: string) {
  const date = localStamp(now, zone).slice(0,10)
  const start = timeChoices(date+'T00:00',zone)[0]?.instant
  const end = timeChoices(nextDate(date)+'T00:00',zone)[0]?.instant
  if (!start || !end) throw Error('The business-local date could not be resolved. Please try again.')
  return { date, start, end }
}
function businessDate(now: Date, zone: string) { try { return localStamp(now,zone).replace('T',' · ') } catch { return 'Business date unavailable' } }
function useClock() {
  const [now,setNow] = useState(()=>new Date())
  useEffect(()=>{const update=()=>setNow(new Date()); const visible=()=>{if(document.visibilityState==='visible')update()}; const timer=setInterval(visible,60_000); document.addEventListener('visibilitychange',visible); return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible)}},[])
  return [now,()=>setNow(new Date())] as const
}
function State<T>({query,label}:{query:UseQueryResult<T,Error>;label:string}) {
  return query.isError ? <div role="alert"><p>Could not load {label}.</p>{query.data&&<p>Showing the last loaded data.</p>}<button onClick={()=>void query.refetch()}>Retry {label}</button></div> : <p role="status" className="admin-skeleton">Loading {label}…</p>
}
function AppointmentCard({item,zone,now}:{item:Appointment;zone:string;now:Date}) {
  const ongoing=new Date(item.scheduled_start)<=now && new Date(item.scheduled_end)>now && ['SCHEDULED','CONFIRMED'].includes(item.status)
  return <article className="admin-card"><Link to={`/admin/appointments/${item.id}`}>{item.client.first_name} {item.client.last_name}</Link><p>{ongoing?'In progress · Started at ':''}{displayTime(item.scheduled_start,zone)}</p><p>{item.barber?.name||'Unassigned'} · {item.main_service?.name||'Service details in appointment'}</p><p className="admin-status">{item.status.replaceAll('_',' ')}</p></article>
}
function Schedule({context,now}:{context:Context;now:Date}) {
  const key=useAdminKey('appointments');const [offset,setOffset]=useState(0)
  let range: ReturnType<typeof dayRange> | undefined
  try { range=dayRange(now,context.timezone) } catch { /* Date error shown below; dependent requests disabled. */ }
  useEffect(()=>setOffset(0),[range?.date])
  const current=now.toISOString()
  function path(start:string,limit:number,status?:string) { const params=new URLSearchParams({from:start,to:range?.end||'',limit:String(limit),offset:status?'0':String(offset)});if(status)params.set('status',status);return '/appointments?'+params }
  const today=useQuery({queryKey:[...key,'dashboard-day',context.timezone,range?.start,range?.end,offset],enabled:!!range,queryFn:({signal})=>apiRequest<Page<Appointment>>(path(range!.start,25),{signal}),refetchInterval:60_000})
  const scheduled=useQuery({queryKey:[...key,'dashboard-next','SCHEDULED',context.timezone,range?.end,current],enabled:!!range,queryFn:({signal})=>apiRequest<Page<Appointment>>(path(current,1,'SCHEDULED'),{signal})})
  const confirmed=useQuery({queryKey:[...key,'dashboard-next','CONFIRMED',context.timezone,range?.end,current],enabled:!!range,queryFn:({signal})=>apiRequest<Page<Appointment>>(path(current,1,'CONFIRMED'),{signal})})
  if(!range)return <p role="alert">The business-local date could not be resolved. Check timezone configuration.</p>
  const next=[...(scheduled.data?.items||[]),...(confirmed.data?.items||[])].filter(item=>['SCHEDULED','CONFIRMED'].includes(item.status)&&new Date(item.scheduled_end)>now&&new Date(item.scheduled_start)<new Date(range.end)).sort((a,b)=>a.scheduled_start.localeCompare(b.scheduled_start)||a.id.localeCompare(b.id))[0]
  const alerts=today.data?.items.filter(item=>!item.barber&&['SCHEDULED','CONFIRMED'].includes(item.status)&&new Date(item.scheduled_end)>now)||[]
  return <>
    <section><h2>Next appointment</h2>{scheduled.isError||confirmed.isError ? <div role="alert"><p>Could not load the next appointment.</p><button onClick={()=>{void scheduled.refetch();void confirmed.refetch()}}>Retry next appointment</button></div> : scheduled.isPending||confirmed.isPending ? <p role="status" className="admin-skeleton">Loading next appointment…</p> : next ? <AppointmentCard item={next} zone={context.timezone} now={now}/> : <p>No upcoming appointments today.</p>}</section>
    <section><h2>Today's appointments</h2>{today.data ? <>{today.isError&&<State query={today} label="today's appointments"/>}{today.isFetching&&<p role="status">Refreshing schedule…</p>}<p>{today.data.total} appointments · {range.date} · {context.timezone}</p>{today.data.items.map(item=><AppointmentCard key={item.id} item={item} zone={context.timezone} now={now}/>)}{!today.data.total&&<p>No appointments today.</p>}<div className="admin-actions"><button disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous</button><span>Showing {today.data.total ? offset+1 : 0}–{Math.min(offset+today.data.items.length,today.data.total)} of {today.data.total}</span><button disabled={offset+25>=today.data.total} onClick={()=>setOffset(offset+25)}>Next</button></div><Link to="/admin/appointments">View full schedule</Link></> : <State query={today} label="today's appointments"/>}</section>
    <section><h2>Appointment alerts</h2>{today.data ? <><p>Unassigned active appointments on this schedule page.</p>{alerts.length ? alerts.map(item=><p key={item.id}><Link to={`/admin/appointments/${item.id}`}>Unassigned: {item.client.first_name} {item.client.last_name}</Link></p>) : <p>No unassigned upcoming appointments on this page.</p>}</> : <p>Alerts are available when this schedule page loads.</p>}</section>
  </>
}
export function DashboardPage() {
  const cache=useQueryClient();const owner=useAuth().actor?.role==='OWNER';const appointmentsKey=useAdminKey('appointments');const productsKey=useAdminKey('products');const feedbackKey=useAdminKey('feedback');const [now,refreshClock]=useClock()
  const context=useQuery({queryKey:[...appointmentsKey,'context'],queryFn:({signal})=>apiRequest<Context>('/appointments/context',{signal})})
  const stock=useQuery({queryKey:[...productsKey,'dashboard-low'],queryFn:({signal})=>apiRequest<Page<Stock>>('/products?active=true&low_stock=true&limit=5&offset=0',{signal})})
  const feedback=useQuery({queryKey:[...feedbackKey,'dashboard-pending'],queryFn:({signal})=>apiRequest<Page<Feedback>>('/feedback?status=PENDING&limit=1&offset=0',{signal})})
  return <section className="admin-dashboard"><h1>Admin dashboard</h1>{context.data&&<p>{businessDate(now,context.data.timezone)} · {context.data.timezone}</p>}{context.isError&&context.data&&<State query={context} label="business timezone"/>}<div className="admin-actions">{owner&&<Link to="/admin/appointments/new">Create appointment</Link>}<Link to="/admin/clients">Search client</Link><button onClick={()=>{refreshClock();void cache.invalidateQueries({queryKey:appointmentsKey});void context.refetch();void stock.refetch();void feedback.refetch()}}>Refresh dashboard</button></div>{context.data ? <Schedule context={context.data} now={now}/> : <State query={context} label="business timezone"/>}<section><h2>Low stock</h2>{stock.data ? <>{stock.isError&&<State query={stock} label="inventory status"/>}<p>{stock.data.total} active low-stock products</p>{stock.data.items.map(item=><article className="admin-card" key={item.id}><Link to={`/admin/products/${item.id}`}>{item.name}</Link><p>Current stock: {item.current_stock} · Minimum: {item.minimum_stock}</p>{owner&&<Link to={`/admin/products/${item.id}`}>Update stock</Link>}</article>)}{!stock.data.total&&<p>Stock levels look good.</p>}<Link to="/admin/inventory">Open inventory</Link></> : <State query={stock} label="inventory status"/>}</section><section><h2>Pending feedback</h2>{feedback.data ? <>{feedback.isError&&<State query={feedback} label="pending feedback"/>}<p>{feedback.data.total ? `${feedback.data.total} feedback items awaiting review.` : 'No pending feedback.'}</p><Link to="/admin/feedback">{owner?'Review feedback':'View feedback'}</Link></> : <State query={feedback} label="pending feedback"/>}</section></section>
}
