import { beforeEach, expect, test, vi } from 'vitest'
import { apiRequest, getHealth, onUnauthorized } from './api'
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { auth: { getSession } } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
  getSession.mockResolvedValue({ data: { session: { access_token: 'latest-token' } }, error: null })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"status":"ok"}', { status: 200 })))
})

test('central API client adds latest bearer token', async () => {
  await apiRequest('/auth/test-read')
  const [url, options] = vi.mocked(fetch).mock.calls[0]
  expect(url).toBe('http://localhost:8000/auth/test-read')
  expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer latest-token')
})

test('public health call does not require or send bearer token', async () => {
  expect(await getHealth()).toEqual({ status: 'ok' })
  expect(getSession).not.toHaveBeenCalled()
  expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).has('Authorization')).toBe(false)
})

test('401 notifies auth invalidation and returns typed error', async () => {
  const callback = vi.fn(); const off = onUnauthorized(callback)
  vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 401 }))
  await expect(apiRequest('/auth/me')).rejects.toMatchObject({ status: 401 })
  expect(callback).toHaveBeenCalledOnce(); off()
})

test('403 returns forbidden without auth invalidation', async () => {
  const callback = vi.fn(); const off = onUnauthorized(callback)
  vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 403 }))
  await expect(apiRequest('/auth/test-owner', { method: 'POST' })).rejects.toMatchObject({ status: 403 })
  expect(callback).not.toHaveBeenCalled(); off()
})

test('missing session rejects protected request without fetching', async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: null })
  await expect(apiRequest('/auth/me')).rejects.toMatchObject({ status: 401 })
  expect(fetch).not.toHaveBeenCalled()
})

test('aborted stale request cannot invalidate a new session', async () => {
  const callback = vi.fn(); const off = onUnauthorized(callback)
  const controller = new AbortController(); controller.abort()
  getSession.mockResolvedValue({ data: { session: null }, error: null })
  await expect(apiRequest('/auth/me', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  expect(callback).not.toHaveBeenCalled(); off()
})

test('409 exposes safe conflict message without invalidating authentication', async () => {
  const callback = vi.fn(); const off = onUnauthorized(callback)
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({detail:{code:'capacity_full',message:'No capacity remains.'}}), { status: 409 }))
  await expect(apiRequest('/appointments', {method:'POST'})).rejects.toMatchObject({status:409,message:'No capacity remains.'})
  expect(callback).not.toHaveBeenCalled(); off()
})

test('anonymous feedback request skips session and bearer token', async () => {
  getSession.mockRejectedValue(new Error('Auth unavailable'))
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: 'received' }), { status: 201 }))
  await expect(apiRequest('/public/feedback', { protected: false, method: 'POST', body: '{}' })).resolves.toEqual({ status: 'received' })
  expect(getSession).not.toHaveBeenCalled()
  const init = vi.mocked(fetch).mock.calls[0][1]
  expect(new Headers(init?.headers).has('Authorization')).toBe(false)
})

test('public 401 never clears an authenticated admin session', async () => {
  const callback = vi.fn(); const off = onUnauthorized(callback)
  vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 401 }))
  await expect(apiRequest('/public/feedback', { protected: false })).rejects.toMatchObject({ status: 401 })
  expect(callback).not.toHaveBeenCalled(); expect(getSession).not.toHaveBeenCalled(); off()
})
