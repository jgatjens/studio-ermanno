import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { formatHours, type DayHours } from '@/lib/business-hours'
import { useAuth } from '@/auth/auth-provider'
import { useAdminKey } from './query-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock } from 'lucide-react'

type Day = DayHours
const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export function HoursPage() {
  const { actor } = useAuth()
  const key = useAdminKey('business-hours')
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiRequest<Day[]>('/business-hours', { signal }),
  })
  return (
    <section className="hours-workspace space-y-6">
      <h1 className="text-3xl font-semibold">Business hours</h1>
      <p className="text-sm text-muted-foreground">
        Shared by all active hairdressers.{' '}
        {actor?.role === 'OWNER'
          ? 'Set weekly opening times and optional breaks.'
          : 'Staff access is read only.'}
      </p>
      <Card>
        <CardContent className="hours-guidance">
          <Clock size={20} aria-hidden="true" />
          <p>
            Enter times in the business’s local timezone. For split days, set the break closure and
            reopening times; save the whole week together.
          </p>
        </CardContent>
      </Card>
      {query.isPending && (
        <div role="status">
          <span className="sr-only">Loading business hours…</span>
          <div className="hours-grid" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-48 rounded-xl" />
            ))}
          </div>
        </div>
      )}
      {query.isError && (
        <div>
          <p role="alert">{query.error.message}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {query.data && <Week initial={query.data} owner={actor?.role === 'OWNER'} />}
    </section>
  )
}
function Week({ initial, owner }: { initial: Day[]; owner: boolean }) {
  const key = useAdminKey('business-hours')
  const client = useQueryClient()
  const [days, setDays] = useState<Day[]>(() =>
    names.map(
      (_, day) =>
        initial.find((item) => item.day_of_week === day) ?? {
          day_of_week: day,
          is_closed: true,
          opening_time: null,
          closing_time: null,
          break_start: null,
          break_end: null,
        },
    ),
  )
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<Day[]>('/business-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: days.map((day) => ({
            day_of_week: day.day_of_week,
            is_closed: day.is_closed,
            opening_time: day.is_closed ? null : day.opening_time,
            closing_time: day.is_closed ? null : day.closing_time,
            // Omitted optional fields default to null on the API, including when clearing a break.
            // Older API versions reject break fields even when their values are null.
            ...(!day.is_closed && day.break_start != null ? { break_start: day.break_start } : {}),
            ...(!day.is_closed && day.break_end != null ? { break_end: day.break_end } : {}),
          })),
        }),
      }),
    onSuccess: async (data) => {
      setDays(data)
      await client.invalidateQueries({ queryKey: key })
    },
  })
  function change(index: number, patch: Partial<Day>) {
    setDays((current) =>
      current.map((day) => (day.day_of_week === index ? { ...day, ...patch } : day)),
    )
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!mutation.isPending) mutation.mutate()
  }
  const visibleDays = owner ? days : initial
  function timeInput(
    day: Day,
    field: 'opening_time' | 'closing_time' | 'break_start' | 'break_end',
    label: string,
  ) {
    return (
      <label>
        {label}
        <Input
          aria-label={`${names[day.day_of_week]} ${label.toLowerCase()}`}
          type="time"
          required
          value={day[field]?.slice(0, 5) ?? ''}
          onChange={(e) => change(day.day_of_week, { [field]: e.target.value })}
        />
      </label>
    )
  }
  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="hours-grid">
        {visibleDays.map((day) => (
          <fieldset
            disabled={mutation.isPending}
            key={day.day_of_week}
            className="hours-day space-y-4"
          >
            <legend className="font-semibold">{names[day.day_of_week]}</legend>
            <div className="hours-day-status">
              <Badge variant="outline">{day.is_closed ? 'Closed' : 'Open'}</Badge>
              {!day.is_closed && (day.break_start != null || day.break_end != null) && (
                <Badge variant="outline">Split day</Badge>
              )}
            </div>
            {owner ? (
              <>
                <label className="hours-toggle">
                  <input
                    aria-label={`${names[day.day_of_week]} closed`}
                    type="checkbox"
                    checked={day.is_closed}
                    onChange={(e) =>
                      change(day.day_of_week, {
                        is_closed: e.target.checked,
                        opening_time: e.target.checked ? null : '09:00',
                        closing_time: e.target.checked ? null : '18:00',
                        break_start: null,
                        break_end: null,
                      })
                    }
                  />
                  Closed
                </label>
                {!day.is_closed && (
                  <>
                    <div className="hours-time-pair">
                      {timeInput(day, 'opening_time', 'Opening')}
                      {timeInput(day, 'closing_time', 'Final closing')}
                    </div>
                    <label className="hours-toggle">
                      <input
                        aria-label={`${names[day.day_of_week]} split opening periods`}
                        type="checkbox"
                        checked={day.break_start != null || day.break_end != null}
                        onChange={(e) =>
                          change(day.day_of_week, {
                            break_start: e.target.checked ? '' : null,
                            break_end: e.target.checked ? '' : null,
                          })
                        }
                      />
                      Split opening periods
                    </label>
                    {(day.break_start != null || day.break_end != null) && (
                      <div className="hours-time-pair">
                        {timeInput(day, 'break_start', 'Closes for break')}
                        {timeInput(day, 'break_end', 'Reopens')}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <p>{formatHours(day)}</p>
            )}
          </fieldset>
        ))}
      </div>
      {owner && (
        <div className="hours-save-row">
          <p className="text-sm text-muted-foreground">
            Changes apply to the entire weekly schedule.
          </p>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save week'}
          </Button>
        </div>
      )}
      {mutation.isError && <p role="alert">{mutation.error.message}</p>}
      {mutation.isSuccess && <p role="status">Saved.</p>}
    </form>
  )
}
