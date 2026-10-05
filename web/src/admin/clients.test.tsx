import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { AdminQueryProvider } from './query-provider'
import { ClientsPage, ClientFormPage, ClientProfilePage } from './clients-page'
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
const client = {
  id: 'one',
  first_name: 'Alice',
  last_name: 'Test',
  email: 'secret@example.com',
  phone: '123',
  private_notes: 'private',
  last_completed_visit: null,
}
const page = { items: [client], total: 1, limit: 25, offset: 0 }
function mount(path = '/admin/clients') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminQueryProvider>
        <Routes>
          <Route path="/admin/clients" element={<ClientsPage />} />
          <Route path="/admin/clients/new" element={<ClientFormPage />} />
          <Route path="/admin/clients/:clientId" element={<ClientProfilePage />} />
          <Route path="/admin/clients/:clientId/edit" element={<ClientFormPage />} />
        </Routes>
      </AdminQueryProvider>
    </MemoryRouter>,
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  state.actor.role = 'OWNER'
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path.includes('/history')
      ? { ...page, items: [], total: 0 }
      : path === '/clients/one'
        ? client
        : page,
  )
})
test('Owner client list and debounced search', async () => {
  mount()
  await screen.findByText('Alice Test')
  expect(screen.getByText('Add client')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Search name, email or phone'), {
    target: { value: 'Alice' },
  })
  await waitFor(() =>
    expect(apiRequest).toHaveBeenCalledWith(
      '/clients?q=Alice&limit=25&offset=0',
      expect.anything(),
    ),
  )
})
test('Staff names only and no create controls', async () => {
  state.actor.role = 'STAFF'
  mount()
  await screen.findByText('Alice Test')
  expect(screen.getByLabelText('Search client name')).toBeInTheDocument()
  expect(screen.queryByText('Add client')).not.toBeInTheDocument()
  expect(screen.queryByText(/secret@example/)).not.toBeInTheDocument()
})
test('empty and no-match lists', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ ...page, items: [], total: 0 })
  mount()
  await screen.findByText('No clients yet.')
  fireEvent.change(screen.getByLabelText('Search name, email or phone'), {
    target: { value: 'Nobody' },
  })
  await screen.findByText('No matching clients.')
})
test('list failure and retry', async () => {
  vi.mocked(apiRequest).mockRejectedValue(new ApiError(403, 'Access denied.'))
  mount()
  await screen.findByText('Access denied.')
  vi.mocked(apiRequest).mockResolvedValue(page)
  fireEvent.click(screen.getByText('Retry'))
  await screen.findByText('Alice Test')
})
test('Owner profile contact and empty history', async () => {
  mount('/admin/clients/one')
  await screen.findByText('Alice Test')
  expect(screen.getByText(/secret@example/)).toBeInTheDocument()
  await screen.findByText('No visit history.')
  expect(screen.getByText('No completed visits yet.')).toBeInTheDocument()
})
test('Staff profile hides private fields even if API fixture contains them', async () => {
  state.actor.role = 'STAFF'
  mount('/admin/clients/one')
  await screen.findByText('Alice Test')
  expect(screen.queryByText(/secret@example/)).not.toBeInTheDocument()
  expect(screen.queryByText('private')).not.toBeInTheDocument()
  expect(screen.queryByText('Edit client')).not.toBeInTheDocument()
})
test('Staff direct edit denied without fetching record', async () => {
  state.actor.role = 'STAFF'
  mount('/admin/clients/one/edit')
  expect(screen.getByText('Access denied.')).toBeInTheDocument()
  expect(apiRequest).not.toHaveBeenCalled()
})
test('save failure retains draft', async () => {
  vi.mocked(apiRequest).mockRejectedValue(new ApiError(422, 'invalid'))
  mount('/admin/clients/new')
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Alice' } })
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Test' } })
  fireEvent.click(screen.getByText('Save client'))
  await screen.findByText('Check the field formats and lengths.')
  expect(screen.getByLabelText('First name')).toHaveValue('Alice')
})
test('create posts full record and navigates to profile', async () => {
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path.includes('/history') ? { ...page, items: [], total: 0 } : client,
  )
  mount('/admin/clients/new')
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Alice' } })
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Test' } })
  fireEvent.click(screen.getByText('Save client'))
  await screen.findByText('Alice Test')
  expect(apiRequest).toHaveBeenCalledWith(
    '/clients',
    expect.objectContaining({ method: 'POST', body: expect.stringContaining('"email":null') }),
  )
})
test('Owner edit loads fields and sends PUT', async () => {
  mount('/admin/clients/one/edit')
  expect(await screen.findByLabelText('First name')).toHaveValue('Alice')
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Changed' } })
  fireEvent.click(screen.getByText('Save client'))
  await screen.findByText('Client saved.')
  expect(apiRequest).toHaveBeenCalledWith(
    '/clients/one',
    expect.objectContaining({ method: 'PUT', body: expect.stringContaining('Changed') }),
  )
})
test('profile 404 displays scoped absence', async () => {
  vi.mocked(apiRequest).mockRejectedValue(new ApiError(404, 'failed'))
  mount('/admin/clients/one')
  await screen.findByText('Client not found.')
})
test('Staff history shows snapshots and excludes visit notes', async () => {
  state.actor.role = 'STAFF'
  const visit = {
    id: 'visit',
    scheduled_start: '2026-01-01T10:00:00Z',
    final_duration_minutes: 60,
    final_price: '20.00',
    appointment_notes: 'Allowed appointment note',
    visit_notes: 'Hidden visit note',
    services: [{ name: 'Snapshot service', price: '20.00', duration_minutes: 60 }],
    products: [{ name: 'Used shampoo', quantity: '1', usage_type: 'USED' }],
  }
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path.includes('/history')
      ? { ...page, items: [visit] }
      : { ...client, last_completed_visit: visit },
  )
  mount('/admin/clients/one')
  await screen.findAllByText(/Snapshot service/)
  expect(screen.queryByText(/Hidden visit note/)).not.toBeInTheDocument()
  expect(screen.getAllByText(/Allowed appointment note/)).toHaveLength(2)
})
test('client search and page survive opening a profile then Back', async () => {
  mount('/admin/clients?q=Alice&offset=25')
  await screen.findByText('Alice Test')
  expect(screen.getByLabelText('Search name, email or phone')).toHaveValue('Alice')
  expect(apiRequest).toHaveBeenCalledWith('/clients?q=Alice&limit=25&offset=25', expect.anything())
  fireEvent.click(screen.getByRole('link', { name: 'Alice Test' }))
  await screen.findByText('Last completed visit')
  fireEvent.click(screen.getByRole('link', { name: 'Back to clients' }))
  await screen.findByLabelText('Search name, email or phone')
  expect(screen.getByLabelText('Search name, email or phone')).toHaveValue('Alice')
  expect(screen.getByRole('button', { name: 'Previous' })).not.toBeDisabled()
})

