import { useEffect, useState } from 'react'
import { getHealth } from '@/lib/api'
export function HealthStatus() {
  const [status, setStatus] = useState<'Loading' | 'Connected' | 'Error'>('Loading')
  useEffect(() => {
    const controller = new AbortController()
    getHealth(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setStatus('Connected')
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('Error')
      })
    return () => controller.abort()
  }, [])
  return (
    <p role="status" aria-live="polite">
      API Status: {status}
    </p>
  )
}
