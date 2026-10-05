import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Info, RefreshCw } from 'lucide-react'
import { ContactHelp } from '@/public/contact-help'
import { apiRequest } from '@/lib/api'
import { availabilityHero as hero } from '@/public/content'
import { usePublic, type Business } from '@/public/data'

type State = 'AVAILABLE' | 'LIMITED' | 'FULL' | 'CLOSED'
type Interval = { start: string; end: string; state: State }
type Day = { date: string; state: State; intervals: Interval[] }
type Availability = {
  timezone: string
  interval_minutes: number
  start: string
  days: number
  items: Day[]
}
const labels: Record<State, string> = {
  AVAILABLE: 'Disponibile',
  LIMITED: 'Poco disponibile',
  FULL: 'Completo',
  CLOSED: 'Chiuso',
}
const fullWeekdays = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
const weekdays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const dateObject = (date: string) => new Date(`${date}T12:00:00Z`)
const dateKey = (date: Date) => date.toISOString().slice(0, 10)
const dayLabel = (date: string) =>
  new Intl.DateTimeFormat('it-IT', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateObject(date))
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
    dateObject(`${month}-01`),
  )
function shiftMonth(month: string, amount: number) {
  const date = dateObject(`${month}-01`)
  date.setUTCMonth(date.getUTCMonth() + amount)
  return dateKey(date).slice(0, 7)
}
function intervalTime(instant: string, timezone: string, offset = false) {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(offset ? { timeZoneName: 'shortOffset' as const } : {}),
  }).format(new Date(instant))
}

