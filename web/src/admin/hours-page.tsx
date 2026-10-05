import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/auth/auth-provider'
import { useAdminKey } from './query-provider'
import { Button } from '@/components/ui/button'

type Day = { day_of_week: number; opening_time: string | null; closing_time: string | null; is_closed: boolean }
const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export function HoursPage() {
  const { actor } = useAuth()
  const key = useAdminKey('business-hours')
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => apiRequest<Day[]>('/business-hours', { signal }) })
  return <section className="space-y-6"><h1 className="text-3xl font-semibold">Business hours</h1><p>Shared by all active barbers.</p>{query.isPending && <p role="status">Loading business hours…</p>}{query.isError && <div><p role="alert">{query.error.message}</p><Button onClick={() => void query.refetch()}>Retry</Button></div>}{query.data && <Week initial={query.data} owner={actor?.role === 'OWNER'} />}</section>
}
function Week({ initial, owner }: { initial: Day[]; owner: boolean }) {
  const key = useAdminKey('business-hours')
  const client = useQueryClient()
  const [days, setDays] = useState(() => names.map((_, day) => initial.find(item => item.day_of_week === day) ?? { day_of_week: day, is_closed: true, opening_time: null, closing_time: null }))
  const mutation = useMutation({ mutationFn: () => apiRequest<Day[]>('/business-hours', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days }) }), onSuccess: async data => { setDays(data); await client.invalidateQueries({ queryKey: key }) } })
  function change(index: number, patch: Partial<Day>) { setDays(current => current.map(day => day.day_of_week === index ? { ...day, ...patch } : day)) }
  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate() }
  const visibleDays = owner ? days : initial
  return <form onSubmit={submit} className="space-y-3">{visibleDays.map(day => <fieldset key={day.day_of_week} className="space-y-2 rounded-md border border-input p-4"><legend className="font-semibold">{names[day.day_of_week]}</legend>{owner ? <><label className="flex items-center gap-2"><input type="checkbox" checked={day.is_closed} onChange={e => change(day.day_of_week, { is_closed: e.target.checked, opening_time: e.target.checked ? null : '09:00', closing_time: e.target.checked ? null : '18:00' })} />Closed</label>{!day.is_closed && <div className="flex flex-wrap gap-4"><label>Opening<input className="block rounded-md border border-input p-2" type="time" required value={day.opening_time?.slice(0, 5) ?? ''} onChange={e => change(day.day_of_week, { opening_time: e.target.value })} /></label><label>Closing<input className="block rounded-md border border-input p-2" type="time" required value={day.closing_time?.slice(0, 5) ?? ''} onChange={e => change(day.day_of_week, { closing_time: e.target.value })} /></label></div>}</> : <p>{day.is_closed ? 'Closed' : `${day.opening_time?.slice(0, 5)}–${day.closing_time?.slice(0, 5)}`}</p>}</fieldset>)}{owner && <Button disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save week'}</Button>}{mutation.isError && <p role="alert">{mutation.error.message}</p>}{mutation.isSuccess && <p role="status">Saved.</p>}</form>
}
