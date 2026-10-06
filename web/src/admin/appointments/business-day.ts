import type { DayHours } from '@/lib/business-hours'
import { localStamp, nextDate, timeChoices } from './time'

export function dayRange(now: Date, zone: string, hours: DayHours[] = []) {
  let date = localStamp(now, zone).slice(0, 10)
  for (let offset = 0; offset < 7; offset++) {
    const weekday = (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7
    if (!hours.find((day) => day.day_of_week === weekday)?.is_closed) break
    if (offset === 6) throw Error('No open business day is configured.')
    date = nextDate(date)
  }
  const start = timeChoices(date + 'T00:00', zone)[0]?.instant
  const end = timeChoices(nextDate(date) + 'T00:00', zone)[0]?.instant
  if (!start || !end)
    throw Error('The business-local date could not be resolved. Please try again.')
  return { date, start, end }
}
