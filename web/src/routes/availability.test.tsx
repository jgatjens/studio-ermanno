import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { AvailabilityPage } from './availability'
import { apiRequest } from '@/lib/api'
vi.mock('@/lib/api', () => ({ apiRequest: vi.fn() }))
const business = {
  name: 'Studio',
  timezone: 'Europe/Rome',
  phone: '+39123456789',
  whatsapp: '+39123456789',
  hours: [
    {
      day_of_week: 1,
      is_closed: false,
      opening_time: '08:00',
      closing_time: '19:00',
      break_start: '12:00',
      break_end: '14:00',
    },
  ],
}
const items = [
  {
    date: '2026-10-05',
    state: 'AVAILABLE',
    intervals: [
      { start: '2026-10-05T07:00:00Z', end: '2026-10-05T07:30:00Z', state: 'AVAILABLE' },
      { start: '2026-10-05T07:30:00Z', end: '2026-10-05T08:00:00Z', state: 'LIMITED' },
      { start: '2026-10-05T08:00:00Z', end: '2026-10-05T08:30:00Z', state: 'FULL' },
      { start: '2026-10-05T12:00:00Z', end: '2026-10-05T13:00:00Z', state: 'AVAILABLE' },
    ],
  },
  { date: '2026-10-06', state: 'CLOSED', intervals: [] },
  {
    date: '2026-10-07',
    state: 'FULL',
    intervals: [{ start: '2026-10-07T07:00:00Z', end: '2026-10-07T07:30:00Z', state: 'FULL' }],
  },
]
function response(path: string, dates = items) {
  const query = new URLSearchParams(path.split('?')[1])
  const start = query.get('start') || '2026-10-05'
  const days = Number(query.get('days'))
  const end = new Date(`${start}T12:00:00Z`)
  end.setUTCDate(end.getUTCDate() + days)
  return {
    timezone: 'Europe/Rome',
    interval_minutes: 30,
    start,
    days,
    items: dates.filter((day) => day.date >= start && day.date < end.toISOString().slice(0, 10)),
  }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/public/business' ? business : response(path),
  )
})
async function loaded() {
  await screen.findByText('09:00')
}
test('uses backend-local today and bounded anonymous month requests', async () => {
  render(<AvailabilityPage />)
  expect(screen.getByText('Caricamento disponibilità…')).toBeInTheDocument()
  await loaded()
  for (const [path, options] of vi.mocked(apiRequest).mock.calls) {
    expect(options).toMatchObject({ protected: false, cache: 'no-store' })
    if (path.includes('availability'))
      expect(Number(new URLSearchParams(path.split('?')[1]).get('days'))).toBeLessThanOrEqual(14)
  }
  for (const query of [
    'days=14&start=2026-10-01',
    'days=14&start=2026-10-15',
    'days=3&start=2026-10-29',
  ])
    expect(apiRequest).toHaveBeenCalledWith(`/public/availability?${query}`, expect.anything())
  expect(screen.getByRole('button', { name: 'Mese precedente' })).toBeDisabled()
  expect(screen.getByRole('button', { name: /^domenica 4 ottobre 2026/ })).toBeDisabled()
})
test('only available spots are displayed as read-only times, including split hours', async () => {
  render(<AvailabilityPage />)
  await loaded()
  const times = within(screen.getByRole('region', { name: /lunedì 5 ottobre/ }))
  expect(times.getByText('09:30')).toBeInTheDocument()
  expect(times.getByText('14:00')).toBeInTheDocument()
  expect(times.queryByText('10:00')).not.toBeInTheDocument()
  expect(times.getAllByRole('list')).toHaveLength(2)
  expect(screen.queryByRole('button', { name: /09:00|Continua/ })).not.toBeInTheDocument()
  expect(screen.getByText(/non riservano un appuntamento/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
    'href',
    'https://wa.me/39123456789',
  )
  expect(screen.getByText('08:00 – 12:00')).toBeInTheDocument()
  expect(screen.getByText('14:00 – 19:00')).toBeInTheDocument()
})
test('closed dates are disabled while full dates explain absence of available times', async () => {
  render(<AvailabilityPage />)
  await loaded()
  const closed = screen.getByRole('button', { name: /6 ottobre 2026 · Chiuso/ })
  expect(closed).toBeDisabled()
  fireEvent.click(closed)
  expect(screen.getByText('09:00')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /7 ottobre 2026 · Completo/ }))
  expect(screen.getByText('Non ci sono orari disponibili per questa data.')).toBeInTheDocument()
  expect(screen.queryByText('09:00')).not.toBeInTheDocument()
})
test('failed availability can retry while general contacts remain usable', async () => {
  vi.mocked(apiRequest).mockImplementation(async (path) => {
    if (path === '/public/business') return business
    throw Error('offline')
  })
  render(<AvailabilityPage />)
  await screen.findByRole('alert')
  expect(screen.getByRole('link', { name: 'Chiama' })).toBeInTheDocument()
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/public/business' ? business : response(path),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Riprova' }))
  await loaded()
})
test('refresh clears old times and revalidates the viewed date', async () => {
  render(<AvailabilityPage />)
  await loaded()
  vi.mocked(apiRequest).mockReturnValue(new Promise(() => {}))
  fireEvent.click(screen.getByRole('button', { name: 'Aggiorna disponibilità' }))
  await screen.findByText('Caricamento disponibilità…')
  expect(screen.queryByText('09:00')).not.toBeInTheDocument()
})
test('empty and missing date data are explicit and not treated as full', async () => {
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/public/business' ? business : response(path, []),
  )
  render(<AvailabilityPage />)
  await screen.findByText('Nessuna data disponibile.')
  expect(
    screen.getByRole('button', { name: /^lunedì 5 ottobre 2026 · Dati non disponibili/ }),
  ).toBeDisabled()
})
test('repeated DST times have distinct offsets', async () => {
  const dates = [
    {
      date: '2026-10-25',
      state: 'AVAILABLE',
      intervals: [
        { start: '2026-10-25T00:00:00Z', end: '2026-10-25T01:00:00Z', state: 'AVAILABLE' },
        { start: '2026-10-25T01:00:00Z', end: '2026-10-25T02:00:00Z', state: 'AVAILABLE' },
      ],
    },
  ]
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/public/business' ? business : response(path, dates),
  )
  render(<AvailabilityPage />)
  await screen.findByText(/02:00 GMT\+2/)
  expect(screen.getByText(/02:00 GMT\+1/)).toBeInTheDocument()
})
test('month navigation aborts old chunks and stale results cannot overwrite the new month', async () => {
  render(<AvailabilityPage />)
  await loaded()
  let resolveOld: (value: unknown) => void = () => {}
  vi.mocked(apiRequest).mockImplementation((path) =>
    path.includes('start=2026-11')
      ? new Promise((resolve) => {
          resolveOld = resolve
        })
      : Promise.resolve(response(path)),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Mese successivo' }))
  await waitFor(() =>
    expect(apiRequest).toHaveBeenCalledWith(
      '/public/availability?days=14&start=2026-11-01',
      expect.anything(),
    ),
  )
  const oldSignal = vi
    .mocked(apiRequest)
    .mock.calls.find(([path]) => path.includes('start=2026-11-01'))?.[1]?.signal
  fireEvent.click(screen.getByRole('button', { name: 'Mese precedente' }))
  await loaded()
  expect(oldSignal?.aborted).toBe(true)
  resolveOld(response('/public/availability?days=14&start=2026-11-01'))
  expect(screen.getByRole('heading', { name: 'ottobre 2026' })).toBeInTheDocument()
})

test('configured closed Mondays and Sundays cannot be viewed even if availability is stale', async () => {
  const dates = [...items, { ...items[0], date: '2026-10-11' }]
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/public/business'
      ? {
          ...business,
          hours: [
            ...business.hours,
            { day_of_week: 0, is_closed: true },
            { day_of_week: 6, is_closed: true },
          ],
        }
      : response(path, dates),
  )
  render(<AvailabilityPage />)
  await screen.findByText('Non ci sono orari disponibili per questa data.')
  for (const name of [/^lunedì 5 ottobre 2026 · Chiuso/, /^domenica 11 ottobre 2026 · Chiuso/]) {
    const date = screen.getByRole('button', { name })
    expect(date).toBeDisabled()
    expect(date).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(date)
  }
  expect(screen.queryByText('09:00')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'mercoledì 7 ottobre 2026' })).toBeInTheDocument()
})

