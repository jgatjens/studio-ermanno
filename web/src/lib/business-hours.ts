export type DayHours = { day_of_week: number; opening_time: string | null; closing_time: string | null; is_closed: boolean; break_start?: string | null; break_end?: string | null }

export function formatHours(day: DayHours) {
  if (day.is_closed) return 'Closed'
  const short = (value: string | null | undefined) => value?.slice(0, 5) ?? ''
  return day.break_start && day.break_end
    ? `${short(day.opening_time)}–${short(day.break_start)} · ${short(day.break_end)}–${short(day.closing_time)}`
    : `${short(day.opening_time)}–${short(day.closing_time)}`
}
