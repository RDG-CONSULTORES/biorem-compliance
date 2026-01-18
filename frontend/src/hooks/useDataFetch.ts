import { useState, useEffect, useRef, useCallback } from "react"

interface UseDataFetchOptions<T> {
  /**
   * Fetch function that returns the data
   */
  fetchFn: () => Promise<T>
  /**
   * Dependencies that trigger a refetch (like search query)
   * First fetch is immediate, subsequent fetches are debounced
   */
  deps?: unknown[]
  /**
   * Debounce delay in ms for subsequent fetches (default: 300)
   */
  debounceMs?: number
  /**
   * Initial data value
   */
  initialData: T
  /**
   * Error handler callback
   */
  onError?: (error: Error) => void
}

interface UseDataFetchReturn<T> {
  data: T
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  setData: React.Dispatch<React.SetStateAction<T>>
}

/**
 * Reusable hook for data fetching with proper loading states.
 *
 * Fixes the double-flicker issue by:
 * 1. Running immediate fetch on mount
 * 2. Debouncing subsequent fetches triggered by dependency changes
 * 3. Using a single unified loading state
 *
 * Usage:
 * ```tsx
 * const { data: clients, loading, refetch } = useDataFetch({
 *   fetchFn: () => clientsService.list({ search: searchQuery }),
 *   deps: [searchQuery],
 *   initialData: [],
 * });
 * ```
 */
export function useDataFetch<T>({
  fetchFn,
  deps = [],
  debounceMs = 300,
  initialData,
  onError,
}: UseDataFetchOptions<T>): UseDataFetchReturn<T> {
  const [data, setData] = useState<T>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Track if this is the initial mount
  const isInitialMount = useRef(true)
  // Track if a fetch is in progress to prevent race conditions
  const fetchInProgress = useRef(false)
  // Store the latest fetchFn to avoid stale closures
  const fetchFnRef = useRef(fetchFn)
  fetchFnRef.current = fetchFn

  const executeFetch = useCallback(async () => {
    // Prevent concurrent fetches
    if (fetchInProgress.current) return

    fetchInProgress.current = true
    setLoading(true)
    setError(null)

    try {
      const result = await fetchFnRef.current()
      setData(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onError?.(error)
    } finally {
      setLoading(false)
      fetchInProgress.current = false
    }
  }, [onError])

  useEffect(() => {
    // On initial mount, fetch immediately without debounce
    if (isInitialMount.current) {
      isInitialMount.current = false
      executeFetch()
      return
    }

    // For subsequent dependency changes, debounce the fetch
    const timer = setTimeout(() => {
      executeFetch()
    }, debounceMs)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, debounceMs, executeFetch])

  // Manual refetch (bypasses debounce)
  const refetch = useCallback(async () => {
    await executeFetch()
  }, [executeFetch])

  return { data, loading, error, refetch, setData }
}

/**
 * Hook for fetching paginated list data with search support.
 * Specialized version of useDataFetch for common CRUD list pages.
 */
interface UseListFetchOptions<T> {
  fetchFn: (params: { search?: string; page_size?: number }) => Promise<{ items: T[]; total: number }>
  searchQuery?: string
  pageSize?: number
  onError?: (error: Error) => void
}

interface UseListFetchReturn<T> {
  items: T[]
  total: number
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  setItems: React.Dispatch<React.SetStateAction<T[]>>
}

export function useListFetch<T>({
  fetchFn,
  searchQuery = "",
  pageSize = 100,
  onError,
}: UseListFetchOptions<T>): UseListFetchReturn<T> {
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)

  const { data, loading, error, refetch, setData } = useDataFetch({
    fetchFn: async () => {
      const response = await fetchFn({
        search: searchQuery || undefined,
        page_size: pageSize,
      })
      return response
    },
    deps: [searchQuery, pageSize],
    initialData: { items: [] as T[], total: 0 },
    onError,
  })

  // Sync items and total from data
  useEffect(() => {
    setItems(data.items)
    setTotal(data.total)
  }, [data])

  return {
    items,
    total,
    loading,
    error,
    refetch,
    setItems,
  }
}

export default useDataFetch
