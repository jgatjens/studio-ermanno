import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/auth/auth-provider'
import { useAdminKey } from './query-provider'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, Scissors, Clock, Pencil, X } from 'lucide-react'

export type CatalogRecord = { id: string; name: string; is_active: boolean; description?: string | null; duration_minutes?: number; price?: string }
type Draft = { name: string; is_active: boolean; description: string; duration: string; price: string }
const blank: Draft = { name: '', is_active: true, description: '', duration: '30', price: '0.00' }
const inputStyle = 'block w-full rounded-md border border-input p-2'

export function CatalogPage({ resource }: { resource: 'services' | 'barbers' }) {
  const services = resource === 'services'
  const title = services ? 'Services' : 'Barbers'
  const { actor } = useAuth()
  const owner = actor?.role === 'OWNER'
  const key = useAdminKey(resource)
  const client = useQueryClient()
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => apiRequest<CatalogRecord[]>(`/${resource}`, { signal }) })
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(blank)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const editor = useRef<HTMLHeadingElement>(null)
  const mutation = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: object }) => apiRequest(`/${resource}${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    onSuccess: async () => { setEditing(null); setDraft(blank); setNotice('Saved.'); await client.invalidateQueries({ queryKey: key }) },
  })
  function body(value: CatalogRecord) {
    return services ? { name: value.name, is_active: value.is_active, description: value.description ?? null, duration_minutes: value.duration_minutes, price: value.price } : { name: value.name, is_active: value.is_active }
  }
  function submit(event: FormEvent) {
    event.preventDefault(); if (mutation.isPending) return; setNotice('')
    mutation.mutate({ id: editing ?? undefined, body: services ? { name: draft.name, is_active: draft.is_active, description: draft.description || null, duration_minutes: Number(draft.duration), price: draft.price } : { name: draft.name, is_active: draft.is_active } })
  }
  function openEditor(record?: CatalogRecord) {
    mutation.reset(); setNotice(''); setEditing(record?.id ?? null)
    setDraft(record ? {name:record.name,is_active:record.is_active,description:record.description??'',duration:String(record.duration_minutes??30),price:record.price??'0.00'} : blank)
    editor.current?.scrollIntoView({behavior:'smooth',block:'start'}); editor.current?.focus()
  }
  if (services) {
    const matches = query.data?.filter(record => `${record.name} ${record.description??''}`.toLowerCase().includes(search.trim().toLowerCase()))
    return <section className="services-workspace space-y-6">
      <div className="services-heading"><div><h1>Services</h1><p className="text-sm text-muted-foreground">{owner?'Manage your service catalog, durations and prices.':'View services, durations and prices. Read-only access.'}</p></div>{owner&&<Button disabled={mutation.isPending} onClick={()=>openEditor()}><Plus size={18} aria-hidden="true"/>Create service</Button>}</div>
      <Card><CardContent><Field><FieldLabel htmlFor="services-search">Search services</FieldLabel><div className="relative"><Search size={18} className="absolute left-3 top-3.5 text-muted-foreground" aria-hidden="true"/><Input id="services-search" type="search" className="pl-10 pr-12" placeholder="Name or description…" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<Button variant="outline" className="absolute right-0 top-0" aria-label="Clear search" onClick={()=>setSearch('')}><X size={16}/></Button>}</div></Field></CardContent></Card>
      {query.isPending&&<div role="status" className="services-grid"><span className="sr-only">Loading services…</span>{[1,2,3].map(n=><Skeleton key={n} className="h-48 rounded-xl"/>)}</div>}
      {query.isError&&<div role="alert"><p>{query.error.message}</p><Button variant="outline" onClick={()=>void query.refetch()}>Retry</Button></div>}
      {query.data&&<><p className="text-sm text-muted-foreground">{matches?.length} matching services</p>{matches?.length ? <ul className="services-grid">{matches.map(record=><li key={record.id}><Card className="service-card"><CardHeader><div className="services-heading"><h2>{record.name}</h2><Badge variant="outline">{record.is_active?'Active':'Inactive'}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="service-facts"><span><Clock size={16} aria-hidden="true"/>{record.duration_minutes} minutes</span><span className="font-semibold">{record.price}</span></div>{record.description&&<p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{record.description}</p>}{owner&&<div className="service-actions"><Button variant="outline" disabled={mutation.isPending} onClick={()=>openEditor(record)}><Pencil size={16} aria-hidden="true"/>Edit {record.name}</Button><Button variant="outline" disabled={mutation.isPending} onClick={()=>{setNotice('');mutation.mutate({id:record.id,body:body({...record,is_active:!record.is_active})})}}>{record.is_active?'Deactivate':'Activate'} {record.name}</Button></div>}</CardContent></Card></li>)}</ul>:<Card><CardContent className="service-empty"><Scissors size={30} aria-hidden="true"/><h2>{query.data.length===0?'No services yet.':'No matching services.'}</h2><p className="text-sm text-muted-foreground">{search?'Try another search or clear the filter.':owner?'Use the form below to add your first service.':'Services added by the Owner will appear here.'}</p>{search&&<Button variant="outline" onClick={()=>setSearch('')}>Clear search</Button>}</CardContent></Card>}</>}
      {owner&&<Card className="service-editor"><CardHeader><h2 ref={editor} tabIndex={-1}>{editing?'Edit':'Create'} service</h2><p className="text-sm text-muted-foreground">Set the name, appointment duration and price.</p></CardHeader><CardContent><form className="space-y-5" onSubmit={submit}><fieldset disabled={mutation.isPending} className="space-y-5">
        <Field><FieldLabel htmlFor="service-name">Name</FieldLabel><Input id="service-name" required maxLength={200} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field>
        <Field><FieldLabel htmlFor="service-description">Description</FieldLabel><Textarea id="service-description" rows={4} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></Field>
        <div className="service-form-pair"><Field><FieldLabel htmlFor="service-duration">Duration (minutes)</FieldLabel><Input id="service-duration" type="number" min="1" step="1" required value={draft.duration} onChange={e=>setDraft({...draft,duration:e.target.value})}/></Field><Field><FieldLabel htmlFor="service-price">Price</FieldLabel><Input id="service-price" type="number" min="0" step="0.01" required value={draft.price} onChange={e=>setDraft({...draft,price:e.target.value})}/></Field></div>
        <label className="service-active"><input type="checkbox" checked={draft.is_active} onChange={e=>setDraft({...draft,is_active:e.target.checked})}/>Active</label>
        <div className="service-actions"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending?'Saving…':'Save'}</Button>{editing&&<Button type="button" variant="outline" disabled={mutation.isPending} onClick={()=>openEditor()}>Cancel</Button>}</div>
      </fieldset></form></CardContent></Card>}
      {mutation.isError&&<p role="alert">{mutation.error.message}</p>}{notice&&<p role="status">{notice}</p>}
    </section>
  }
  return <section className="space-y-6"><h1 className="text-3xl font-semibold">{title}</h1>
    {query.isPending && <p role="status">Loading {resource}…</p>}
    {query.isError && <div><p role="alert">{query.error.message}</p><Button onClick={() => void query.refetch()}>Retry</Button></div>}
    {query.data?.length === 0 && <p>No {resource} yet.</p>}
    <ul className="space-y-3">{query.data?.map(record => <li key={record.id} className="space-y-2 rounded-md border border-input p-4"><h2 className="text-lg font-semibold">{record.name}</h2><p>{record.is_active ? 'Active' : 'Inactive'}</p>{services && <><p>{record.duration_minutes} minutes · {record.price}</p>{record.description && <p>{record.description}</p>}</>}{owner && <div className="flex flex-wrap gap-2"><Button disabled={mutation.isPending} variant="outline" onClick={() => { mutation.reset(); setNotice(''); setEditing(record.id); setDraft({ name: record.name, is_active: record.is_active, description: record.description ?? '', duration: String(record.duration_minutes ?? 30), price: record.price ?? '0.00' }) }}>Edit {record.name}</Button><Button disabled={mutation.isPending} variant="outline" onClick={() => { setNotice(''); mutation.mutate({ id: record.id, body: body({ ...record, is_active: !record.is_active }) }) }}>{record.is_active ? 'Deactivate' : 'Activate'} {record.name}</Button></div>}</li>)}</ul>
    {owner && <form onSubmit={submit} className="space-y-3 rounded-md border border-input p-4"><h2 className="text-lg font-semibold">{editing ? 'Edit' : 'Create'} {services ? 'service' : 'barber'}</h2><label className="block">Name<input className={inputStyle} required maxLength={200} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>{services && <><label className="block">Description<textarea className={inputStyle} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label><label className="block">Duration (minutes)<input className={inputStyle} type="number" min="1" step="1" required value={draft.duration} onChange={e => setDraft({ ...draft, duration: e.target.value })} /></label><label className="block">Price<input className={inputStyle} type="number" min="0" step="0.01" required value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} /></label></>}<label className="flex items-center gap-2"><input type="checkbox" checked={draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} />Active</label><div className="flex gap-2"><Button disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save'}</Button>{editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setDraft(blank); mutation.reset() }}>Cancel</Button>}</div></form>}
    {mutation.isError && <p role="alert">{mutation.error.message}</p>}{notice && <p role="status">{notice}</p>}
  </section>
}
