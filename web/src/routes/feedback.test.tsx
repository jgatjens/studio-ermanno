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
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Visitor' } })
  fireEvent.change(screen.getByLabelText('La tua esperienza'), { target: { value: 'Wonderful' } })
}
test('public form loads empty reviews without auth', async () => {
  render(<PublicFeedbackPage />)
  expect(screen.getByText('Caricamento recensioni…')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByText('Caricamento recensioni…')).not.toBeInTheDocument())
  expect(screen.queryByRole('region', { name: 'Recensioni dei clienti' })).not.toBeInTheDocument()
  expect(screen.queryByText('Le vostre parole')).not.toBeInTheDocument()
  expect(screen.queryByText('Esperienze in salone.')).not.toBeInTheDocument()
  expect(screen.queryByText('La prima parola è tua.')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Email (facoltativa)')).toBeInTheDocument()
  expect(apiRequest).toHaveBeenCalledWith(
    '/public/feedback?limit=25&offset=0',
    expect.objectContaining({ protected: false }),
  )
})
test('submission sends visitor fields only and clears after acknowledgement', async () => {
  render(<PublicFeedbackPage />)
  await waitFor(() => expect(screen.queryByText('Caricamento recensioni…')).not.toBeInTheDocument())
  draft()
  fireEvent.click(screen.getByText('Invia recensione'))
  await screen.findByText(/Grazie! Abbiamo ricevuto/)
  expect(screen.getByLabelText('Nome')).toHaveValue('')
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
  fireEvent.click(screen.getByText('Invia recensione'))
  await screen.findByText('Controlla nome, email, valutazione e commento.')
  expect(screen.getByLabelText('La tua esperienza')).toHaveValue('Wonderful')
  expect(vi.mocked(apiRequest).mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(1)
})
test('uncertain transport receipt warns about duplicate and retains draft', async () => {
  vi.mocked(apiRequest).mockImplementation(async (_, options) => {
    if (options?.method === 'POST') throw new Error('Offline')
    return empty
  })
  render(<PublicFeedbackPage />)
  draft()
  fireEvent.click(screen.getByText('Invia recensione'))
  await screen.findByText(/Un nuovo invio potrebbe creare un duplicato/)
  expect(screen.getByLabelText('Nome')).toHaveValue('Visitor')
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
  fireEvent.click(screen.getByText('Successive'))
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
  await screen.findByText('Le recensioni non sono disponibili al momento.')
  vi.mocked(apiRequest).mockResolvedValue(empty)
  fireEvent.click(screen.getByText('Riprova'))
  await waitFor(() =>
    expect(
      screen.queryByText('Le recensioni non sono disponibili al momento.'),
    ).not.toBeInTheDocument(),
  )
})
