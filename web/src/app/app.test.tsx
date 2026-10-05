import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, test, expect } from 'vitest'
import { App } from './app'
import { HealthStatus } from '@/components/health-status'
import { getHealth } from '@/lib/api'
vi.mock('@/lib/api', () => ({
  getHealth: vi.fn(),
  apiRequest: vi.fn().mockReturnValue(new Promise(() => {})),
}))
vi.mock('@/auth/auth-provider', () => ({
  useAuth: () => ({
    status: 'unauthenticated',
    session: null,
    actor: null,
    login: vi.fn(),
    logout: vi.fn(),
    retry: vi.fn(),
  }),
}))
test('application and public route render with loading status', () => {
  vi.mocked(getHealth).mockReturnValue(new Promise(() => {}))
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: 'Capelli. Cura. Identità.' })).toBeInTheDocument()
  expect(screen.getAllByRole('status')[0]).toHaveTextContent('Caricamento dei servizi')
})
test('admin route redirects to login', () => {
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <App />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: 'Admin login' })).toBeInTheDocument()
})
test('health success', async () => {
  vi.mocked(getHealth).mockResolvedValue({ status: 'ok' })
  render(<HealthStatus />)
  expect(await screen.findByText('API Status: Connected')).toBeInTheDocument()
})
test('health failure', async () => {
  vi.mocked(getHealth).mockRejectedValue(new Error('Offline'))
  render(<HealthStatus />)
  expect(await screen.findByText('API Status: Error')).toBeInTheDocument()
})
test('unknown admin paths retain authentication protection', () => {
  render(
    <MemoryRouter initialEntries={['/admin/missing']}>
      <App />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: 'Admin login' })).toBeInTheDocument()
})
