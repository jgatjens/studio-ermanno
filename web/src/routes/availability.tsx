import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
type State = 'AVAILABLE' | 'LIMITED' | 'FULL' | 'CLOSED'
type Interval = { start: string; end: string; state: State }
type Day = { date: string; state: State; intervals: Interval[] }
type Availability = { timezone: string; interval_minutes: number; start: string; days: number; items: Day[] }
const labels: Record<State, string> = { AVAILABLE: 'Available', LIMITED: 'Limited', FULL: 'Full', CLOSED: 'Closed' }
const colors: Record<State, string> = { AVAILABLE: 'border-green-700', LIMITED: 'border-amber-700', FULL: 'border-red-700', CLOSED: 'border-gray-500' }
const button = 'rounded border px-3 py-3'
const field = 'block w-full min-w-0 rounded border p-3'
function intervalTime(instant: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset' }).format(new Date(instant))
}
function dayLabel(date: string) {
  return new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(date + 'T12:00:00Z'))
}
export function AvailabilityPage() {
  const [start, setStart] = useState('')
  const [days, setDays] = useState('7')
  const [request, setRequest] = useState({ start: '', days: '7', refresh: 0 })
  const [data, setData] = useState<Availability | null>(null)
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError(''); setSelected('')
    const query = `days=${request.days}${request.start ? `&start=${encodeURIComponent(request.start)}` : ''}`
    void apiRequest<Availability>(`/public/availability?${query}`, { protected: false, signal: controller.signal, cache: 'no-store' }).then(result => {
      if (!controller.signal.aborted) { setData(result); setSelected(result.items[0]?.date || '') }
    }).catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Availability is unavailable.') })
    return () => controller.abort()
  }, [request])
  const day = data?.items.find(row => row.date === selected)
  return <section className="space-y-5 break-words"><h1>Availability</h1><p>Business-level information only. Contact the business to arrange an appointment; this page does not reserve a time.</p>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); setRequest({ start, days, refresh: request.refresh + 1 }) }}>
      <label className="block">Start date (optional)<input className={field} type="date" value={start} onChange={e => setStart(e.target.value)} /></label><p>Leave blank to start today in the business timezone.</p>
      <label className="block">Days<select className={field} value={days} onChange={e => setDays(e.target.value)}>{[1, 7, 14].map(n => <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>)}</select></label><button className={button}>Check dates</button>
    </form>
    {error ? <div role="alert"><p>{error}</p><button className={button} onClick={() => setRequest({ ...request, refresh: request.refresh + 1 })}>Retry availability</button></div> : !data ? <p role="status">Loading availability…</p> : <>
      <p>Business timezone: {data.timezone}. Showing {data.start} for {data.days} days.</p>
      <p>Available: unused capacity or at least two slots remain. Limited: one slot remains while some capacity is occupied. Full: no capacity remains. Closed: outside business hours.</p>
      <p>A daily Available or Limited label means some intervals have capacity. Check the times below; availability can change and does not guarantee capacity for a particular service or barber.</p>
      <button className={button} onClick={() => setRequest({ ...request, refresh: request.refresh + 1 })}>Refresh availability</button>
      <div className="grid gap-3 sm:grid-cols-2" aria-label="Availability dates">{data.items.map(row => <button className={`${button} ${colors[row.state]} text-left`} type="button" aria-pressed={row.date === selected} key={row.date} onClick={() => setSelected(row.date)}>{dayLabel(row.date)} · {labels[row.state]}</button>)}</div>
      {!data.items.length && <p>No availability dates returned.</p>}
      {day && <section className="space-y-3" aria-label="Selected day"><h2>{dayLabel(day.date)} — {labels[day.state]}</h2>{day.state === 'CLOSED' ? <p>The business is closed on this date.</p> : !day.intervals.length ? <p>No open intervals on this date.</p> : <>
        <p>Intervals are up to {data.interval_minutes} minutes. Times include UTC offsets for repeated clock times. Before opening and after closing the business is closed.</p>
        <ul className="space-y-2">{day.intervals.map(interval => <li className={`rounded border p-3 ${colors[interval.state]}`} key={interval.start}>{intervalTime(interval.start, data.timezone)} – {intervalTime(interval.end, data.timezone)} · {labels[interval.state]}</li>)}</ul>
      </>}</section>}
    </>}
  </section>
}
