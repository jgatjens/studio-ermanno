import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { ProtectedRoute } from '@/auth/protected-route'

export function LoginPage() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (auth.status === 'initializing') return <p role="status">Loading authentication…</p>
  if (auth.status === 'authenticated') return <Navigate to="/admin" replace />
  if (auth.status === 'denied' || auth.status === 'error') return <ProtectedRoute><Navigate to="/admin" replace /></ProtectedRoute>
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await auth.login(email, password) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in.') } finally { setBusy(false) }
  }
  return <section className="max-w-sm space-y-4"><h1 className="text-3xl font-semibold">Admin login</h1><form onSubmit={event => void submit(event)} className="space-y-4"><label className="block">Email<input className="mt-1 block w-full rounded-md border border-input p-2" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label><label className="block">Password<input className="mt-1 block w-full rounded-md border border-input p-2" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label><Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Login'}</Button>{error && <p role="alert">{error}</p>}</form></section>
}
