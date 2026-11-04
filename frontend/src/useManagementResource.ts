import { useCallback, useEffect, useState } from 'react'
import { managementRequest } from './managementApi'

export function useManagementResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt(value => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError(''); setLoading(true)
    managementRequest<T>(path, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setData(value) })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load information. Please refresh.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [path, attempt])
  return { data, error, loading, reload }
}
