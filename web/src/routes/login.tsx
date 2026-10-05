import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/auth-provider'
import { LoginForm } from '@/components/login-form'
import { hero } from '@/public/content'
import { ProtectedRoute } from '@/auth/protected-route'

export function LoginPage() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  if (auth.status === 'authenticated') return <Navigate to="/admin" replace />
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      await auth.login(email, password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-8 p-6 md:p-10">
        <Link to="/" className="flex min-h-11 w-fit items-center gap-3 text-sm font-semibold">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-lg bg-primary text-lg text-primary-foreground"
          >
            M
          </span>
          <span>Minati Parrucchieri</span>
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-xs">
            {auth.status === 'initializing' ? (
              <p role="status">Loading authentication…</p>
            ) : auth.status === 'denied' || auth.status === 'error' ? (
              <ProtectedRoute>
                <Navigate to="/admin" replace />
              </ProtectedRoute>
            ) : (
              <LoginForm
                email={email}
                password={password}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                busy={busy}
                error={error}
                onSubmit={(event) => void submit(event)}
              />
            )}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true">←</span> Back to website
          </Link>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Reserved for authorized Owners and Staff.
          </p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-muted lg:block">
        <img
          src={hero.src}
          srcSet={hero.srcSet}
          sizes="50vw"
          alt=""
          width={hero.width}
          height={hero.height}
          className="absolute inset-0 h-full w-full object-cover object-[50%_70%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <p className="text-xs font-medium uppercase tracking-[0.2em]">Grigno · Trentino</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">Minati Parrucchieri</p>
        </div>
      </div>
    </div>
  )
}