test('clear search restores the full list query', async () => {
  mount('/admin/clients?q=Alice')
  await screen.findByText('Alice Test')
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
  expect(screen.getByLabelText('Search name, email or phone')).toHaveValue('')
  await waitFor(() =>
    expect(apiRequest).toHaveBeenCalledWith('/clients?q=&limit=25&offset=0', expect.anything()),
  )
})
test('add client keeps only names required and Cancel performs no mutation', async () => {
  mount('/admin/clients/new')
  expect(screen.getByLabelText('First name')).toBeRequired()
  expect(screen.getByLabelText('Last name')).toBeRequired()
  expect(screen.getByLabelText('Email')).not.toBeRequired()
  expect(screen.getByLabelText('Phone')).not.toBeRequired()
  expect(screen.getByLabelText('First name')).toHaveAttribute('autocomplete', 'given-name')
  fireEvent.click(screen.getByRole('link', { name: 'Cancel' }))
  await screen.findByText('Alice Test')
  expect(vi.mocked(apiRequest).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
    false,
  )
})
test('pending client save disables fields and prevents duplicate submissions', async () => {
  vi.mocked(apiRequest).mockReturnValue(new Promise(() => {}))
  mount('/admin/clients/new')
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Alice' } })
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Test' } })
  const form = screen.getByRole('button', { name: 'Save client' }).closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled())
  expect(screen.getByLabelText('First name')).toBeDisabled()
  expect(screen.getByLabelText('General notes/preferences')).toBeDisabled()
  expect(apiRequest).toHaveBeenCalledTimes(1)
})

test('Owner deletion requires confirmation and cancel sends no DELETE', async () => {
  mount('/admin/clients/one')
  await screen.findByText('Alice Test')
  fireEvent.click(screen.getByRole('button', { name: 'Archive client' }))
  expect(screen.getByRole('alertdialog', { name: 'Archive Alice Test?' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(vi.mocked(apiRequest).mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(
    false,
  )
})
test('confirmed deletion sends DELETE and returns to refreshed list', async () => {
  vi.mocked(apiRequest).mockImplementation(async (path, options) =>
    options?.method === 'DELETE'
      ? undefined
      : path.includes('/history')
        ? { ...page, items: [], total: 0 }
        : path === '/clients/one'
          ? client
          : { ...page, items: [], total: 0 },
  )
  mount('/admin/clients/one')
  await screen.findByText('Alice Test')
  fireEvent.click(screen.getByRole('button', { name: 'Archive client' }))
  fireEvent.click(screen.getByRole('button', { name: 'Archive client' }))
  await screen.findByText('Client archived.')
  expect(await screen.findByText('No clients yet.')).toBeInTheDocument()
  expect(apiRequest).toHaveBeenCalledWith('/clients/one', { method: 'DELETE' })
})
test('delete conflict keeps profile and presents history-preservation reason', async () => {
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    if (options?.method === 'DELETE') throw new ApiError(409, 'conflict')
    return path.includes('/history') ? { ...page, items: [], total: 0 } : client
  })
  mount('/admin/clients/one')
  await screen.findByText('Alice Test')
  fireEvent.click(screen.getByRole('button', { name: 'Archive client' }))
  fireEvent.click(screen.getByRole('button', { name: 'Archive client' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('linked appointments or feedback')
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('heading', { name: 'Alice Test' })).toBeInTheDocument()
})
test('Staff profile offers neither edit nor delete actions', async () => {
  state.actor.role = 'STAFF'
  mount('/admin/clients/one')
  await screen.findByText('Alice Test')
  expect(screen.queryByRole('button', { name: 'Archive client' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Edit client' })).not.toBeInTheDocument()
})

test('pending delete disables confirmation and cancel, and prevents double submission', async () => {
  vi.mocked(apiRequest).mockImplementation((path, options) =>
    options?.method === 'DELETE'
      ? new Promise(() => {})
      : Promise.resolve(path.includes('/history') ? { ...page, items: [], total: 0 } : client),
  )
  mount('/admin/clients/one')
  await screen.findByText('Alice Test')
  fireEvent.click(screen.getByRole('button', { name: 'Archive client' }))
  const confirm = screen.getByRole('button', { name: 'Archive client' })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Archiving…' })).toBeDisabled())
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(
    vi.mocked(apiRequest).mock.calls.filter(([, options]) => options?.method === 'DELETE'),
  ).toHaveLength(1)
})
