import { t, useAdminLanguage } from '@/admin/i18n'
import type { DayHours } from '@/lib/business-hours'
import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { it, enUS } from 'react-day-picker/locale'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Input } from '@/components/ui/input'

// Keep wall-clock strings: UTC conversion belongs to the salon timezone logic.
export function SchedulePicker({
  value,
  hours,
  loading = false,
  onChange,
  invalid,
  errorId,
}: {
  value: string
  hours: DayHours[]
  loading?: boolean
  onChange: (value: string) => void
  invalid: boolean
  errorId?: string
}) {
  const language = useAdminLanguage()

  const [open, setOpen] = useState(false)
  const [date = '', time = ''] = value.split('T')
  const selected = date ? new Date(`${date}T12:00:00`) : undefined
  const periodsFor = (stamp: string) => {
    const days = stamp
      ? hours.filter((day) => day.day_of_week === (new Date(`${stamp}T12:00:00`).getDay() + 6) % 7)
      : hours
    const unique = new Map<string, { start: string; end: string }>()
    for (const day of days) {
      if (day.is_closed || !day.opening_time || !day.closing_time) continue
      const ranges =
        day.break_start && day.break_end
          ? [
              [day.opening_time, day.break_start],
              [day.break_end, day.closing_time],
            ]
          : [[day.opening_time, day.closing_time]]
      for (const [start, end] of ranges)
        unique.set(`${start}-${end}`, { start: start.slice(0, 5), end: end.slice(0, 5) })
    }
    return Array.from(unique.values()).sort((a, b) => a.start.localeCompare(b.start))
  }
  const periods = periodsFor(date)
  const slotsFor = (stamp: string) =>
    Array.from(
      { length: 48 },
      (_, index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
    ).filter((slot) =>
      periodsFor(stamp).some((period) => slot >= period.start && slot < period.end),
    )
  const slots = slotsFor(date)
  const changeDate = (stamp: string) =>
    onChange(`${stamp}T${slotsFor(stamp).includes(time) ? time : ''}`)
  return (
    <div className="schedule-picker">
      <div>
        <label htmlFor="appointment-time">{t('Time')}</label>
        <NativeSelect
          id="appointment-time"
          className="w-full"
          required
          disabled={loading || !slots.length}
          value={time}
          aria-invalid={invalid}
          aria-describedby={errorId}
          onChange={(event) => onChange(`${date}T${event.target.value}`)}
        >
          <option value="">{t('Choose time')}</option>
          {time && !slots.includes(time) && (
            <option value={time} disabled>
              {time} {t(" (outside current opening hours; choose another time)")}
            </option>
          )}
          {periods.map((period) => (
            <optgroup
              key={`${period.start}-${period.end}`}
              label={`${period.start} - ${period.end}`}
            >
              {slots
                .filter((slot) => slot >= period.start && slot < period.end)
                .map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
            </optgroup>
          ))}
        </NativeSelect>
        <p className="schedule-hours-hint">
          {loading
            ? t('Loading business hours…')
            : periods.length
              ? periods.map((period) => `${period.start} - ${period.end}`).join(t(' and '))
              : date
                ? t('Closed on this date.')
                : t('No opening hours configured.')}
        </p>
      </div>{' '}
      <div>
        <label htmlFor="appointment-date">{t('Date')}</label>
        <div className="schedule-date-control">
          <Input
            id="appointment-date"
            type="date"
            required
            value={date}
            aria-invalid={invalid}
            aria-describedby={errorId}
            onChange={(event) => changeDate(event.target.value)}
          />
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" aria-label={t('Open date calendar')}>
                <CalendarDays size={18} aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="schedule-calendar-popover"
              aria-label={t('Choose appointment date')}
            >
              <Calendar
                locale={language === 'it' ? it : enUS}
                labels={
                  language === 'it'
                    ? {
                        labelNext: () => 'Mese successivo',
                        labelPrevious: () => 'Mese precedente',
                        labelNav: () => 'Navigazione calendario',
                        labelDayButton: (date, modifiers) =>
                          `${new Intl.DateTimeFormat('it-IT', { dateStyle: 'full' }).format(date)}${modifiers.today ? ', oggi' : ''}${modifiers.selected ? ', selezionato' : ''}`,
                      }
                    : undefined
                }
                mode="single"
                selected={selected}
                defaultMonth={selected}
                disabled={(day) =>
                  !periodsFor(
                    `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`,
                  ).length
                }
                autoFocus
                onSelect={(day) => {
                  if (!day) return
                  const stamp = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
                  changeDate(stamp)
                  setOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}
