export function localStamp(instant: string | Date, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant))
  const part = (name: string) => parts.find(p => p.type === name)!.value
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}
export function timeChoices(local: string, zone: string): { instant: string; offset: string }[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return []
  const wall = Date.parse(local + 'Z')
  if (!Number.isFinite(wall)) return []
  const choices: { instant: string; offset: string }[] = []
  // Current IANA offsets use 15-minute increments. Match by roundtrip so gaps
  // produce no choices and repeated wall times produce two explicit choices.
  for (let minutes = -840; minutes <= 840; minutes += 15) {
    const instant = new Date(wall - minutes * 60_000).toISOString()
    if (localStamp(instant, zone) === local) choices.push({ instant, offset: `${minutes < 0 ? '-' : '+'}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}` })
  }
  return choices.sort((a, b) => a.instant.localeCompare(b.instant))
}
export function toInstant(local: string, zone: string, offset = ''): string {
  const choices = timeChoices(local, zone)
  if (!choices.length) throw new Error('This local time does not exist. Choose another time.')
  if (choices.length > 1 && !offset) throw new Error('This time occurs twice. Choose an explicit UTC offset.')
  const chosen = offset ? choices.find(choice => choice.offset === offset) : choices[0]
  if (!chosen) throw new Error('Choose a valid UTC offset for this local time.')
  return chosen.instant
}
export function nextDate(date: string): string { const value = new Date(date + 'T12:00:00Z'); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10) }
export function displayTime(instant: string, zone: string) { return new Intl.DateTimeFormat(undefined, { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant)) }
