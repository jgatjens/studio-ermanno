import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type LoginFormProps = ComponentProps<'form'> & {
  email: string
  password: string
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  busy: boolean
  error: string
}

export function LoginForm({ className, email, password, onEmailChange, onPasswordChange, busy, error, ...props }: LoginFormProps) {
  return <form className={cn('flex flex-col gap-6', className)} aria-busy={busy} {...props}>
    <FieldGroup>
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Admin login</h1>
        <p className="text-sm text-muted-foreground">Sign in to manage your studio.</p>
      </div>
      <Field>
        <FieldLabel htmlFor="login-email">Email</FieldLabel>
        <Input id="login-email" name="email" type="email" autoComplete="username" placeholder="you@example.com" required disabled={busy} value={email} onChange={event => onEmailChange(event.target.value)} className="h-11" aria-describedby={error ? 'login-error' : undefined} />
      </Field>
      <Field>
        <FieldLabel htmlFor="login-password">Password</FieldLabel>
        <Input id="login-password" name="password" type="password" autoComplete="current-password" required disabled={busy} value={password} onChange={event => onPasswordChange(event.target.value)} className="h-11" aria-describedby={error ? 'login-error' : undefined} />
      </Field>
      {error && <p id="login-error" role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <Field>
        <Button type="submit" disabled={busy} className="h-11 w-full">{busy ? 'Signing in…' : 'Login'}</Button>
        {busy && <span role="status" className="sr-only">Signing in…</span>}
        <FieldDescription className="text-center">Need access? Contact the business Owner.</FieldDescription>
      </Field>
    </FieldGroup>
  </form>
}
