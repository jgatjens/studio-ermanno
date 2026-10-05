import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider'
import { ApiError } from '@/lib/api'

function ScopedCache({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (count, error) =>
              !(error instanceof ApiError && [401, 403, 404, 409, 422].includes(error.status)) &&
              count < 1,
          },
          mutations: { retry: false },
        },
      }),
  )
  useEffect(
    () => () => {
      client.clear()
    },
    [client],
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
export function AdminQueryProvider({ children }: { children: ReactNode }) {
  const { actor } = useAuth()
  if (!actor) return null
  return (
    <ScopedCache
      key={`${actor.auth_user_id}:${actor.membership_id}:${actor.business_id}:${actor.role}`}
    >
      {children}
    </ScopedCache>
  )
}
export function useAdminKey(resource: string) {
  const { actor } = useAuth()
  return [
    'admin',
    actor?.auth_user_id,
    actor?.membership_id,
    actor?.business_id,
    actor?.role,
    resource,
  ]
}
