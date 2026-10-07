import { t, useAdminLanguage } from '@/admin/i18n'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './auth-provider'
import { Button } from '@/components/ui/button'
import { LogoutButton } from './logout-button'
import { AuthLoading } from './auth-loading'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  useAdminLanguage()

  const auth = useAuth()
  if (auth.status === 'initializing') return <AuthLoading fullPage />
  if (auth.status === 'unauthenticated') return <Navigate to="/login" replace />
  if (auth.status === 'denied')
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">{t('Access denied')}</h1>
        <p>{t('Your account does not have valid admin access.')}</p>
        <LogoutButton />
      </section>
    )
  if (auth.status === 'error')
    return (
      <section className="space-y-4">
        <p role="alert">{t('Unable to verify admin access. Please try again.')}</p>
        <Button onClick={auth.retry}>{t('Retry ')}</Button>
        <LogoutButton />
      </section>
    )
  return children
}
