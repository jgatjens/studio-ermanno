import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { SchedulePicker } from './schedule-picker'

test('calendar selection preserves the appointment wall-clock time', async () => {
  const change = vi.fn()
  render(
    <SchedulePicker
      hours={Array.from({ length: 7 }, (_, day_of_week) => ({
        day_of_week,
        is_closed: false,
        opening_time: '08:00',
        closing_time: '19:00',
        break_start: '12:00',
        break_end: '14:00',
      }))}
      value="2026-10-05T14:30"
      onChange={change}
      invalid={false}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Open date calendar' }))
  fireEvent.click(await screen.findByRole('button', { name: /October 6th, 2026/ }))
  expect(change).toHaveBeenCalledWith('2026-10-06T14:30')
  expect(screen.queryByRole('button', { name: /October 6th, 2026/ })).not.toBeInTheDocument()
})

test('time selector offers only opening-hour half-hour times and preserves the date', () => {
  const change = vi.fn()
  render(
    <SchedulePicker
      hours={Array.from({ length: 7 }, (_, day_of_week) => ({
        day_of_week,
        is_closed: false,
        opening_time: '08:00',
        closing_time: '19:00',
        break_start: '12:00',
        break_end: '14:00',
      }))}
      value="2026-10-05T14:30"
      onChange={change}
      invalid={false}
    />,
  )
  const time = screen.getByRole('combobox', { name: 'Time' })
  const options = Array.from((time as HTMLSelectElement).options).filter((option) => option.value)
  expect(options).toHaveLength(18)
  expect(options.every((option) => /^(?:[01]\d|2[0-3]):(?:00|30)$/.test(option.value))).toBe(true)
  fireEvent.change(time, { target: { value: '15:00' } })
  expect(change).toHaveBeenCalledWith('2026-10-05T15:00')
})
