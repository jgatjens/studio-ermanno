import { t, useAdminLanguage } from '@/admin/i18n'
import { useState } from 'react'
import { LoaderCircle, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from './auth-provider'
export function LogoutButton() {
  useAdminLanguage()

  const { logout } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function signOut() {
    setBusy(true)
    setError('')
    try {
      await logout()
    } catch {
      setError(t('Unable to sign out. Please try again.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <Button
        className="admin-logout-button h-11 w-11 shrink-0 p-0 [&_svg]:size-5"
        onClick={() => void signOut()}
        disabled={busy}
        aria-label={busy ? t('Signing out…') : t('Logout')}
        title={busy ? t('Signing out…') : t('Logout')}
      >
        {busy ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <LogOut aria-hidden="true" />
        )}
      </Button>
      {error && <p role="alert">{t(error)}</p>}
    </div>
  )
}
