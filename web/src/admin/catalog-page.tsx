import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/auth/auth-provider'
import { useAdminKey } from './query-provider'
import { Button } from '@/components/ui/button'

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
  const mutation = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: object }) => apiRequest(`/${resource}${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    onSuccess: async () => { setEditing(null); setDraft(blank); setNotice('Saved.'); await client.invalidateQueries({ queryKey: key }) },
  })
  function body(value: CatalogRecord) {
    return services ? { name: value.name, is_active: value.is_active, description: value.description ?? null, duration_minutes: value.duration_minutes, price: value.price } : { name: value.name, is_active: value.is_active }
  }
  function submit(event: FormEvent) {
    event.preventDefault(); setNotice('')
    mutation.mutate({ id: editing ?? undefined, body: services ? { name: draft.name, is_active: draft.is_active, description: draft.description || null, duration_minutes: Number(draft.duration), price: draft.price } : { name: draft.name, is_active: draft.is_active } })
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
