import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ApiError, getActor, onUnauthorized, type Actor } from '@/lib/api'
import { supabase } from '@/lib/supabase'

type AuthStatus = 'initializing' | 'unauthenticated' | 'authenticated' | 'denied' | 'error'
type AuthContextValue = {
  status: AuthStatus
  session: Session | null
  actor: Actor | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  retry: () => void
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [actor, setActor] = useState<Actor | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!supabase) { setSession(null); return }
    let active = true
    let eventSeen = false
    // Synchronous callback only: Supabase calls it under its session lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      eventSeen = true
      if (active) { setActor(null); setStatus('initializing'); setSession(next); setAttempt(value => value + 1) }
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (active && !eventSeen) {
        if (error) { setStatus('error'); return }
        setSession(data.session)
      }
    }).catch(() => { if (active && !eventSeen) setStatus('error') })
    const unsubscribe = onUnauthorized(() => {
      if (!active) return
      setActor(null)
      setStatus('unauthenticated')
      setSession(null)
      void supabase?.auth.signOut({ scope: 'local' }).catch(() => {})
    })
    return () => { active = false; subscription.unsubscribe(); unsubscribe() }
  }, [])

  useEffect(() => {
    setActor(null)
    if (session === undefined) return
    if (session === null) { setStatus('unauthenticated'); return }
    setStatus('initializing')
    const controller = new AbortController()
    getActor(controller.signal).then(next => {
      if (!controller.signal.aborted) { setActor(next); setStatus('authenticated') }
    }).catch(error => {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && error.status === 403) setStatus('denied')
      else if (error instanceof ApiError && error.status === 401) { setSession(null); setStatus('unauthenticated') }
      else setStatus('error')
    })
    return () => controller.abort()
  }, [session, attempt])

  async function login(email: string, password: string) {
    if (!supabase) throw new Error('Authentication is not configured.')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session) throw new Error('Unable to sign in. Check your email and password.')
    setActor(null)
    setStatus('initializing')
    setSession(data.session)
  }

  async function logout() {
    const result = await supabase?.auth.signOut({ scope: 'local' })
    if (result?.error) throw new Error('Unable to sign out. Please try again.')
    setActor(null)
    setSession(null)
    setStatus('unauthenticated')
  }

  function retry() {
    if (session === undefined) {
      void supabase?.auth.getSession().then(({ data, error }) => {
        if (error) setStatus('error')
        else setSession(data.session)
      }).catch(() => setStatus('error'))
    } else setAttempt(value => value + 1)
  }

  return <AuthContext.Provider value={{ status, session: session ?? null, actor, login, logout, retry }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth requires AuthProvider')
  return context
}
