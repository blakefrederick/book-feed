'use client'

import { useState, useEffect, useRef } from 'react'
import { Heart, Share, Bookmark } from 'lucide-react'
import Image from 'next/image'
import { Passage } from '@/types'
import { useReadingTime } from '@/hooks/useInfiniteScroll'

interface PassageCardProps {
  passage: Passage
  onLike: (id: string) => void
  onShare: (id: string) => void
  onBookmark: (id: string) => void
  onReadingTimeUpdate: (id: string, duration: number) => void
  isVisible: boolean
}

export function PassageCard({ 
  passage, 
  onLike, 
  onShare, 
  onBookmark, 
  onReadingTimeUpdate,
  isVisible 
}: PassageCardProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const { readTime, startReading, stopReading, resetReading } = useReadingTime()
  
  const cardRef = useRef<HTMLDivElement>(null)

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
  }, [isVisible])

  const handleLike = () => {
    setIsLiked(!isLiked)
    onLike(passage.id)
  }

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked)
    onBookmark(passage.id)
  }

  return (
    <div
      ref={cardRef}
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

      {/* Action Bar */}
      <div className="p-4 bg-amber-50/80 backdrop-blur-sm border-t border-amber-200">
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <button
              onClick={handleLike}
              className={`p-2 rounded-full transition-colors ${
                isLiked 
                  ? 'bg-rose-100 text-rose-600' 
                  : 'text-stone-500 hover:text-rose-600 hover:bg-rose-50'
              }`}
            >
              <Heart
                className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`}
              />
            </button>
            
            <button
              onClick={() => onShare(passage.id)}
              className="p-2 text-stone-500 hover:text-amber-700 hover:bg-amber-100 rounded-full transition-colors"
            >
              <Share className="w-5 h-5" />
            </button>
            
            <button
              onClick={handleBookmark}
              className={`p-2 rounded-full transition-colors ${
                isBookmarked 
                  ? 'bg-amber-100 text-amber-700' 
                  : 'text-stone-500 hover:text-amber-700 hover:bg-amber-100'
              }`}
            >
              <Bookmark
                className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`}
              />
            </button>
          </div>
          
          <div className="text-right">
            <p className="text-stone-500 text-sm">{passage.likes || 0} likes</p>
          </div>
        </div>
      </div>
    </div>
  )
}