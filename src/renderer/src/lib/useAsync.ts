import { useCallback, useEffect, useState } from 'react'
import { errMessage, useStore } from '@/lib/store'

/**
 * Runs an async loader on mount and whenever `deps` change, reporting failures through the global error toast.
 *
 * @param load - Loader; must be stable across renders for the given `deps`.
 * @param deps - Values that trigger a reload when they change.
 * @returns The latest data (`null` until loaded), a loading flag and a manual `reload`.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; isLoading: boolean; reload(): void } {
  const setError = useStore((s) => s.setError)
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let isCurrent = true
    setLoading(true)
    load()
      .then((value) => { if (isCurrent) setData(value) })
      .catch((e) => { if (isCurrent) setError(errMessage(e)) })
      .finally(() => { if (isCurrent) setLoading(false) })
    return () => { isCurrent = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version, setError])

  return { data, isLoading, reload: useCallback(() => setVersion((v) => v + 1), []) }
}
