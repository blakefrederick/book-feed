'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PassageCard } from '@/components/PassageCard'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { passageService } from '@/services/passageService'
import { Passage } from '@/types'

export function InfiniteFeed() {
  const [visibleIndex, setVisibleIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const {
    items: passages,
    loading,
    error,
    loadMoreRef
  } = useInfiniteScroll<Passage>({
    fetchMore: () => passageService.getPassages(),
    hasMore: () => passageService.hasMore()
  })

  // Debug: Log passages and loading state
  useEffect(() => {
    console.log('Passages:', passages)
    console.log('Loading:', loading)
    console.log('Error:', error)
  }, [passages, loading, error])

  // Track which card is currently visible
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0')
            setVisibleIndex(index)
          }
        })
      },
      {
        root: container,
        threshold: 0.8,
        rootMargin: '-10% 0px'
      }
    )

    const cards = container.querySelectorAll('[data-index]')
    cards.forEach(card => observer.observe(card))

    return () => observer.disconnect()
  }, [passages])

  const handleLike = (passageId: string) => {
    passageService.likePassage(passageId)
  }

  const handleShare = (passageId: string) => {
    passageService.sharePassage(passageId)
  }

  const handleBookmark = (passageId: string) => {
    passageService.bookmarkPassage(passageId)
  }

  const handleReadingTimeUpdate = (passageId: string, duration: number) => {
    passageService.trackEngagement(passageId, duration)
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Oops! Something went wrong</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <AnimatePresence mode="popLayout">
          {passages.map((passage, index) => (
            <div
              key={passage.id}
              data-index={index}
              className="relative"
            >
              <PassageCard
                passage={passage}
                onLike={handleLike}
                onShare={handleShare}
                onBookmark={handleBookmark}
                onReadingTimeUpdate={handleReadingTimeUpdate}
                isVisible={visibleIndex === index}
              />
            </div>
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        {loading && (
          <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-700">
            <motion.div
              className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        )}

        {/* Load more trigger */}
        <div ref={loadMoreRef} className="h-10" />
      </div>

      {/* UI overlay indicators */}
      <div className="fixed top-4 left-4 z-50">
        <div className="bg-black/20 backdrop-blur-md rounded-full px-3 py-1 text-white text-sm">
          {passages.length > 0 ? `${visibleIndex + 1} / ${passages.length}` : '0 / 0'}
        </div>
      </div>

      {/* Fallback notification banner */}
      {passageService.isUsingFallback() && (
        <div className="fixed top-4 right-4 z-50 bg-yellow-500/90 backdrop-blur-sm text-yellow-900 px-3 py-2 rounded-lg shadow-lg">
          <p className="text-sm font-medium">Demo Mode</p>
        </div>
      )}
    </div>
  )
}