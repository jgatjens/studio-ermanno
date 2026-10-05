import { HealthStatus } from '@/components/health-status'
import { useState } from 'react'
import { useAuth } from '@/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api'

export function AdminPage() {
  const { actor } = useAuth()
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  async function probe(path: string, method = 'GET') {
    setBusy(true)
    setResult('')
    try {
      const data = await apiRequest<unknown>(path, { method })
      setResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setResult(error instanceof Error ? error.message : 'Request failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">Admin access</h1>
      <p>Role: {actor?.role === 'OWNER' ? 'Owner' : 'Staff'}</p>
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => void probe('/auth/test-read')}>
          Test protected read
        </Button>
        <Button disabled={busy} onClick={() => void probe('/auth/test-client-visibility')}>
          Test client visibility
        </Button>
        {actor?.role === 'OWNER' && (
          <Button disabled={busy} onClick={() => void probe('/auth/test-owner', 'POST')}>
            Test Owner action
          </Button>
        )}
      </div>
      {busy && <p role="status">Loading test response…</p>}
      {result && (
        <pre role="status" className="overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4">
          {result}
        </pre>
      )}
      <HealthStatus />
    </section>
  )
}
