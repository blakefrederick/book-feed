'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { Passage } from '@/types'
import { useReadingTime } from '@/hooks/useInfiniteScroll'

interface PassageCardProps {
  passage: Passage
  onReadingTimeUpdate: (id: string, duration: number) => void
  isVisible: boolean
}

export function PassageCard({ 
  passage, 
  onReadingTimeUpdate,
  isVisible,
}: PassageCardProps) {
  const { startReading, stopReading } = useReadingTime()

  // Track reading time when card is visible
  useEffect(() => {
    if (isVisible) {
      startReading()
      return () => {
        const duration = stopReading()
        if (duration > 1000) { // Only track if read for more than 1 second
          onReadingTimeUpdate(passage.id, duration)
        }
      }
    } else {
      stopReading()
    }
  }, [isVisible, passage.id, onReadingTimeUpdate, startReading, stopReading])

  return (
    <div
      className="w-full max-w-2xl mx-auto h-screen flex flex-col snap-start snap-always bg-gradient-to-b from-amber-50 to-stone-100 border-l-4 border-amber-600"
    >
      {/* Header */}
      <div className="p-6 pb-4 border-b border-amber-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-amber-900 font-serif text-lg font-semibold mb-1">
              {passage.author}
            </h2>
            <p className="text-amber-700 text-sm font-medium italic">
              {passage.bookTitle}
            </p>
          </div>
          
          {passage.bookCoverUrl && (
            <Image
              src={passage.bookCoverUrl}
              alt={passage.bookTitle}
              width={48}
              height={64}
              className="rounded shadow-sm ml-4 border border-amber-300"
            />
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-none">
          <blockquote className="text-stone-800 text-lg leading-relaxed font-serif tracking-wide">
            "{passage.text}"
          </blockquote>
          
          {/* Tags */}
          {passage.tags && passage.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-amber-200">
              {passage.tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}