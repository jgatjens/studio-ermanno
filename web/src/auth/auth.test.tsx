import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Session, AuthChangeEvent } from '@supabase/supabase-js'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from './auth-provider'
import { App } from '@/app/app'
import { ApiError, apiRequest, getActor, getHealth } from '@/lib/api'

const { auth } = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
}))
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getActor: vi.fn(),
  getHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
}))
const session = { access_token: 'access-token', user: { id: 'user-id' } } as Session
const owner = {
  auth_user_id: 'user-id',
  membership_id: 'member-id',
  business_id: 'business-id',
  role: 'OWNER' as const,
}
let authEvent: (event: AuthChangeEvent, next: Session | null) => void
const unsubscribe = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getHealth).mockResolvedValue({ status: 'ok' })
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  auth.onAuthStateChange.mockImplementation((callback) => {
    authEvent = callback
    return { data: { subscription: { unsubscribe } } }
  })
  auth.signOut.mockResolvedValue({ error: null })
  vi.mocked(getActor).mockResolvedValue(owner)
})

function mount(path = '/admin/access') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

function restored() {
  auth.getSession.mockResolvedValue({ data: { session }, error: null })
}

test('initial auth loading prevents admin rendering', () => {
  auth.getSession.mockReturnValue(new Promise(() => {}))
  mount()
  expect(screen.getByRole('status')).toHaveTextContent('Loading authentication')
  expect(screen.queryByText('Admin access')).not.toBeInTheDocument()
})

test('login page renders and unauthenticated admin redirects', async () => {
  mount()
  expect(await screen.findByRole('heading', { name: 'Admin login' })).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
})

test('restored Owner session loads backend actor and Owner UI', async () => {
  restored()
  mount()
  expect(await screen.findByText('Owner access')).toBeInTheDocument()
  expect(getActor).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Test Owner action' })).toBeInTheDocument()
})

test('Staff can access admin reads but Owner UI is absent', async () => {
  restored()
  vi.mocked(getActor).mockResolvedValue({ ...owner, role: 'STAFF' })
  mount()
  expect(await screen.findByText('Role: Staff')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Test protected read' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Test Owner action' })).not.toBeInTheDocument()
})

test('authenticated user without membership sees access denied without logout', async () => {
  restored()
  vi.mocked(getActor).mockRejectedValue(new ApiError(403, 'Access denied'))
  mount()
  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument()
  expect(auth.signOut).not.toHaveBeenCalled()
})

test('login submits email/password to Supabase and loads backend actor', async () => {
  auth.signInWithPassword.mockImplementation(async () => {
    restored()
    return { data: { session }, error: null }
  })
  mount('/login')
  await screen.findByRole('heading', { name: 'Admin login' })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.test' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Login' }))
  expect(await screen.findByText('Owner access')).toBeInTheDocument()
  expect(auth.signInWithPassword).toHaveBeenCalledWith({
    email: 'owner@example.test',
    password: 'test-password',
  })
})

test('login failure displays a safe error', async () => {
  auth.signInWithPassword.mockResolvedValue({
    data: { session: null },
    error: new Error('details'),
  })
  mount('/login')
  await screen.findByRole('heading', { name: 'Admin login' })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.test' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'incorrect' } })
  fireEvent.click(screen.getByRole('button', { name: 'Login' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Check your email and password')
})

test('logout clears session and actor and returns to login', async () => {
  restored()
  mount()
  await screen.findByText('Role: Owner')
  fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
  expect(await screen.findByRole('heading', { name: 'Admin login' })).toBeInTheDocument()
  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  expect(screen.queryByText('Role: Owner')).not.toBeInTheDocument()
})

test('auth changes replace the backend actor and subscription is cleaned up', async () => {
  restored()
  const view = mount()
  await screen.findByText('Role: Owner')
  vi.mocked(getActor).mockResolvedValue({ ...owner, role: 'STAFF' })
  act(() => authEvent('TOKEN_REFRESHED', { ...session, access_token: 'fresh' }))
  expect(await screen.findByText('Role: Staff')).toBeInTheDocument()
  view.unmount()
  expect(unsubscribe).toHaveBeenCalled()
})

test('late actor response cannot restore access after logout', async () => {
  restored()
  let resolve!: (value: typeof owner) => void
  vi.mocked(getActor).mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  mount()
  await waitFor(() => expect(getActor).toHaveBeenCalled())
  act(() => authEvent('SIGNED_OUT', null))
  await screen.findByRole('heading', { name: 'Admin login' })
  await act(async () => resolve(owner))
  expect(screen.queryByText('Role: Owner')).not.toBeInTheDocument()
})

test('protected request 401 clears frontend session', async () => {
  restored()
  mount()
  await screen.findByText('Role: Owner')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  await act(async () => {
    await expect(apiRequest('/auth/test-read')).rejects.toMatchObject({ status: 401 })
  })
  expect(await screen.findByRole('heading', { name: 'Admin login' })).toBeInTheDocument()
  expect(auth.signOut).toHaveBeenCalled()
})

test('protected request 403 retains authenticated actor', async () => {
  restored()
  mount()
  await screen.findByText('Role: Owner')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })))
  fireEvent.click(screen.getByRole('button', { name: 'Test Owner action' }))
  expect(await screen.findByText('Access denied.')).toBeInTheDocument()
  expect(screen.getByText('Role: Owner')).toBeInTheDocument()
  expect(auth.signOut).not.toHaveBeenCalled()
})

test('backend outage does not grant access and can be retried', async () => {
  restored()
  vi.mocked(getActor).mockRejectedValueOnce(new ApiError(503, 'unavailable'))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to verify admin access')
  expect(screen.queryByText('Admin access')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('Owner access')).toBeInTheDocument()
})

test('login fields support password managers and required validation', async () => {
  mount('/login')
  await screen.findByRole('heading', { name: 'Admin login' })
  expect(screen.getByLabelText('Email')).toBeRequired()
  expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username')
  expect(screen.getByLabelText('Password')).toBeRequired()
  expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
  expect(screen.queryByText('Sign up')).not.toBeInTheDocument()
  expect(screen.queryByText('Forgot your password?')).not.toBeInTheDocument()
})

test('pending login disables controls and prevents duplicate form submission', async () => {
  let finish!: (value: unknown) => void
  auth.signInWithPassword.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  mount('/login')
  await screen.findByRole('heading', { name: 'Admin login' })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.test' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } })
  const form = screen.getByRole('button', { name: 'Login' }).closest('form')!
  fireEvent.submit(form)
  expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
  expect(screen.getByLabelText('Email')).toBeDisabled()
  expect(screen.getByLabelText('Password')).toBeDisabled()
  fireEvent.submit(form)
  expect(auth.signInWithPassword).toHaveBeenCalledTimes(1)
  await act(async () => finish({ data: { session: null }, error: new Error('invalid') }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Check your email and password')
  expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled()
})
