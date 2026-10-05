import { FormError } from './form-error'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { ApiError, apiRequest } from '@/lib/api'
import { useAdminKey } from './query-provider'

type Visit = { id: string; scheduled_start: string; appointment_notes: string | null; visit_notes?: string | null; final_duration_minutes: number; final_price: string; services: {name:string;price:string;duration_minutes:number}[]; products:{name:string;quantity:string;usage_type:string}[] }
type Client = { id:string;first_name:string;last_name:string;email?:string|null;phone?:string|null;private_notes?:string|null;last_completed_visit?:Visit|null }
type Page<T> = {items:T[];total:number;limit:number;offset:number}
const inputClass = 'block w-full rounded border p-2'
function Failure({error, retry}:{error:Error;retry:()=>void}) { return <div role="alert"><p>{error instanceof ApiError && error.status===404?'Client not found.':error.message}</p><button onClick={retry}>Retry</button></div> }
function Pager({offset,total,onChange}:{offset:number;total:number;onChange:(n:number)=>void}) {return <div className="flex gap-4"><button disabled={offset===0} onClick={()=>onChange(Math.max(0,offset-25))}>Previous</button><span>{total} results</span><button disabled={offset+25>=total} onClick={()=>onChange(offset+25)}>Next</button></div>}

export function ClientsPage() {
  const {actor}=useAuth();const owner=actor?.role==='OWNER';const key=useAdminKey('clients')
  const [searchParams,setSearchParams]=useSearchParams();const [search,setSearch]=useState(()=>searchParams.get('q')||'');const [q,setQ]=useState(()=>searchParams.get('q')||'');const [offset,setOffset]=useState(()=>Math.max(0,Number(searchParams.get('offset'))||0))
  useEffect(()=>{const timer=setTimeout(()=>{setQ(search.trim());if(search.trim()!==q)setOffset(0)},300);return()=>clearTimeout(timer)},[search,q])
  useEffect(()=>{setSearchParams(q||offset?{q,offset:String(offset)}:{},{replace:true})},[q,offset,setSearchParams])
  const query=useQuery({queryKey:[...key,'list',q,offset],queryFn:({signal})=>apiRequest<Page<Client>>(`/clients?q=${encodeURIComponent(q)}&limit=25&offset=${offset}`,{signal})})
  return <section className="space-y-4"><h1>Clients</h1>{owner&&<Link to="/admin/clients/new">Create client</Link>}<label>{owner?'Search name, email or phone':'Search client name'}<input className={inputClass} value={search} maxLength={200} onChange={e=>setSearch(e.target.value)}/></label>{query.isPending||search.trim()!==q?<p role="status">Loading clients…</p>:query.isError?<Failure error={query.error} retry={()=>void query.refetch()}/>:<><ul className="space-y-3">{query.data.items.map(client=><li className="break-words rounded border p-3" key={client.id}><Link to={`/admin/clients/${client.id}`} state={{clientListSearch:searchParams.toString()}}>{client.first_name} {client.last_name}</Link>{owner&&<p>{client.email} {client.phone}</p>}</li>)}</ul>{query.data.items.length===0&&<p>{q?'No matching clients.':'No clients yet.'}</p>}<Pager offset={offset} total={query.data.total} onChange={setOffset}/></>}</section>
}
function VisitCard({visit,owner}:{visit:Visit;owner:boolean}) {return <article className="space-y-2 break-words rounded border p-3"><p>{new Date(visit.scheduled_start).toLocaleString()}</p><p>{visit.final_duration_minutes} minutes · {visit.final_price}</p><ul>{visit.services.map((service,i)=><li key={i}>{service.name} · {service.duration_minutes} minutes · {service.price}</li>)}</ul><ul>{visit.products.map((product,i)=><li key={i}>{product.name} · {product.quantity} · {product.usage_type}</li>)}</ul>{visit.appointment_notes&&<p>Appointment notes: {visit.appointment_notes}</p>}{owner&&visit.visit_notes&&<p>Visit notes: {visit.visit_notes}</p>}</article>}
export function ClientProfilePage() {
  const location=useLocation();const {clientId}=useParams();const {actor}=useAuth();const owner=actor?.role==='OWNER';const key=useAdminKey('clients');const [offset,setOffset]=useState(0)
  useEffect(()=>setOffset(0),[clientId])
  const profile=useQuery({queryKey:[...key,'profile',clientId],queryFn:({signal})=>apiRequest<Client>(`/clients/${clientId}`,{signal})})
  const history=useQuery({queryKey:[...key,'history',clientId,offset],enabled:!!profile.data,queryFn:({signal})=>apiRequest<Page<Visit>>(`/clients/${clientId}/history?limit=25&offset=${offset}`,{signal})})
  if(profile.isPending)return <p role="status">Loading profile…</p>
  if(profile.isError)return <Failure error={profile.error} retry={()=>void profile.refetch()}/>
  const client=profile.data
  return <section className="space-y-4"><Link to={location.state?.clientListSearch ? `/admin/clients?${location.state.clientListSearch}` : '/admin/clients'}>Back to clients</Link><h1>{client.first_name} {client.last_name}</h1>{location.state?.saved&&<p role="status">Client saved.</p>}{owner&&<><Link to={`/admin/clients/${clientId}/edit`}>Edit client</Link><h2>Contact information</h2><p>{client.email||'No email'} · {client.phone||'No phone'}</p><h2>General notes/preferences</h2><p className="whitespace-pre-wrap break-words">{client.private_notes||'No general notes.'}</p></>}<h2>Last completed visit</h2>{client.last_completed_visit?<VisitCard visit={client.last_completed_visit} owner={owner}/>:<p>No completed visits yet.</p>}<h2>Visit history</h2>{history.isPending?<p role="status">Loading history…</p>:history.isError?<Failure error={history.error} retry={()=>void history.refetch()}/>:<>{history.data.items.map(visit=><VisitCard key={visit.id} visit={visit} owner={owner}/>)}{history.data.total===0&&<p>No visit history.</p>}<Pager offset={offset} total={history.data.total} onChange={setOffset}/></>}</section>
}
const blank={first_name:'',last_name:'',email:'',phone:'',private_notes:''}
export function ClientFormPage() {
  const {actor}=useAuth();const {clientId}=useParams();const key=useAdminKey('clients')
  const query=useQuery({queryKey:[...key,'profile',clientId],enabled:actor?.role==='OWNER'&&!!clientId,queryFn:({signal})=>apiRequest<Client>(`/clients/${clientId}`,{signal})})
  if(actor?.role!=='OWNER')return <p role="alert">Access denied.</p>
  if(clientId&&query.isPending)return <p role="status">Loading client…</p>
  if(clientId&&query.isError)return <Failure error={query.error} retry={()=>void query.refetch()}/>
  return <ClientForm key={clientId||'new'} client={query.data} clientId={clientId}/>
}
function ClientForm({client,clientId}:{client?:Client;clientId?:string}) {
  const [draft,setDraft]=useState(()=>({...blank,...Object.fromEntries(Object.keys(blank).map(field=>[field,client?.[field as keyof Client]||'']))}) as typeof blank)
  const [notice,setNotice]=useState('');const key=useAdminKey('clients');const cache=useQueryClient();const navigate=useNavigate()
  const mutation=useMutation({mutationFn:()=>apiRequest<Client>(`/clients${clientId?'/'+clientId:''}`,{method:clientId?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(Object.entries(draft).map(([k,v])=>[k,v.trim()||null])))}),onSuccess:async saved=>{await cache.invalidateQueries({queryKey:key});navigate(`/admin/clients/${saved.id}`,{state:{saved:true}})}})
  return <section className="space-y-4"><Link to={clientId?`/admin/clients/${clientId}`:'/admin/clients'}>Back</Link><h1>{clientId?'Edit client':'Create client'}</h1><form className="space-y-4" onSubmit={event=>{event.preventDefault();setNotice('');if(!draft.first_name.trim()||!draft.last_name.trim()){setNotice('First and last name are required.');return}mutation.mutate()}}>{(['first_name','last_name','email','phone','private_notes'] as const).map(field=><label className="block" key={field}>{({first_name:'First name',last_name:'Last name',email:'Email',phone:'Phone',private_notes:'General notes/preferences'})[field]}{field==='private_notes'?<textarea className={inputClass} maxLength={10000} value={draft[field]} onChange={e=>setDraft({...draft,[field]:e.target.value})}/>:<input className={inputClass} required={field.endsWith('name')} aria-invalid={!!notice&&field.endsWith('name')&&!draft[field].trim()} aria-describedby={notice&&field.endsWith('name')&&!draft[field].trim()?'client-required-error':undefined} type={field==='email'?'email':field==='phone'?'tel':'text'} maxLength={field.endsWith('name')?100:field==='email'?320:50} value={draft[field]} onChange={e=>setDraft({...draft,[field]:e.target.value})}/>}</label>)}{notice&&<FormError id="client-required-error" message={notice}/>}{mutation.isError&&<FormError message={mutation.error instanceof ApiError&&mutation.error.status===422?'Check the field formats and lengths.':mutation.error.message}/>}<button className="break-words rounded border p-3" disabled={mutation.isPending}>{mutation.isPending?'Saving…':'Save client'}</button></form></section>
}
