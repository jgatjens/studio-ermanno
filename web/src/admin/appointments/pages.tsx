import { t, useAdminLanguage, adminLocale } from '@/admin/i18n'
import type { DayHours } from '@/lib/business-hours'
import { SchedulePicker } from './schedule-picker'
import { dayRange } from './business-day'
import { FormError } from '../form-error'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { ApiError, apiRequest } from '@/lib/api'
import { useAdminKey } from '../query-provider'
import { displayTime, localStamp, nextDate, timeChoices, toInstant } from './time'
import type { Appointment, Barber, CatalogService, Client, Context, Page, Totals } from './types'
import { ArrowRight, CalendarDays, Check, Clock, Plus, Scissors, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
const field = 'block w-full min-w-0 rounded border p-3'
const action = 'rounded border px-3 py-2'
function ErrorView({ error, retry }: { error: Error; retry: () => void }) {
  useAdminLanguage()

  return (
    <div role="alert">
      <p>
        {error instanceof ApiError && error.status === 404
          ? t('Appointment not found.')
          : error.message}
      </p>
      <button type="button" className={action} onClick={retry}>
        {t("Retry ")}
      </button>
    </div>
  )
}
function Pagination({
  offset,
  total,
  setOffset,
}: {
  offset: number
  total: number
  setOffset: (n: number) => void
}) {
  useAdminLanguage()

  return (
    <div className="appointment-pagination">
      <p className="text-sm text-muted-foreground">
        {total} {t(' appointments')}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 25))}
        >
          {t('Previous')}
        </Button>
        <Button
          variant="outline"
          disabled={offset + 25 >= total}
          onClick={() => setOffset(offset + 25)}
        >
          {t('Next')}
        </Button>
      </div>
    </div>
  )
}
const statusNames: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
}
function appointmentTime(instant: string, timezone: string) {
  return new Intl.DateTimeFormat(adminLocale(), {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant))
}
function appointmentDate(day: string) {
  return new Intl.DateTimeFormat(adminLocale(), {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(day + 'T12:00:00Z'))
}
function AppointmentCards({ items, context }: { items: Appointment[]; context: Context }) {
  useAdminLanguage()

  const groups = new Map<string, Appointment[]>()
  for (const item of items) {
    const day = localStamp(item.scheduled_start, context.timezone).slice(0, 10)
    groups.set(day, [...(groups.get(day) || []), item])
  }
  return (
    <div className="space-y-6">
      {Array.from(groups, ([day, appointments]) => (
        <section key={day} className="space-y-3">
          <h2 className="appointment-day-heading">{appointmentDate(day)}</h2>
          <ul className="appointment-list">
            {appointments.map((item) => (
              <li key={item.id}>
                <Card className="appointment-card">
                  <Link
                    className="appointment-card-link"
                    to={`/admin/appointments/${item.id}`}
                    aria-label={`${item.client.first_name} ${item.client.last_name}`}
                  >
                    <div className="appointment-time">
                      <strong>{appointmentTime(item.scheduled_start, context.timezone)}</strong>
                      <span>
                        {t('to ')}
                        {appointmentTime(item.scheduled_end, context.timezone)}
                      </span>
                      <span className="appointment-duration">
                        <Clock size={14} aria-hidden="true" />
                        {item.final_duration_minutes} {t(" min")}
                      </span>
                    </div>
                    <div className="appointment-card-body">
                      <div className="appointment-card-heading">
                        <h3>
                          {item.client.first_name} {item.client.last_name}
                        </h3>
                        <Badge
                          variant="outline"
                          className="appointment-status"
                          data-status={item.status}
                        >
                          {t(statusNames[item.status] || item.status)}
                        </Badge>
                      </div>
                      <p className="appointment-service">
                        <Scissors size={16} aria-hidden="true" />
                        <span>{item.main_service?.name || t('No service recorded')}</span>
                      </p>
                      <div className="appointment-meta">
                        <span className={item.barber ? '' : 'appointment-unassigned'}>
                          <UserRound size={16} aria-hidden="true" />
                          {item.barber?.name || t('Unassigned')}
                        </span>
                        <span>
                          {item.final_price} {context.currency}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="appointment-open-icon" size={18} aria-hidden="true" />
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
function useContext() {
  const key = useAdminKey('appointments')
  return useQuery({
    queryKey: [...key, 'context'],
    queryFn: ({ signal }) => apiRequest<Context>('/appointments/context', { signal }),
  })
}
export function AppointmentsPage() {
  useAdminLanguage()

  const context = useContext()
  const hours = useQuery({
    queryKey: useAdminKey('business-hours'),
    queryFn: ({ signal }) => apiRequest<DayHours[]>('/business-hours', { signal }),
  })
  if (context.isPending) return <p role="status">{t('Loading business timezone…')}</p>
  if (context.isError)
    return <ErrorView error={context.error} retry={() => void context.refetch()} />
  if (hours.isPending) return <p role="status">{t('Loading business hours…')}</p>
  if (hours.isError) return <ErrorView error={hours.error} retry={() => void hours.refetch()} />
  return <AppointmentList context={context.data} hours={hours.data} />
}
function AppointmentList({ context, hours }: { context: Context; hours: DayHours[] }) {
  useAdminLanguage()

  const owner = useAuth().actor?.role === 'OWNER'
  const key = useAdminKey('appointments')
  const today = localStamp(new Date(), context.timezone).slice(0, 10)
  let defaultDate = today
  let hoursError = ''
  try {
    defaultDate = dayRange(new Date(), context.timezone, hours).date
  } catch (error) {
    hoursError = (error as Error).message
  }
  const [from, setFrom] = useState(defaultDate)
  const [to, setTo] = useState(defaultDate)
  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)
  let dateError = ''
  let params = new URLSearchParams({ limit: '25', offset: String(offset) })
  try {
    if (from > to) throw new Error(t('End date must follow start date.'))
    params.set(
      'from',
      timeChoices(from + 'T00:00', context.timezone)[0]?.instant ||
        toInstant(from + 'T00:00', context.timezone),
    )
    params.set(
      'to',
      timeChoices(nextDate(to) + 'T00:00', context.timezone)[0]?.instant ||
        toInstant(nextDate(to) + 'T00:00', context.timezone),
    )
  } catch (error) {
    dateError = (error as Error).message
  }
  if (status) params.set('status', status)
  const query = useQuery({
    queryKey: [...key, 'list', params.toString()],
    enabled: !dateError && !hoursError,
    queryFn: ({ signal }) => apiRequest<Page<Appointment>>('/appointments?' + params, { signal }),
  })
  function resetFilters() {
    setFrom(defaultDate)
    setTo(defaultDate)
    setStatus('')
    setOffset(0)
  }
  return (
    <section className="appointments-workspace space-y-6">
      <div className="appointment-page-heading">
        <div>
          <h1>{t('Appointments')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('Review the schedule and open an appointment for details.')}
          </p>
        </div>
        {owner && (
          <Button asChild>
            <Link to="/admin/appointments/new">
              <Plus size={18} aria-hidden="true" />
              {t('Create appointment')}
            </Link>
          </Button>
        )}
      </div>
      {hoursError && <p role="alert">{t(hoursError)}</p>}
      {defaultDate !== today && (
        <p className="text-sm text-muted-foreground">
          {t("Today is closed. The default schedule is ")}
          {appointmentDate(defaultDate)}
          {t(', the next open day.')}
        </p>
      )}
      <Card>
        <CardContent>
          <div className="appointment-filter-heading">
            <div>
              <p className="font-medium">{t('Schedule filters')}</p>
              <p className="text-sm text-muted-foreground">
                {t('Business timezone: ')}
                {context.timezone}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setFrom(defaultDate)
                setTo(defaultDate)
                setOffset(0)
              }}
            >
              <CalendarDays size={16} aria-hidden="true" />
              {defaultDate === today ? t('Today') : t('Next open day')}
            </Button>
          </div>
          <div className="appointment-filters">
            <Field>
              <FieldLabel htmlFor="appointments-from">{t('From date')}</FieldLabel>
              <Input
                className="h-11"
                id="appointments-from"
                type="date"
                required
                value={from}
                aria-invalid={!!dateError}
                aria-describedby={dateError ? 'appointments-date-error' : undefined}
                onChange={(e) => {
                  setFrom(e.target.value)
                  setOffset(0)
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="appointments-to">{t('Through date')}</FieldLabel>
              <Input
                className="h-11"
                id="appointments-to"
                type="date"
                required
                value={to}
                aria-invalid={!!dateError}
                aria-describedby={dateError ? 'appointments-date-error' : undefined}
                onChange={(e) => {
                  setTo(e.target.value)
                  setOffset(0)
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="appointments-status">{t('Status')}</FieldLabel>
              <NativeSelect
                className="h-11"
                id="appointments-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setOffset(0)
                }}
              >
                <NativeSelectOption value="">{t('All statuses')}</NativeSelectOption>
                {Object.entries(statusNames).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {t(label)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="appointment-filter-footer">
            <p className="text-xs text-muted-foreground">
              {t('Dates and times follow the business timezone.')}
            </p>
            <Button variant="outline" onClick={resetFilters}>
              {t('Reset filters')}
            </Button>
          </div>
          {dateError && (
            <p role="alert" id="appointments-date-error">
              {t(dateError)}
            </p>
          )}
        </CardContent>
      </Card>
      {dateError || hoursError ? null : query.isPending ? (
        <div role="status">
          <span className="sr-only">{t('Loading appointments…')}</span>
          <div className="space-y-3" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      ) : query.isError ? (
        <ErrorView error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {query.data.items.length > 0 ? (
            <AppointmentCards items={query.data.items} context={context} />
          ) : (
            <Card>
              <CardContent className="appointment-empty">
                <CalendarDays size={32} aria-hidden="true" />
                <h2>{t('No appointments in this range.')}</h2>
                <p className="text-sm text-muted-foreground">
                  {status
                    ? t('Try a different status or reset your filters.')
                    : t('Choose another date range to explore the schedule.')}
                </p>
                {owner && (
                  <Button asChild>
                    <Link to="/admin/appointments/new">
                      <Plus size={16} aria-hidden="true" />
                      {t('Create appointment')}
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          <Pagination offset={offset} total={query.data.total} setOffset={setOffset} />
        </>
      )}
    </section>
  )
}
export function AppointmentDetailPage() {
  useAdminLanguage()

  const { appointmentId } = useParams()
  const owner = useAuth().actor?.role === 'OWNER'
  const key = useAdminKey('appointments')
  const clientsKey = useAdminKey('clients')
  const cache = useQueryClient()
  const context = useContext()
  const location = useLocation()
  const [confirm, setConfirm] = useState('')
  const query = useQuery({
    queryKey: [...key, 'detail', appointmentId],
    queryFn: ({ signal }) => apiRequest<Appointment>(`/appointments/${appointmentId}`, { signal }),
  })
  const mutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest<Appointment>(`/appointments/${appointmentId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onSuccess: async () => {
      setConfirm('')
      await Promise.all([
        cache.invalidateQueries({ queryKey: key }),
        cache.invalidateQueries({ queryKey: clientsKey }),
      ])
    },
  })
  if (query.isError || context.isError)
    return (
      <ErrorView
        error={query.error || context.error!}
        retry={() => {
          void query.refetch()
          void context.refetch()
        }}
      />
    )
  if (query.isPending || context.isPending) return <p role="status">{t('Loading appointment…')}</p>
  const item = query.data
  const active = ['SCHEDULED', 'CONFIRMED'].includes(item.status)
  return (
    <section className="appointment-detail-workspace break-words">
      <Link to="/admin/appointments">{t('Back to appointments')}</Link>
      <div className="appointment-detail-heading">
        <h1>{t('Appointment')}</h1>
        <Badge variant="outline">{t(item.status)}</Badge>
      </div>
      {location.state?.saved && <p role="status">{t('Appointment saved.')}</p>}
      {location.state?.completed && <p role="status">{t('Appointment completed.')}</p>}
      <div className="appointment-detail-grid">
        <section className="appointment-detail-card">
          <h2>
            <UserRound size={20} aria-hidden="true" />
            {t('Client')}
          </h2>
          <Link to={`/admin/clients/${item.client.id}`}>
            {item.client.first_name} {item.client.last_name}
          </Link>
          {owner && (
            <p>
              {item.client.email} {item.client.phone}
            </p>
          )}
        </section>
        <section className="appointment-detail-card">
          <h2>
            <CalendarDays size={20} aria-hidden="true" />
            {t('Schedule')}
          </h2>
          <p>
            {displayTime(item.scheduled_start, context.data.timezone)} –{' '}
            {displayTime(item.scheduled_end, context.data.timezone)} ({context.data.timezone})
          </p>
          <p>
            {t(item.status)} · {item.barber?.name || t('Unassigned')}
          </p>
        </section>
        <section className="appointment-detail-card">
          <h2>
            <Clock size={20} aria-hidden="true" />
            {t('Totals')}
          </h2>
          <p>
            {t("Final: ")}
            {item.final_duration_minutes} {t(' minutes · ')}
            {item.final_price} {context.data.currency}
          </p>
          <p>
            {t("Calculated: ")}
            {item.calculated_duration_minutes} {t(' minutes · ')}
            {item.calculated_price} {context.data.currency}
          </p>
        </section>
        <section className="appointment-detail-card">
          <h2>
            <Scissors size={20} aria-hidden="true" />
            {t('Services')}
          </h2>
          <ul>
            {item.services.map((s) => (
              <li key={s.service_id}>
                {s.name} · {s.duration_minutes} {t(' minutes · ')}
                {s.price}
              </li>
            ))}
          </ul>
        </section>
        <section className="appointment-detail-card appointment-detail-notes">
          <h2>{t('Notes and products')}</h2>
          {!item.appointment_notes &&
            !(owner && item.visit_notes) &&
            !item.products.some((p) => owner || p.usage_type === 'USED') && (
              <p className="text-muted-foreground">{t('No notes or products recorded.')}</p>
            )}
          {item.appointment_notes && (
            <p>
              {t('Appointment notes: ')}
              {item.appointment_notes}
            </p>
          )}
          {owner && item.visit_notes && (
            <p>
              {t('Visit notes: ')}
              {item.visit_notes}
            </p>
          )}
          <ul>
            {item.products
              .filter((p) => owner || p.usage_type === 'USED')
              .map((p, i) => (
                <li key={i}>
                  {p.name} · {p.quantity} · {t(p.usage_type)}
                </li>
              ))}
          </ul>
        </section>
      </div>
      {owner && active && (
        <div className="appointment-detail-actions">
          <Link to={`/admin/appointments/${item.id}/edit`}>{t('Edit appointment')}</Link>
          <Link to={`/admin/appointments/${item.id}/complete`}>{t('Complete appointment')}</Link>
          {item.status === 'SCHEDULED' && (
            <button
              className={action}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate('CONFIRMED')}
            >
              {t('Confirm appointment')}
            </button>
          )}
          <button className={`${action} admin-danger`} onClick={() => setConfirm('CANCELLED')}>
            {t('Cancel appointment')}
          </button>
          <button className={`${action} admin-danger`} onClick={() => setConfirm('NO_SHOW')}>
            {t('Mark no-show')}
          </button>
        </div>
      )}
      {confirm && (
        <div role="group" aria-label={t('Confirm status change')}>
          <p>
            {t("Change the appointment for ")}
            {item.client.first_name} {item.client.last_name} {t(' to ')}
            {confirm}
            {t('? This removes it from active scheduling.')}
          </p>
          <button
            className={action}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(confirm)}
          >
            {t('Yes, change status')}
          </button>
          <button className={action} onClick={() => setConfirm('')}>
            {t('Keep appointment')}
          </button>
        </div>
      )}
      {mutation.isPending && <p role="status">{t('Saving status…')}</p>}
      {mutation.isSuccess && <p role="status">{t('Status saved.')}</p>}
      {mutation.isError && <FormError message={mutation.error.message} />}
    </section>
  )
}
export function AppointmentFormPage() {
  useAdminLanguage()

  const owner = useAuth().actor?.role === 'OWNER'
  const { appointmentId } = useParams()
  const key = useAdminKey('appointments')
  const context = useContext()
  const query = useQuery({
    queryKey: [...key, 'detail', appointmentId],
    enabled: owner && !!appointmentId,
    queryFn: ({ signal }) => apiRequest<Appointment>(`/appointments/${appointmentId}`, { signal }),
  })
  if (!owner) return <p role="alert">{t('Access denied.')}</p>
  if (context.isError || query.isError)
    return (
      <ErrorView
        error={context.error || query.error!}
        retry={() => {
          void context.refetch()
          void query.refetch()
        }}
      />
    )
  if (context.isPending || (appointmentId && query.isPending))
    return <p role="status">{t('Loading appointment form…')}</p>
  if (query.data && !['SCHEDULED', 'CONFIRMED'].includes(query.data.status))
    return <p role="alert">{t('This appointment is read only.')}</p>
  return (
    <AppointmentForm key={appointmentId || 'new'} context={context.data} existing={query.data} />
  )
}
function AppointmentForm({ context, existing }: { context: Context; existing?: Appointment }) {
  useAdminLanguage()

  const hours = useQuery({
    queryKey: useAdminKey('business-hours'),
    queryFn: ({ signal }) => apiRequest<DayHours[]>('/business-hours', { signal }),
  })
  const key = useAdminKey('appointments')
  const clientsKey = useAdminKey('clients')
  const cache = useQueryClient()
  const navigate = useNavigate()
  const [client, setClient] = useState<Client | null>(existing?.client || null)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [local, setLocal] = useState(
    existing ? localStamp(existing.scheduled_start, context.timezone) : '',
  )
  const [offset, setOffset] = useState(() =>
    existing
      ? timeChoices(localStamp(existing.scheduled_start, context.timezone), context.timezone).find(
          (c) => c.instant === new Date(existing.scheduled_start).toISOString(),
        )?.offset || ''
      : '',
  )
  const [serviceIds, setServiceIds] = useState(existing?.services.map((s) => s.service_id) || [])
  const [barber, setBarber] = useState(existing?.barber?.id || '')
  const [notes, setNotes] = useState(existing?.appointment_notes || '')
  const [duration, setDuration] = useState(
    existing && existing.final_duration_minutes !== existing.calculated_duration_minutes
      ? String(existing.final_duration_minutes)
      : '',
  )
  const [price, setPrice] = useState(
    existing && Number(existing.final_price) !== Number(existing.calculated_price)
      ? String(existing.final_price)
      : '',
  )
  const [notice, setNotice] = useState('')
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])
  const clients = useQuery({
    queryKey: [...clientsKey, 'selection', 'recent', q],
    queryFn: ({ signal }) =>
      apiRequest<Page<Client>>(
        `/clients?q=${encodeURIComponent(q)}&limit=${q ? 25 : 2}${q ? '' : '&sort=recent'}`,
        { signal },
      ),
  })
  const services = useQuery({
    queryKey: [...key, 'active-services'],
    queryFn: ({ signal }) => apiRequest<CatalogService[]>('/services?active=true', { signal }),
  })
  const barbers = useQuery({
    queryKey: [...key, 'active-barbers'],
    queryFn: ({ signal }) => apiRequest<Barber[]>('/barbers?active=true', { signal }),
  })
  const choices = useMemo(() => timeChoices(local, context.timezone), [local, context.timezone])
  let timeError = ''
  let instant = ''
  if (local)
    try {
      instant = toInstant(local, context.timezone, offset)
    } catch (error) {
      timeError = (error as Error).message
    }
  const payload = {
    client_id: client?.id,
    scheduled_start: instant,
    service_ids: serviceIds,
    barber_id: barber || null,
    appointment_notes: notes.trim() || null,
    duration_override_minutes: duration === '' ? null : Number(duration),
    price_override: price === '' ? null : price,
  }
  const preview = useQuery({
    queryKey: [...key, 'preview', existing?.id, payload],
    enabled: !!client && !!instant && serviceIds.length > 0,
    queryFn: ({ signal }) =>
      apiRequest<Totals>('/appointments/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, appointment_id: existing?.id || null }),
        signal,
      }),
    staleTime: 0,
  })
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<Appointment>('/appointments' + (existing ? '/' + existing.id : ''), {
        method: existing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: async (item) => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: key }),
        cache.invalidateQueries({ queryKey: clientsKey }),
      ])
      navigate(`/admin/appointments/${item.id}`, { state: { saved: true } })
    },
  })
  const options = [...(services.data || [])]
  for (const old of existing?.services || [])
    if (!options.some((s) => s.id === old.service_id))
      options.push({
        id: old.service_id,
        name: old.name,
        price: old.price,
        duration_minutes: old.duration_minutes,
        is_active: false,
      })
  return (
    <section className="appointment-form-workspace">
      <Link to={existing ? `/admin/appointments/${existing.id}` : '/admin/appointments'}>
        {t('Back')}
      </Link>
      <h1>{existing ? t('Edit appointment') : t('Create appointment')}</h1>
      <p className="appointment-form-intro">
        {t('Choose a client, services and a time, then review the appointment before saving.')}
      </p>
      <p className="appointment-form-timezone">
        {t('Business timezone: ')}
        {context.timezone}
      </p>
      <form
        className="appointment-editor"
        onSubmit={(event) => {
          event.preventDefault()
          setNotice('')
          if (!client || !instant || !serviceIds.length || !preview.data) {
            setNotice(
              timeError || 'Choose a client, date/time and services, then review the preview.',
            )
            return
          }
          mutation.mutate()
        }}
      >
        <section className="appointment-form-card appointment-client-picker">
          <h2>
            <UserRound size={20} aria-hidden="true" />
            {t('Client')}
          </h2>
          <label>
            {t('Search existing client')}
            <input
              className={field}
              maxLength={200}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Link
            to="/admin/clients/new"
            className="appointment-create-client-link"
            onClick={(event) => {
              if (client || local || serviceIds.length || notes || duration || price) {
                event.preventDefault()
                setLeaving(true)
              }
            }}
          >
            {t('Create client first')}
          </Link>
          {leaving && (
            <div role="group" aria-label={t('Leave appointment draft')}>
              <p>
                {t(
                  'Creating a client leaves this appointment form. Unsaved appointment details will be discarded.',
                )}
              </p>
              <button type="button" onClick={() => navigate('/admin/clients/new')}>
                {t('Leave and create client')}
              </button>
              <button type="button" onClick={() => setLeaving(false)}>
                {t('Keep editing appointment')}
              </button>
            </div>
          )}
          {clients.isPending || search.trim() !== q ? (
            <p>{t('Loading clients…')}</p>
          ) : clients.isError ? (
            <ErrorView error={clients.error} retry={() => void clients.refetch()} />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {q
                  ? t('Search results')
                  : t('Most recently added clients · Search to find another client')}
              </p>
              <ul className="appointment-client-options">
                {clients.data.items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="appointment-client-option"
                      aria-pressed={client?.id === c.id}
                      onClick={() => setClient(c)}
                    >
                      {c.first_name} {c.last_name}
                      {client?.id === c.id && (
                        <span className="appointment-client-selected">
                          <Check size={16} aria-hidden="true" />
                          {t('Selected')}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
                {!clients.data.total && <li>{t('No matching clients.')}</li>}
              </ul>
            </>
          )}
          {client && (
            <p className="appointment-selected-summary" role="status">
              {t("Selected client: ")}
              {client.first_name} {client.last_name}
            </p>
          )}
        </section>
        <section className="appointment-form-card">
          <h2>
            <CalendarDays size={20} aria-hidden="true" />
            {t('Schedule')}
          </h2>
          {hours.isError && <ErrorView error={hours.error} retry={() => void hours.refetch()} />}
          <SchedulePicker
            hours={hours.data || []}
            loading={hours.isPending}
            value={local}
            invalid={!!timeError}
            errorId={timeError ? 'appointment-time-error' : undefined}
            onChange={(value) => {
              setLocal(value)
              setOffset('')
            }}
          />
          {choices.length > 1 && (
            <label>
              {t('UTC offset')}
              <select className={field} value={offset} onChange={(e) => setOffset(e.target.value)}>
                <option value="">{t('Choose offset')}</option>
                {choices.map((c) => (
                  <option key={c.offset}>{c.offset}</option>
                ))}
              </select>
            </label>
          )}
          {timeError && (
            <p role="alert" id="appointment-time-error">
              {t(timeError)}
            </p>
          )}
          <label>
            {t('Hairdresser')}
            <select className={field} value={barber} onChange={(e) => setBarber(e.target.value)}>
              <option value="">{t('Unassigned')}</option>
              {barbers.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              {existing?.barber && !barbers.data?.some((b) => b.id === existing.barber?.id) && (
                <option value={existing.barber.id}>
                  {existing.barber.name} {t(" (inactive; reassign to reschedule)")}
                </option>
              )}
            </select>
          </label>
          {barbers.isError && (
            <ErrorView error={barbers.error} retry={() => void barbers.refetch()} />
          )}
        </section>
        <section className="appointment-form-card">
          <h2>
            <Scissors size={20} aria-hidden="true" />
            {t('Services')}
          </h2>
          <fieldset className="space-y-2">
            <legend className="sr-only">{t('Services')}</legend>
            {services.isPending ? (
              <p>{t('Loading services…')}</p>
            ) : services.isError ? (
              <ErrorView error={services.error} retry={() => void services.refetch()} />
            ) : (
              options.map((s) => (
                <label className="block" key={s.id}>
                  <input
                    type="checkbox"
                    checked={serviceIds.includes(s.id)}
                    onChange={(e) =>
                      setServiceIds(
                        e.target.checked
                          ? [...serviceIds, s.id]
                          : serviceIds.filter((id) => id !== s.id),
                      )
                    }
                  />
                  {s.name}
                  {!s.is_active ? t(' (retained inactive service)') : ''}
                </label>
              ))
            )}
          </fieldset>
          <label>
            {t('Appointment notes')}
            <textarea
              className={field}
              maxLength={10000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </section>
        <section className="appointment-form-card appointment-review">
          <h2>
            <Clock size={20} aria-hidden="true" />
            {t('Review and totals')}
          </h2>
          {preview.isFetching && <p role="status">{t('Calculating preview…')}</p>}
          {preview.isError && <p role="alert">{t(preview.error.message)}</p>}
          {preview.data && !!instant && (
            <div aria-label={t('Appointment preview')}>
              <p>
                {t("Calculated: ")}
                {preview.data.calculated_duration_minutes} {t(' minutes ·')}{' '}
                {preview.data.calculated_price} {context.currency}
              </p>
              <p>
                {t("Final: ")}
                {preview.data.final_duration_minutes} {t(' minutes · ')}
                {preview.data.final_price} {context.currency}
              </p>
              <p>
                {t('Ends: ')}
                {displayTime(preview.data.scheduled_end, context.timezone)}
              </p>
              <p>{t('Capacity is checked again when saving.')}</p>
            </div>
          )}
          <label>
            {t('Duration override (minutes)')}
            <input
              className={field}
              type="number"
              min={1}
              max={1440}
              step={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
          <label>
            {t('Price override')}
            <input
              className={field}
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <p>
            {t(
              'Leave overrides blank to use calculated totals. An override equal to its calculated value is not separately remembered.',
            )}
          </p>
        </section>
        <div className="appointment-form-actions">
          {notice && <FormError message={notice} />}
          {mutation.isError && <FormError message={mutation.error.message} />}
          <button
            type="submit"
            className="appointment-save"
            disabled={mutation.isPending || preview.isFetching || !preview.data}
          >
            {mutation.isPending ? t('Saving…') : t('Save appointment')}
          </button>
          <Link to={existing ? `/admin/appointments/${existing.id}` : '/admin/appointments'}>
            {t('Cancel')}
          </Link>
        </div>
      </form>
    </section>
  )
}
