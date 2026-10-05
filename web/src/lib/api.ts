import { supabase } from './supabase'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const unauthorizedListeners = new Set<() => void>()
export function onUnauthorized(listener: () => void) {
  unauthorizedListeners.add(listener)
  return () => {
    unauthorizedListeners.delete(listener)
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { protected?: boolean } = {},
): Promise<T> {
  const { protected: needsAuth = true, ...init } = options
  const baseUrl = import.meta.env.VITE_API_BASE_URL
  if (!baseUrl) throw new Error('API URL is not configured')
  const headers = new Headers(init.headers)
  if (needsAuth) {
    const result = await supabase?.auth.getSession()
    if (init.signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
    const token = result?.data.session?.access_token
    if (result?.error || !token) {
      unauthorizedListeners.forEach((listener) => listener())
      throw new ApiError(401, 'Please sign in again.')
    }
    headers.set('Authorization', `Bearer ${token}`)
  }
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, { ...init, headers })
  if (!response.ok) {
    if (needsAuth && response.status === 401 && !init.signal?.aborted)
      unauthorizedListeners.forEach((listener) => listener())
    if (response.status === 409) {
      const data = await response.json().catch(() => null)
      throw new ApiError(
        409,
        typeof data?.detail?.message === 'string'
          ? data.detail.message
          : 'Appointment conflict. Review the details and try again.',
      )
    }
    if (response.status === 422) {
      const data = await response.json().catch(() => null)
      const details = Array.isArray(data?.detail) ? data.detail : []
      const messages = details
        .filter((item: { msg?: unknown }) => typeof item.msg === 'string')
        .map(
          (item: { loc?: unknown[]; msg: string }) =>
            `${Array.isArray(item.loc) ? item.loc.filter((part) => part !== 'body').join('.') : 'Form'}: ${item.msg}`,
        )
      throw new ApiError(
        422,
        messages.length ? messages.join('; ') : 'Please check the form values and try again.',
      )
    }
    throw new ApiError(
      response.status,
      response.status === 401
        ? 'Please sign in again.'
        : response.status === 403
          ? 'Access denied.'
          : 'API request failed. Please try again.',
    )
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function getHealth(signal?: AbortSignal): Promise<{ status: 'ok' }> {
  const data = await apiRequest<{ status: string }>('/health', { protected: false, signal })
  if (data?.status !== 'ok') throw new Error('Unexpected health response')
  return { status: 'ok' }
}

export type Actor = {
  auth_user_id: string
  membership_id: string
  business_id: string
  role: 'OWNER' | 'STAFF'
}
export async function getActor(signal?: AbortSignal): Promise<Actor> {
  const actor = await apiRequest<Actor>('/auth/me', { signal })
  if (
    !actor ||
    !actor.auth_user_id ||
    !actor.membership_id ||
    !actor.business_id ||
    !['OWNER', 'STAFF'].includes(actor.role)
  )
    throw new Error('Invalid actor response')
  return actor
}
