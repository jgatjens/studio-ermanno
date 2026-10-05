import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from './auth-provider'
export function LogoutButton() {
  const { logout } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function signOut() {
    setBusy(true); setError('')
    try { await logout() } catch { setError('Unable to sign out. Please try again.') } finally { setBusy(false) }
  }
  return <div><Button onClick={() => void signOut()} disabled={busy}>{busy ? 'Signing out…' : 'Logout'}</Button>{error && <p role="alert">{error}</p>}</div>
}
