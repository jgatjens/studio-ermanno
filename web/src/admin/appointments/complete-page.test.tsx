import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { useQueryClient } from '@tanstack/react-query'
import { AdminQueryProvider } from '../query-provider'
import { AppointmentCompletePage } from './complete-page'
import { AppointmentDetailPage } from './pages'
import { apiRequest, ApiError } from '@/lib/api'
const state = vi.hoisted(() => ({
  actor: {
    auth_user_id: 'user',
    membership_id: 'm',
    business_id: 'b',
    role: 'OWNER' as 'OWNER' | 'STAFF',
  },
}))
vi.mock('@/auth/auth-provider', () => ({ useAuth: () => state }))
vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  apiRequest: vi.fn(),
}))
const item = {
  id: 'one',
  client: { id: 'client', first_name: 'Alice', last_name: 'Test' },
  barber: null,
  scheduled_start: '2026-10-05T08:00:00Z',
  scheduled_end: '2026-10-05T08:30:00Z',
  status: 'SCHEDULED',
  services: [{ service_id: 'service', name: 'Stored cut', price: '20', duration_minutes: 30 }],
  products: [],
  calculated_duration_minutes: 30,
  final_duration_minutes: 30,
  calculated_price: '20',
  final_price: '20',
  appointment_notes: null,
  visit_notes: null,
}
const product = { id: 'product', name: 'Pomade', brand: null, category: 'Styling' }
function mockApi() {
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    if (path === '/appointments/context') return { timezone: 'Europe/Rome', currency: 'EUR' }
    if (path.includes('completion-products'))
      return { items: [product], total: 1, limit: 25, offset: 0 }
    if (path.endsWith('/complete') && options?.method === 'POST') {
      item.status = 'COMPLETED'
      return { ...item }
    }
    return { ...item }
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  state.actor.role = 'OWNER'
  item.status = 'SCHEDULED'
  mockApi()
})
function Refresh() {
  const cache = useQueryClient()
  return <button onClick={() => void cache.invalidateQueries()}>Refresh data</button>
}
function mount() {
  return render(
    <MemoryRouter initialEntries={['/admin/appointments/one/complete']}>
      <AdminQueryProvider>
        <Refresh />
        <Routes>
          <Route
            path="/admin/appointments/:appointmentId/complete"
            element={<AppointmentCompletePage />}
          />
          <Route path="/admin/appointments/:appointmentId" element={<AppointmentDetailPage />} />
        </Routes>
      </AdminQueryProvider>
    </MemoryRouter>,
  )
}
test('Owner reviews snapshots/totals and stock boundary', async () => {
  mount()
  await screen.findByText('Stored cut · 30 minutes · 20')
  expect(screen.getByText('Final: 30 minutes · 20 EUR')).toBeInTheDocument()
  expect(screen.getByText(/deducts all USED and SOLD/)).toBeInTheDocument()
  expect(screen.getByText('No products recorded.')).toBeInTheDocument()
  expect(screen.getByText('Edit services or totals first')).toBeInTheDocument()
})
test('Staff direct route denied without private fetch', () => {
  state.actor.role = 'STAFF'
  mount()
  expect(screen.getByText('Access denied.')).toBeInTheDocument()
  expect(apiRequest).not.toHaveBeenCalled()
})
test('terminal appointment is read only', async () => {
  item.status = 'COMPLETED'
  mount()
  await screen.findByText(/COMPLETED and is read only/)
  expect(screen.queryByText('Review completion')).not.toBeInTheDocument()
  expect(apiRequest).not.toHaveBeenCalledWith(
    expect.stringContaining('completion-products'),
    expect.anything(),
  )
})
test('empty-product completion needs deliberate confirmation', async () => {
  mount()
  await screen.findByText('Review completion')
  fireEvent.click(screen.getByText('Review completion'))
  expect(apiRequest).not.toHaveBeenCalledWith('/appointments/one/complete', expect.anything())
  fireEvent.click(screen.getByText('Confirm completion'))
  await screen.findByText('Appointment completed.')
  expect(apiRequest).toHaveBeenCalledWith(
    '/appointments/one/complete',
    expect.objectContaining({
      body: '{"service_ids":["service"],"products":[],"visit_notes":null}',
    }),
  )
})
test('USED and SOLD selections and visit notes are submitted', async () => {
  mount()
  fireEvent.click(await screen.findByText('Add Pomade'))
  fireEvent.change(screen.getByLabelText('Usage for Pomade 1'), { target: { value: 'SOLD' } })
  fireEvent.click(screen.getByText('Add Pomade'))
  fireEvent.change(screen.getByLabelText('Quantity for Pomade 2'), { target: { value: '0.125' } })
  fireEvent.change(screen.getByLabelText('Visit notes'), { target: { value: ' Private visit ' } })
  fireEvent.click(screen.getByText('Review completion'))
  fireEvent.click(screen.getByText('Confirm completion'))
  await screen.findByText('Appointment completed.')
  const call = vi
    .mocked(apiRequest)
    .mock.calls.find((call) => call[0] === '/appointments/one/complete')!
  const body = JSON.parse(call[1]?.body as string)
  expect(body.products).toEqual([
    { product_id: 'product', usage_type: 'SOLD', quantity: '1' },
    { product_id: 'product', usage_type: 'USED', quantity: '0.125' },
  ])
  expect(body.visit_notes).toBe('Private visit')
})
test('invalid quantity and duplicate usage blocked', async () => {
  mount()
  fireEvent.click(await screen.findByText('Add Pomade'))
  fireEvent.change(screen.getByLabelText('Quantity for Pomade 1'), { target: { value: '0' } })
  fireEvent.click(screen.getByText('Review completion'))
  await screen.findByText(/Quantities must be positive/)
  expect(screen.queryByText('Confirm completion')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Usage for Pomade 1'), { target: { value: 'SOLD' } })
  fireEvent.click(screen.getByText('Add Pomade'))
  fireEvent.change(screen.getByLabelText('Usage for Pomade 2'), { target: { value: 'SOLD' } })
  fireEvent.click(screen.getByText('Review completion'))
  await screen.findByText(/Combine duplicate/)
  expect(apiRequest).not.toHaveBeenCalledWith('/appointments/one/complete', expect.anything())
})
test('transport failure retains draft and retries identical body', async () => {
  const normal = vi.mocked(apiRequest).getMockImplementation()!
  let attempts = 0
  vi.mocked(apiRequest).mockImplementation((path, options) =>
    path.endsWith('/complete') && attempts++ === 0
      ? ((item.status = 'COMPLETED'), Promise.reject(new Error('Network unavailable')))
      : normal(path, options),
  )
  mount()
  await screen.findByText('Review completion')
  fireEvent.change(screen.getByLabelText('Visit notes'), { target: { value: 'Remember this' } })
  fireEvent.click(screen.getByText('Review completion'))
  fireEvent.click(screen.getByText('Confirm completion'))
  await screen.findByText('Network unavailable')
  fireEvent.click(screen.getByText('Refresh data'))
  await waitFor(() =>
    expect(
      vi.mocked(apiRequest).mock.calls.filter((call) => call[0] === '/appointments/one').length,
    ).toBeGreaterThan(1),
  )
  expect(screen.getByLabelText('Visit notes')).toHaveValue('Remember this')
  fireEvent.click(screen.getByText('Retry same completion'))
  await screen.findByText('Appointment completed.')
  const calls = vi.mocked(apiRequest).mock.calls.filter((call) => call[0].endsWith('/complete'))
  expect(calls[0][1]?.body).toBe(calls[1][1]?.body)
})
test('409 preserves draft and explains stale review', async () => {
  const normal = vi.mocked(apiRequest).getMockImplementation()!
  vi.mocked(apiRequest).mockImplementation((path, options) =>
    path.endsWith('/complete')
      ? Promise.reject(new ApiError(409, 'Appointment details changed. Reload and review.'))
      : normal(path, options),
  )
  mount()
  await screen.findByText('Review completion')
  fireEvent.change(screen.getByLabelText('Visit notes'), { target: { value: 'Draft' } })
  fireEvent.click(screen.getByText('Review completion'))
  fireEvent.click(screen.getByText('Confirm completion'))
  await screen.findByText('Appointment details changed. Reload and review.')
  expect(screen.getByLabelText('Visit notes')).toHaveValue('Draft')
})
test('product selector empty state and search', async () => {
  const normal = vi.mocked(apiRequest).getMockImplementation()!
  vi.mocked(apiRequest).mockImplementation((path, options) =>
    path.includes('completion-products')
      ? Promise.resolve({ items: [], total: 0, limit: 25, offset: 0 })
      : normal(path, options),
  )
  mount()
  await screen.findByText('No matching active products.')
  fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'shampoo' } })
  await waitFor(() =>
    expect(apiRequest).toHaveBeenCalledWith(
      '/appointments/completion-products?q=shampoo&limit=25&offset=0',
      expect.anything(),
    ),
  )
})
