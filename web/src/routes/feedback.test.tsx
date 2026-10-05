import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { PublicFeedbackPage } from './feedback'
import { apiRequest, ApiError } from '@/lib/api'
vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  apiRequest: vi.fn(),
}))
const empty = { items: [], total: 0, limit: 25, offset: 0 }
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(apiRequest).mockResolvedValue(empty)
})
function draft() {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Visitor' } })
  fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'Wonderful' } })
}
test('public form loads empty reviews without auth', async () => {
  render(<PublicFeedbackPage />)
  expect(screen.getByText('Loading reviews…')).toBeInTheDocument()
  await screen.findByText('No published reviews yet.')
  expect(screen.getByLabelText('Email (optional)')).toBeInTheDocument()
  expect(apiRequest).toHaveBeenCalledWith(
    '/public/feedback?limit=25&offset=0',
    expect.objectContaining({ protected: false }),
  )
})
test('submission sends visitor fields only and clears after acknowledgement', async () => {
  render(<PublicFeedbackPage />)
  await screen.findByText('No published reviews yet.')
  draft()
  fireEvent.click(screen.getByText('Submit feedback'))
  await screen.findByText(/Thank you. Your feedback was received/)
  expect(screen.getByLabelText('Name')).toHaveValue('')
  const call = vi.mocked(apiRequest).mock.calls.find(([, o]) => o?.method === 'POST')
  expect(call?.[1]).toMatchObject({ protected: false })
  expect(JSON.parse(String(call?.[1]?.body))).toEqual({
    name: 'Visitor',
    email: null,
    rating: 5,
    comment: 'Wonderful',
  })
})
test('validation failure preserves draft without automatic resubmission', async () => {
  vi.mocked(apiRequest).mockImplementation(async (_, options) => {
    if (options?.method === 'POST') throw new ApiError(422, 'Invalid')
    return empty
  })
  render(<PublicFeedbackPage />)
  draft()
  fireEvent.click(screen.getByText('Submit feedback'))
  await screen.findByText('Check your name, email, rating and comment.')
  expect(screen.getByLabelText('Comment')).toHaveValue('Wonderful')
  expect(vi.mocked(apiRequest).mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(1)
})
test('uncertain transport receipt warns about duplicate and retains draft', async () => {
  vi.mocked(apiRequest).mockImplementation(async (_, options) => {
    if (options?.method === 'POST') throw new Error('Offline')
    return empty
  })
  render(<PublicFeedbackPage />)
  draft()
  fireEvent.click(screen.getByText('Submit feedback'))
  await screen.findByText(/Another submission could create a duplicate/)
  expect(screen.getByLabelText('Name')).toHaveValue('Visitor')
})
test('reviews render plain text and pagination never exposes private email', async () => {
  vi.mocked(apiRequest).mockResolvedValue({
    ...empty,
    total: 26,
    items: [
      {
        name: 'Approved visitor',
        rating: 4,
        comment: '<script>alert(1)</script>',
        created_at: '2026-10-04T10:00Z',
        email: 'private@example.com',
      },
    ],
  })
  const { container } = render(<PublicFeedbackPage />)
  await screen.findByText('Approved visitor')
  expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
  expect(container.querySelector('script')).toBeNull()
  expect(screen.queryByText('private@example.com')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Next reviews'))
  await waitFor(() =>
    expect(apiRequest).toHaveBeenCalledWith(
      '/public/feedback?limit=25&offset=25',
      expect.anything(),
    ),
  )
})
test('review load failure offers retry', async () => {
  vi.mocked(apiRequest).mockRejectedValue(new Error('Unavailable'))
  render(<PublicFeedbackPage />)
  await screen.findByText('Unavailable')
  vi.mocked(apiRequest).mockResolvedValue(empty)
  fireEvent.click(screen.getByText('Retry reviews'))
  await screen.findByText('No published reviews yet.')
})
