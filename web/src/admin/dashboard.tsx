import { t, useAdminLanguage } from '@/admin/i18n'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { apiRequest } from '@/lib/api'
import type { DayHours } from '@/lib/business-hours'
import { useAdminKey } from './query-provider'
import { displayTime, localStamp } from './appointments/time'
import { dayRange } from './appointments/business-day'
export { dayRange } from './appointments/business-day'
import type { Appointment, Context, Page } from './appointments/types'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CalendarDays,
  Clock,
  ArrowRight,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  Package,
  MessageSquare,
  CheckCircle2,
  UserRound,
} from 'lucide-react'
import type { ReactNode } from 'react'

function Panel({
  title,
  icon,
  children,
  className = '',
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  className?: string
}) {
  useAdminLanguage()

  return (
    <Card className={`dashboard-panel ${className}`}>
      <CardHeader>
        <div className="dashboard-panel-title">
          <span className="dashboard-panel-icon" aria-hidden="true">
            {icon}
          </span>
          <h2>{t(title)}</h2>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
function EmptyState({ children }: { children: ReactNode }) {
  useAdminLanguage()

  return (
    <div className="dashboard-empty">
      <CheckCircle2 size={25} aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}
function stockNumber(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1')
}

type Stock = { id: string; name: string; current_stock: string; minimum_stock: string }
type Feedback = { id: string; name: string; rating: number; comment: string }
function businessDate(now: Date, zone: string) {
  try {
    return localStamp(now, zone).replace('T', ' · ')
  } catch {
    return t('Business date unavailable')
  }
}
function localStampSafe(now: Date, zone: string) {
  try {
    return localStamp(now, zone).slice(0, 10)
  } catch {
    return undefined
  }
}
function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const update = () => setNow(new Date())
    const visible = () => {
      if (document.visibilityState === 'visible') update()
    }
    const timer = setInterval(visible, 60_000)
    document.addEventListener('visibilitychange', visible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])
  return [now, () => setNow(new Date())] as const
}
function State<T>({ query, label }: { query: UseQueryResult<T, Error>; label: string }) {
  useAdminLanguage()

  return query.isError ? (
    <div role="alert">
      <p>
        {t('Could not load ')}
        {t(label)}.
      </p>
      {query.data && <p>{t('Showing the last loaded data.')}</p>}
      <Button variant="outline" onClick={() => void query.refetch()}>
        {t("Retry ")}
        {t(label)}
      </Button>
    </div>
  ) : (
    <div role="status" className="space-y-3">
      <span className="sr-only">
        {t('Loading ')}
        {t(label)}…
      </span>
      <Skeleton className="h-7 w-1/3" />
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  )
}
function AppointmentCard({
  item,
  zone,
  now,
  featured = false,
}: {
  item: Appointment
  zone: string
  now: Date
  featured?: boolean
}) {
  useAdminLanguage()

  const ongoing =
    new Date(item.scheduled_start) <= now &&
    new Date(item.scheduled_end) > now &&
    ['SCHEDULED', 'CONFIRMED'].includes(item.status)
  return (
    <article
      className={`dashboard-appointment ${featured ? 'dashboard-appointment-featured' : ''}`}
    >
      <div className="dashboard-appointment-time">
        <p>{displayTime(item.scheduled_start, zone)}</p>
        <span>{displayTime(item.scheduled_end, zone)}</span>
      </div>
      <div className="dashboard-appointment-body">
        <div className="dashboard-appointment-heading">
          <Link to={`/admin/appointments/${item.id}`}>
            {item.client.first_name} {item.client.last_name}
          </Link>
          <Badge variant="outline" className={`dashboard-status-${item.status.toLowerCase()}`}>
            {t(item.status.replaceAll('_', ' '))}
          </Badge>
        </div>
        <p className="dashboard-service-name">
          {item.main_service?.name || t('Service details in appointment')}
        </p>
        <p className="dashboard-barber">
          <UserRound size={14} aria-hidden="true" />
          {item.barber?.name || t('Unassigned')}
        </p>
        {ongoing && (
          <p className="dashboard-ongoing">
            <span aria-hidden="true" />
            {t("In progress · Started at ")}
            {displayTime(item.scheduled_start, zone)}
          </p>
        )}
        {featured && (
          <Button variant="outline" asChild>
            <Link to={`/admin/appointments/${item.id}`}>
              {t('Open appointment')}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
    </article>
  )
}
function Schedule({ context, now }: { context: Context; now: Date }) {
  useAdminLanguage()

  const key = useAdminKey('appointments')
  const hours = useQuery({
    queryKey: useAdminKey('business-hours'),
    queryFn: ({ signal }) => apiRequest<DayHours[]>('/business-hours', { signal }),
  })
  const [offset, setOffset] = useState(0)
  let range: ReturnType<typeof dayRange> | undefined
  let rangeError = t('The business-local date could not be resolved. Check timezone configuration.')
  try {
    if (hours.data) range = dayRange(now, context.timezone, hours.data)
  } catch (error) {
    if (error instanceof Error && error.message === 'No open business day is configured.')
      rangeError = error.message
    /* Date error shown below; dependent requests disabled. */
  }
  useEffect(() => setOffset(0), [range?.date])
  const current = range && range.start > now.toISOString() ? range.start : now.toISOString()
  const isToday = range?.date === localStampSafe(now, context.timezone)
  const scheduleLabel = isToday ? t("Today's appointments") : t('Next open day’s appointments')
  function path(start: string, limit: number, status?: string) {
    const params = new URLSearchParams({
      from: start,
      to: range?.end || '',
      limit: String(limit),
      offset: status ? '0' : String(offset),
    })
    if (status) params.set('status', status)
    return '/appointments?' + params
  }
  const today = useQuery({
    queryKey: [...key, 'dashboard-day', context.timezone, range?.start, range?.end, offset],
    enabled: !!range,
    queryFn: ({ signal }) => apiRequest<Page<Appointment>>(path(range!.start, 25), { signal }),
    refetchInterval: 60_000,
  })
  const scheduled = useQuery({
    queryKey: [...key, 'dashboard-next', 'SCHEDULED', context.timezone, range?.end, current],
    enabled: !!range,
    queryFn: ({ signal }) =>
      apiRequest<Page<Appointment>>(path(current, 1, 'SCHEDULED'), { signal }),
  })
  const confirmed = useQuery({
    queryKey: [...key, 'dashboard-next', 'CONFIRMED', context.timezone, range?.end, current],
    enabled: !!range,
    queryFn: ({ signal }) =>
      apiRequest<Page<Appointment>>(path(current, 1, 'CONFIRMED'), { signal }),
  })
  if (!hours.data) return <State query={hours} label={t('business hours')} />
  if (!range) return <p role="alert">{t(rangeError)}</p>
  const next = [...(scheduled.data?.items || []), ...(confirmed.data?.items || [])]
    .filter(
      (item) =>
        ['SCHEDULED', 'CONFIRMED'].includes(item.status) &&
        new Date(item.scheduled_end) > now &&
        new Date(item.scheduled_start) < new Date(range.end),
    )
    .sort(
      (a, b) => a.scheduled_start.localeCompare(b.scheduled_start) || a.id.localeCompare(b.id),
    )[0]
  const alerts =
    today.data?.items.filter(
      (item) =>
        !item.barber &&
        ['SCHEDULED', 'CONFIRMED'].includes(item.status) &&
        new Date(item.scheduled_end) > now,
    ) || []
  return (
    <div className="dashboard-day-column">
      <Panel title={t('Next appointment')} icon={<Clock size={19} />} className="dashboard-next">
        {scheduled.isError || confirmed.isError ? (
          <div role="alert">
            <p>{t('Could not load the next appointment.')}</p>
            <Button
              variant="outline"
              onClick={() => {
                void scheduled.refetch()
                void confirmed.refetch()
              }}
            >
              {t('Retry next appointment')}
            </Button>
          </div>
        ) : scheduled.isPending || confirmed.isPending ? (
          <div role="status">
            <span className="sr-only">{t('Loading next appointment…')}</span>
            <Skeleton className="h-36 rounded-xl" />
          </div>
        ) : next ? (
          <AppointmentCard item={next} zone={context.timezone} now={now} featured />
        ) : (
          <EmptyState>
            {isToday
              ? t('No upcoming appointments today.')
              : t('No upcoming appointments on the next open day.')}
          </EmptyState>
        )}
      </Panel>
      <Panel title={scheduleLabel} icon={<CalendarDays size={19} />} className="dashboard-schedule">
        {!isToday && (
          <p className="text-sm text-muted-foreground mb-4">
            {t("Today is closed. Showing ")}
            {range.date}
            {t(', the next open day.')}
          </p>
        )}
        {today.data ? (
          <>
            {today.isError && <State query={today} label={t("today's appointments")} />}
            {today.isFetching && <p role="status">{t('Refreshing schedule…')}</p>}
            <div className="dashboard-schedule-summary">
              <span className="dashboard-count">{today.data.total}</span>
              <div>
                <p>
                  {t("appointments · ")}
                  {range.date} · {context.timezone}
                </p>
                <span>{t('All statuses included · business-local day')}</span>
              </div>
            </div>
            <div className="dashboard-agenda">
              {today.data.items.map((item) => (
                <AppointmentCard key={item.id} item={item} zone={context.timezone} now={now} />
              ))}
            </div>
            {!today.data.total && !today.isError && (
              <EmptyState>
                {isToday ? t('No appointments today.') : t('No appointments on the next open day.')}
              </EmptyState>
            )}
            <div className="dashboard-pagination">
              <Button
                variant="outline"
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 25))}
              >
                {t('Previous')}
              </Button>
              <span>
                {t("Showing ")}
                {today.data.total ? offset + 1 : 0}–
                {Math.min(offset + today.data.items.length, today.data.total)} {t(' of ')}
                {today.data.total}
              </span>
              <Button
                variant="outline"
                disabled={offset + 25 >= today.data.total}
                onClick={() => setOffset(offset + 25)}
              >
                {t('Next')}
              </Button>
            </div>
            <Button variant="outline" asChild>
              <Link to="/admin/appointments">
                {t('View full schedule')}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </>
        ) : (
          <State query={today} label={t("today's appointments")} />
        )}
      </Panel>
      <Panel
        title={t('Appointment alerts')}
        icon={<AlertTriangle size={19} />}
        className="dashboard-alerts"
      >
        {today.data ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {t('Unassigned active appointments on this schedule page.')}
            </p>
            {alerts.length ? (
              alerts.map((item) => (
                <p className="dashboard-assignment-alert" key={item.id}>
                  <Link to={`/admin/appointments/${item.id}`}>
                    {t("Unassigned: ")}
                    {item.client.first_name} {item.client.last_name}
                  </Link>
                </p>
              ))
            ) : today.isError ? (
              <p className="text-sm text-muted-foreground">
                {t(
                  'Current appointment alerts are unavailable until the schedule refresh succeeds.',
                )}
              </p>
            ) : (
              <EmptyState>{t('No unassigned upcoming appointments on this page.')}</EmptyState>
            )}
          </>
        ) : (
          <p>{t('Alerts are available when this schedule page loads.')}</p>
        )}
      </Panel>
    </div>
  )
}
export function DashboardPage() {
  useAdminLanguage()

  const cache = useQueryClient()
  const owner = useAuth().actor?.role === 'OWNER'
  const appointmentsKey = useAdminKey('appointments')
  const productsKey = useAdminKey('products')
  const feedbackKey = useAdminKey('feedback')
  const [now, refreshClock] = useClock()
  const context = useQuery({
    queryKey: [...appointmentsKey, 'context'],
    queryFn: ({ signal }) => apiRequest<Context>('/appointments/context', { signal }),
  })
  const stock = useQuery({
    queryKey: [...productsKey, 'dashboard-low'],
    queryFn: ({ signal }) =>
      apiRequest<Page<Stock>>('/products?active=true&low_stock=true&limit=5&offset=0', { signal }),
  })
  const feedback = useQuery({
    queryKey: [...feedbackKey, 'dashboard-pending'],
    queryFn: ({ signal }) =>
      apiRequest<Page<Feedback>>('/feedback?status=PENDING&limit=1&offset=0', { signal }),
  })
  const refreshing = context.isFetching || stock.isFetching || feedback.isFetching
  return (
    <section className="dashboard-workspace space-y-6">
      <div className="dashboard-welcome">
        <div>
          <p className="dashboard-eyebrow">
            {t('YOUR STUDIO · ')}
            {owner ? 'OWNER' : 'STAFF'}
          </p>
          <h1>{t('Admin dashboard')}</h1>
          <p className="dashboard-welcome-copy">
            {owner
              ? t('Keep the day running smoothly.')
              : t('Your day at the studio, in one place.')}
          </p>
          {context.data && (
            <p className="dashboard-local-time">
              <Clock size={15} aria-hidden="true" />
              {businessDate(now, context.data.timezone)} · {context.data.timezone}
            </p>
          )}
        </div>
        <div className={`dashboard-quick-actions ${owner ? 'dashboard-owner-actions' : ''}`}>
          {owner && (
            <Button asChild>
              <Link className="dashboard-primary" to="/admin/appointments/new">
                <Plus size={17} aria-hidden="true" />
                {t('Create appointment')}
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to="/admin/clients">
              <Search size={17} aria-hidden="true" />
              {t('Search client')}
            </Link>
          </Button>
          <Button
            variant="outline"
            aria-busy={refreshing}
            onClick={() => {
              refreshClock()
              void cache.invalidateQueries({ queryKey: appointmentsKey })
              void context.refetch()
              void stock.refetch()
              void feedback.refetch()
            }}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {t('Refresh dashboard')}
          </Button>
        </div>
      </div>
      {context.isError && context.data && <State query={context} label={t('business timezone')} />}
      <div className="dashboard-layout">
        {context.data ? (
          <Schedule context={context.data} now={now} />
        ) : (
          <div className="dashboard-context">
            <State query={context} label={t('business timezone')} />
          </div>
        )}
        <aside className="dashboard-side-column" aria-label={t('Studio follow-ups')}>
          <Panel title={t('Low stock')} icon={<Package size={19} />} className="dashboard-stock">
            {stock.data ? (
              <>
                {stock.isError && <State query={stock} label={t('inventory status')} />}
                <div className="dashboard-summary">
                  <span className="dashboard-count">{stock.data.total}</span>
                  <p>
                    {stock.data.total} {t(' active low-stock products')}
                  </p>
                </div>
                <div className="dashboard-stock-list">
                  {stock.data.items.map((item) => (
                    <article key={item.id} className="dashboard-stock-item">
                      <div>
                        <Link className="dashboard-stock-name" to={`/admin/products/${item.id}`}>
                          {item.name}
                        </Link>
                        <p>
                          {t("Current stock: ")}
                          {item.current_stock} {t(' · Minimum: ')}
                          {item.minimum_stock}
                        </p>
                      </div>
                      <span
                        className="dashboard-stock-balance"
                        aria-label={t('Current stock {quantity}', {
                          quantity: stockNumber(item.current_stock),
                        })}
                      >
                        {stockNumber(item.current_stock)}
                      </span>
                      {owner && (
                        <Button className="dashboard-stock-action" variant="outline" asChild>
                          <Link to={`/admin/products/${item.id}`}>
                            {t('Update stock')}
                            <ArrowRight size={14} aria-hidden="true" />
                          </Link>
                        </Button>
                      )}
                    </article>
                  ))}
                </div>
                {!stock.data.total && !stock.isError && (
                  <EmptyState>{t('Stock levels look good.')}</EmptyState>
                )}
                {stock.data.total > stock.data.items.length && (
                  <p className="text-xs text-muted-foreground mb-3">
                    {t("Showing ")}
                    {stock.data.items.length} {t(' of ')}
                    {stock.data.total} {t(" low-stock products.")}
                  </p>
                )}
                <Button variant="outline" asChild>
                  <Link to="/admin/inventory">
                    {t('Open inventory')}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </Button>
              </>
            ) : (
              <State query={stock} label={t('inventory status')} />
            )}
          </Panel>
          <Panel
            title={t('Pending feedback')}
            icon={<MessageSquare size={19} />}
            className="dashboard-feedback"
          >
            {feedback.data ? (
              <>
                {feedback.isError && <State query={feedback} label={t('pending feedback')} />}
                <div className="dashboard-summary">
                  <span className="dashboard-count">{feedback.data.total}</span>
                  <p>
                    {feedback.data.total
                      ? t('{count} feedback items awaiting review.', { count: feedback.data.total })
                      : feedback.isError
                        ? t('Last loaded count: 0.')
                        : t('No pending feedback.')}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {owner
                    ? t('Review submissions before choosing what to publish.')
                    : t('Feedback moderation is managed by the Owner.')}
                </p>
                <Button variant="outline" asChild>
                  <Link to="/admin/feedback">
                    {owner ? t('Review feedback') : t('View feedback')}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </Button>
              </>
            ) : (
              <State query={feedback} label={t('pending feedback')} />
            )}
          </Panel>
        </aside>
      </div>
    </section>
  )
}
