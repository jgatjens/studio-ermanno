import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { formatHours, type DayHours } from '@/lib/business-hours'
import { useAuth } from '@/auth/auth-provider'
import { useAdminKey } from './query-provider'
import { Button } from '@/components/ui/button'

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
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Business hours</h1>
      <p>Shared by all active barbers.</p>
      {query.isPending && <p role="status">Loading business hours…</p>}
      {query.isError && (
        <div>
          <p role="alert">{query.error.message}</p>
          <Button onClick={() => void query.refetch()}>Retry</Button>
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
    mutation.mutate()
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
        <input
          aria-label={`${names[day.day_of_week]} ${label.toLowerCase()}`}
          className="block rounded-md border border-input p-2"
          type="time"
          required
          value={day[field]?.slice(0, 5) ?? ''}
          onChange={(e) => change(day.day_of_week, { [field]: e.target.value })}
        />
      </label>
    )
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      {visibleDays.map((day) => (
        <fieldset key={day.day_of_week} className="space-y-2 rounded-md border border-input p-4">
          <legend className="font-semibold">{names[day.day_of_week]}</legend>
          {owner ? (
            <>
              <label className="flex items-center gap-2">
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
                  <div className="flex flex-wrap gap-4">
                    {timeInput(day, 'opening_time', 'Opening')}
                    {timeInput(day, 'closing_time', 'Final closing')}
                  </div>
                  <label className="flex items-center gap-2">
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
                    <div className="flex flex-wrap gap-4">
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
      {owner && (
        <Button disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save week'}
        </Button>
      )}
      {mutation.isError && <p role="alert">{mutation.error.message}</p>}
      {mutation.isSuccess && <p role="status">Saved.</p>}
    </form>
  )
}