export function AvailabilityPage() {
  const business = usePublic<Business>('/public/business')
  const [month, setMonth] = useState('')
  const [today, setToday] = useState('')
  const [data, setData] = useState<Availability | null>(null)
  const [selected, setSelected] = useState('')
  const [error, setError] = useState(false)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    setError(false)
    const fetchRange = (start: string, days: number) =>
      apiRequest<Availability>(
        `/public/availability?days=${days}${start ? `&start=${start}` : ''}`,
        { protected: false, signal: controller.signal, cache: 'no-store' },
      )
    void (async () => {
      // Backend-local today avoids relying on the visitor's timezone or clock.
      const initial = await fetchRange('', 1)
      if (controller.signal.aborted) return
      setToday(initial.start)
      const target = month || initial.start.slice(0, 7)
      if (!month) {
        setMonth(target)
        return
      }
      const last = dateObject(`${target}-01`)
      last.setUTCMonth(last.getUTCMonth() + 1)
      last.setUTCDate(0)
      const total = last.getUTCDate()
      const chunks: Promise<Availability>[] = []
      for (let day = 1; day <= total; day += 14)
        chunks.push(
          fetchRange(`${target}-${String(day).padStart(2, '0')}`, Math.min(14, total - day + 1)),
        )
      const results = await Promise.all(chunks)
      if (controller.signal.aborted) return
      const items = results
        .flatMap((result) => result.items)
        .sort((a, b) => a.date.localeCompare(b.date))
      setData({ ...initial, start: `${target}-01`, days: total, items })
      setSelected((previous) =>
        items.some(
          (day) => day.date === previous && day.date >= initial.start && day.state !== 'CLOSED',
        )
          ? previous
          : items.find(
              (day) =>
                day.date >= initial.start && (day.state === 'AVAILABLE' || day.state === 'LIMITED'),
            )?.date ||
            items.find((day) => day.date >= initial.start && day.state !== 'CLOSED')?.date ||
            '',
      )
    })().catch(() => {
      if (!controller.signal.aborted) setError(true)
    })
    return () => controller.abort()
  }, [month, refresh])
  const isClosed = (date: string, row?: Day) =>
    row?.state === 'CLOSED' ||
    business.data?.hours.some(
      (hour) => hour.day_of_week === (dateObject(date).getUTCDay() + 6) % 7 && hour.is_closed,
    ) === true
  const openDays = data?.items.filter((row) => row.date >= today && !isClosed(row.date, row)) || []
  // Hours may arrive after availability, or a refresh may close the viewed date.
  const day =
    openDays.find((row) => row.date === selected) ||
    openDays.find((row) => row.state === 'AVAILABLE' || row.state === 'LIMITED') ||
    openDays[0]
  const periods: Interval[][] = []
  for (const interval of day?.intervals || []) {
    if (
      !periods.length ||
      new Date(interval.start).getTime() !== new Date(periods.at(-1)!.at(-1)!.end).getTime()
    )
      periods.push([])
    periods.at(-1)!.push(interval)
  }
  const groups = periods.map((period) =>
    period.filter((interval) => interval.state === 'AVAILABLE' || interval.state === 'LIMITED'),
  )
  const slots = groups.flat()
  const first = month ? dateObject(`${month}-01`) : null
  const padding = first ? (first.getUTCDay() + 6) % 7 : 0
  const count = first
    ? new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
    : 0
  return (
    <div className="availability-page" lang="it">
      <section className="availability-hero" aria-labelledby="availability-title">
        <div className="availability-hero-copy">
          <p className="availability-eyebrow">Disponibilità</p>
          <h1 id="availability-title">
            Trova il momento
            <br />
            giusto per te.
          </h1>
          <p>Controlla gli orari disponibili e contattaci per concordare il tuo appuntamento.</p>
        </div>
        <img
          src={hero.src}
          srcSet={hero.srcSet}
          sizes="(min-width: 768px) 45vw, 100vw"
          alt={hero.alt}
          width={hero.width}
          height={hero.height}
          fetchPriority="high"
        />
      </section>
      <section className="availability-browser" aria-label="Disponibilità del salone">
        <div className="availability-calendar-column">
          <p className="availability-eyebrow">1. Scegli una data</p>
          <div className="availability-calendar">
            <div className="availability-month">
              <h2>{month ? monthLabel(month) : 'Calendario'}</h2>
              <div>
                <button
                  type="button"
                  aria-label="Mese precedente"
                  disabled={!month || month <= today.slice(0, 7)}
                  onClick={() => setMonth(shiftMonth(month, -1))}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  aria-label="Mese successivo"
                  disabled={!month}
                  onClick={() => setMonth(shiftMonth(month, 1))}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="availability-calendar-grid" aria-label="Date del mese">
              {weekdays.map((label, index) => (
                <span className="availability-weekday" key={label} aria-label={fullWeekdays[index]}>
                  {label}
                </span>
              ))}
              {Array.from({ length: padding }, (_, index) => (
                <span key={`blank-${index}`} aria-hidden="true" />
              ))}
              {Array.from({ length: count }, (_, index) => {
                const date = `${month}-${String(index + 1).padStart(2, '0')}`
                const row = data?.items.find((item) => item.date === date)
                const past = date < today
                const closed = isClosed(date, row)
                return (
                  <button
                    type="button"
                    className="availability-date"
                    data-state={past ? 'PAST' : closed ? 'CLOSED' : row?.state || 'UNKNOWN'}
                    aria-pressed={date === day?.date && !!data}
                    aria-label={`${dayLabel(date)} · ${past ? 'Data passata' : closed ? 'Chiuso' : row ? labels[row.state] : 'Dati non disponibili'}`}
                    disabled={past || closed || !row}
                    onClick={() => setSelected(date)}
                    key={date}
                  >
                    <span>{index + 1}</span>
                    <span className="availability-dot" aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          </div>
          <div className="availability-legend">
            <span>
              <i data-state="AVAILABLE" />
              Disponibile
            </span>
            <span>
              <i data-state="LIMITED" />
              Poco disponibile
            </span>
            <span>
              <i data-state="FULL" />
              Non disponibile
            </span>
          </div>
        </div>
        <section
          className="availability-times"
          aria-labelledby="availability-day-title"
          aria-busy={!data && !error}
        >
          <div className="availability-times-heading">
            <p className="availability-eyebrow">2. Consulta gli orari</p>
            <button
              type="button"
              className="availability-refresh"
              aria-label="Aggiorna disponibilità"
              onClick={() => setRefresh((value) => value + 1)}
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <h2 id="availability-day-title">{day ? dayLabel(day.date) : 'Orari disponibili'}</h2>
          {error ? (
            <div className="availability-message" role="alert">
              <p>Non riusciamo a caricare la disponibilità. Riprova o contattaci direttamente.</p>
              <button type="button" onClick={() => setRefresh((value) => value + 1)}>
                Riprova
              </button>
            </div>
          ) : !data ? (
            <p role="status">Caricamento disponibilità…</p>
          ) : !data.items.length ? (
            <p role="status">Nessuna data disponibile.</p>
          ) : !day ? (
            <p role="status">Nessuna data di apertura disponibile per questo mese.</p>
          ) : !slots.length ? (
            <p role="status">
              {day.state === 'CLOSED'
                ? 'Il salone è chiuso in questa data.'
                : 'Non ci sono orari disponibili per questa data.'}
            </p>
          ) : (
            <>
              <p>Disponibilità in fasce di 30 minuti per questa data.</p>
              <div className="availability-slot-groups">
                {groups.map((group, index) => {
                  const available = group.filter(
                    (interval) => interval.state === 'AVAILABLE' || interval.state === 'LIMITED',
                  )
                  return (
                    available.length > 0 && (
                      <ul
                        className="availability-slots"
                        aria-label={`Orari disponibili, fascia ${index + 1}`}
                        key={group[0].start}
                      >
                        {available.map((interval) => {
                          const time = intervalTime(interval.start, data.timezone)
                          const repeated =
                            slots.filter((slot) => intervalTime(slot.start, data.timezone) === time)
                              .length > 1
                          return (
                            <li key={interval.start} data-state={interval.state}>
                              <time dateTime={interval.start}>
                                {intervalTime(interval.start, data.timezone, repeated)}
                              </time>
                              {interval.state === 'LIMITED' && (
                                <span className="sr-only"> · Poco disponibile</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )
                  )
                })}
              </div>
            </>
          )}
          <p className="availability-disclaimer">
            <Info size={18} aria-hidden="true" />
            <span>
              La disponibilità è indicativa e verrà confermata dal nostro team. Gli orari mostrati
              non riservano un appuntamento.
            </span>
          </p>
          {data && <p className="availability-timezone">Ora locale del salone: {data.timezone}</p>}
        </section>
      </section>
      <ContactHelp business={business} />
    </div>
  )
}
