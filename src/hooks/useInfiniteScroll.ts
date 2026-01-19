'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView } from 'react-intersection-observer'

interface UseInfiniteScrollProps<T> {
  fetchMore: () => Promise<T[]>
  hasMore: () => boolean
}

export function useInfiniteScroll<T>({ fetchMore, hasMore }: UseInfiniteScrollProps<T>) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    rootMargin: '100px'
  })

  // Initial fetch on mount
  useEffect(() => {
    if (!initialized) {
      console.log('[useInfiniteScroll] Component mounted, performing initial fetch');
      loadMore()
      setInitialized(true)
    }
  }, [initialized])

  useEffect(() => {
    console.log('[useInfiniteScroll] Effect triggered - inView:', inView, 'hasMore:', hasMore(), 'loading:', loading, 'initialized:', initialized)
    if (inView && hasMore() && !loading && initialized) {
      console.log('[useInfiniteScroll] Loading more due to inView');
      loadMore()
    }
  }, [inView, loading, initialized])

  const loadMore = async () => {
    if (loading) {
      console.log('[useInfiniteScroll] loadMore called but already loading, skipping')
      return
    }
    
    console.log('[useInfiniteScroll] Starting loadMore - current items count:', items.length);
    setLoading(true)
    setError(null)
    
    try {
      console.log('[useInfiniteScroll] Calling fetchMore...')
      const newItems = await fetchMore()
      console.log('[useInfiniteScroll] Fetched', newItems.length, 'new items')
      console.log('[useInfiniteScroll] Sample new item:', newItems[0] ? {
        id: newItems[0].id || 'no-id',
        hasText: !!newItems[0].text
      } : 'none')
      
      setItems(prev => {
        const combined = [...prev, ...newItems]
        console.log('[useInfiniteScroll] Updated items array length:', prev.length, '->', combined.length)
        return combined
      })
    } catch (err) {
      console.error('[useInfiniteScroll] Error in loadMore:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more items')
    } finally {
      setLoading(false)
      console.log('[useInfiniteScroll] loadMore completed')
    }
  }

  return {
    items,
    loading,
    error,
    loadMoreRef,
    setItems
  }
}

export function useReadingTime() {
  const startTime = useRef<number | null>(null)
  const [readTime, setReadTime] = useState(0)

  const startReading = () => {
    startTime.current = Date.now()
  }

  const stopReading = () => {
    if (startTime.current) {
      const duration = Date.now() - startTime.current
      setReadTime(prev => prev + duration)
      startTime.current = null
      return duration
    }
    return 0
  }

  const resetReading = () => {
    setReadTime(0)
    startTime.current = null
  }

  return {
    readTime,
    startReading,
    stopReading,
    resetReading
  }
}