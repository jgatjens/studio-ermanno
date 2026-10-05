import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { AdminQueryProvider } from './query-provider'
import { FeedbackPage, FeedbackDetailPage } from './feedback-page'
import { apiRequest, ApiError } from '@/lib/api'
const state = vi.hoisted(() => ({
  actor: {
    auth_user_id: 'u',
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
const row = {
  id: 'one',
  name: 'Visitor',
  email: 'private@example.com',
  rating: 5,
  comment: 'Great',
  created_at: '2026-10-04T10:00Z',
  status: 'PENDING',
  is_public: false,
  client_id: 'client',
  appointment_id: 'visit',
}
function mount(path = '/admin/feedback') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminQueryProvider>
        <Routes>
          <Route path="/admin/feedback" element={<FeedbackPage />} />
          <Route path="/admin/feedback/:feedbackId" element={<FeedbackDetailPage />} />
        </Routes>
      </AdminQueryProvider>
    </MemoryRouter>,
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  state.actor.role = 'OWNER'
  vi.mocked(apiRequest).mockImplementation(async (path) =>
    path === '/feedback/one' ? row : { items: [row], total: 1 },
  )
})
test('pending list and status filter', async () => {
  mount()
  await screen.findByText('Visitor')
  expect(apiRequest).toHaveBeenCalledWith(
    '/feedback?limit=25&offset=0&status=PENDING',
    expect.anything(),
  )
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'APPROVED' } })
  await waitFor(() =>
    expect(apiRequest).toHaveBeenCalledWith(
      '/feedback?limit=25&offset=0&status=APPROVED',
      expect.anything(),
    ),
  )
})
test('Owner detail sees email and related permitted records', async () => {
  mount('/admin/feedback/one')
  await screen.findByText('Email: private@example.com')
  expect(screen.getByText('Related client')).toHaveAttribute('href', '/admin/clients/client')
  expect(screen.getByText('Related appointment')).toHaveAttribute(
    'href',
    '/admin/appointments/visit',
  )
  expect(screen.getByLabelText('Public visibility')).toBeDisabled()
})
test('Staff detail hides email and all mutation controls even with permissive fixture', async () => {
  state.actor.role = 'STAFF'
  mount('/admin/feedback/one')
  await screen.findByText('Visitor')
  expect(screen.queryByText(/private@example/)).not.toBeInTheDocument()
  expect(screen.queryByText('Moderate feedback')).not.toBeInTheDocument()
  expect(screen.getByText('Staff access is read only.')).toBeInTheDocument()
})
test('approval does not automatically publish and successful save refreshes detail', async () => {
  vi.mocked(apiRequest).mockImplementation(async (path, options) =>
    options?.method === 'PUT'
      ? { ...row, status: 'APPROVED' }
      : path === '/feedback/one'
        ? row
        : { items: [row], total: 1 },
  )
  mount('/admin/feedback/one')
  await screen.findByText('Moderate feedback')
  fireEvent.change(screen.getByLabelText('Moderation status'), { target: { value: 'APPROVED' } })
  expect(screen.getByLabelText('Public visibility')).not.toBeChecked()
  fireEvent.click(screen.getByText('Review moderation'))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm moderation' }))
  await screen.findByText('Moderation saved.')
  const call = vi.mocked(apiRequest).mock.calls.find(([, o]) => o?.method === 'PUT')
  expect(JSON.parse(String(call?.[1]?.body))).toEqual({ status: 'APPROVED', is_public: false })
  await waitFor(() =>
    expect(
      vi.mocked(apiRequest).mock.calls.filter(([p, o]) => p === '/feedback/one' && !o?.method)
        .length,
    ).toBeGreaterThan(1),
  )
})
test('rejecting a public review clears visibility before confirmation', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ ...row, status: 'APPROVED', is_public: true })
  mount('/admin/feedback/one')
  await screen.findByText('Moderate feedback')
  fireEvent.change(screen.getByLabelText('Moderation status'), { target: { value: 'REJECTED' } })
  expect(screen.getByLabelText('Public visibility')).not.toBeChecked()
  expect(screen.getByLabelText('Public visibility')).toBeDisabled()
  fireEvent.click(screen.getByText('Review moderation'))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm moderation' }))
  await screen.findByText('Moderation saved.')
  const call = vi.mocked(apiRequest).mock.calls.find(([, o]) => o?.method === 'PUT')
  expect(JSON.parse(String(call?.[1]?.body))).toEqual({ status: 'REJECTED', is_public: false })
})
test('publication is deliberate and failed moderation retains exact retry body', async () => {
  vi.mocked(apiRequest).mockImplementation(async (_, o) => {
    if (o?.method === 'PUT') throw new ApiError(403, 'Access denied.')
    return row
  })
  mount('/admin/feedback/one')
  await screen.findByText('Moderate feedback')
  fireEvent.change(screen.getByLabelText('Moderation status'), { target: { value: 'APPROVED' } })
  fireEvent.click(screen.getByLabelText('Public visibility'))
  fireEvent.click(screen.getByText('Review moderation'))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm moderation' }))
  await screen.findByText('Access denied.')
  expect(screen.getByLabelText('Public visibility')).toBeChecked()
  const first = vi.mocked(apiRequest).mock.calls.find(([, o]) => o?.method === 'PUT')?.[1]?.body
  fireEvent.click(screen.getByText('Retry same moderation'))
  await waitFor(() =>
    expect(vi.mocked(apiRequest).mock.calls.filter(([, o]) => o?.method === 'PUT')).toHaveLength(2),
  )
  expect(vi.mocked(apiRequest).mock.calls.filter(([, o]) => o?.method === 'PUT')[1][1]?.body).toBe(
    first,
  )
})
test('feedback list error and empty retry state', async () => {
  vi.mocked(apiRequest).mockRejectedValue(new Error('Unavailable'))
  mount()
  await screen.findByText('Unavailable', {}, { timeout: 3000 })
  vi.mocked(apiRequest).mockResolvedValue({ items: [], total: 0 })
  fireEvent.click(screen.getByText('Retry'))
  await screen.findByText('No matching feedback.')
})
test('detail missing shows error and retry', async () => {
  vi.mocked(apiRequest).mockRejectedValue(new ApiError(404, 'Feedback not found'))
  mount('/admin/feedback/one')
  await screen.findByText('Feedback not found')
  expect(screen.getByText('Retry')).toBeInTheDocument()
})

test('feedback status changes and Show pending reset pagination',async()=>{
  vi.mocked(apiRequest).mockResolvedValue({items:[row],total:50});mount();await screen.findByText('Visitor')
  fireEvent.click(screen.getByRole('button',{name:'Next feedback'}))
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/feedback?limit=25&offset=25&status=PENDING',expect.anything()))
  fireEvent.change(screen.getByLabelText('Status'),{target:{value:'APPROVED'}})
  await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/feedback?limit=25&offset=0&status=APPROVED',expect.anything()))
  fireEvent.click(screen.getByRole('button',{name:'Show pending'}))
  expect(screen.getByLabelText('Status')).toHaveValue('PENDING')
})
test('Staff feedback cards link to reads without private contact or moderation controls',async()=>{
  state.actor.role='STAFF';mount();await screen.findByText('Visitor')
  expect(screen.getByRole('link',{name:'View feedback'})).toHaveAttribute('href','/admin/feedback/one')
  expect(screen.queryByText('private@example.com')).not.toBeInTheDocument()
  expect(screen.queryByRole('link',{name:'Review feedback'})).not.toBeInTheDocument()
})
