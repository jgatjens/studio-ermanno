import { t, useAdminLanguage } from '@/admin/i18n'
import { Spinner } from '@/components/ui/spinner'

export function AuthLoading({ fullPage = false }: { fullPage?: boolean }) {
  useAdminLanguage()
  return (
    <div
      className={fullPage ? 'auth-loading auth-loading-page' : 'auth-loading'}
      role="status"
      aria-live="polite"
    >
      <span className="auth-loading-icon">
        <Spinner />
      </span>
      <span>{t('Loading authentication…')}</span>
    </div>
  )
}