test('an entirely closed month has no selected day or time spots', async () => {
  const dates = items.map((day) => ({ ...day, state: 'CLOSED', intervals: [] }))
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/public/business' ? business : response(path, dates),
  )
  render(<AvailabilityPage />)
  await screen.findByText('Nessuna data di apertura disponibile per questo mese.')
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^lunedì 5 ottobre 2026 · Chiuso/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('half-hour spots show available intervals and exclude occupied intervals', async () => {
  const intervals = Array.from({ length: 7 }, (_, index) => ({
    start: new Date(Date.UTC(2026, 9, 5, 7, index * 30)).toISOString(),
    end: new Date(Date.UTC(2026, 9, 5, 7, (index + 1) * 30)).toISOString(),
    state: index === 3 ? 'FULL' : 'AVAILABLE',
  }))
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/public/business' ? business : response(path, [{ ...items[0], intervals }]),
  )
  render(<AvailabilityPage />)
  await loaded()
  expect(screen.getByText('11:00')).toBeInTheDocument()
  expect(screen.getByText('10:00')).toBeInTheDocument()
  expect(screen.queryByText('10:30')).not.toBeInTheDocument()
  expect(screen.getByText('12:00')).toBeInTheDocument()
  expect(screen.getByText('09:30')).toBeInTheDocument()
})

test('contact help groups consecutive days with matching hours and keeps different periods separate', async () => {
  const hours = [0, 6].map((day_of_week) => ({
    day_of_week,
    is_closed: true,
    opening_time: null,
    closing_time: null,
  }))
  const open = [1, 2, 3, 4, 5].map((day_of_week) => ({ ...business.hours[0], day_of_week }))
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/public/business' ? { ...business, hours: [...hours, ...open] } : response(path),
  )
  render(<AvailabilityPage />)
  await screen.findByText('Martedì — Sabato')
  expect(screen.getByText('08:00 – 12:00')).toBeInTheDocument()
  expect(screen.getByText('14:00 – 19:00')).toBeInTheDocument()
})
