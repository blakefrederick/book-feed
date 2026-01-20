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
        if (duration > 300) {
          onReadingTimeUpdate(passage.id, duration)
        }
      }
    } else {
      stopReading()
    }
  }, [isVisible, passage.id, onReadingTimeUpdate, startReading, stopReading])

  return (
    <div className="w-full max-w-2xl mx-auto h-screen flex flex-col snap-start snap-always bg-gradient-to-br from-stone-100 via-neutral-50 to-stone-100 rounded-3xl mx-4 my-2 shadow-2xl">
      {/* Header with book cover and title */}
      <div className="p-8 pb-6">
        <div className="flex items-start gap-4">
          {/* Book cover placeholder */}
          <div className="w-16 h-20 bg-slate-300 rounded-lg shadow-md flex items-center justify-center">
            {passage.bookCoverUrl ? (
              <Image
                src={passage.bookCoverUrl}
                alt={passage.bookTitle}
                width={64}
                height={80}
                className="rounded-lg shadow-md"
              />
            ) : (
              <span className="text-slate-500 text-xs text-center px-1">Book Cover</span>
            )}
          </div>
          
          <div className="flex-1">
            <h2 className="text-slate-800 font-serif text-2xl font-bold mb-2">
              {passage.author}
            </h2>
            <p className="text-slate-600 text-lg font-serif italic">
              {passage.bookTitle}
            </p>
          </div>
        </div>
      </div>

      {/* Passage */}
      <div className="flex-1 px-8 py-4 flex items-center justify-center">
        <blockquote className="text-slate-800 text-xl leading-relaxed font-serif text-center max-w-lg">
          {passage.text}
        </blockquote>
      </div>

      {/* Bottom section with author image and interactions */}
      <div className="p-8 pt-6">
        <div className="w-full h-px bg-slate-300 mb-6"></div>
        
        <div className="flex items-center justify-between">
          {/* Author image placeholder and interactions */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-300 rounded-full flex items-center justify-center">
              {passage.authorPhotoUrl ? (
                <Image
                  src={passage.authorPhotoUrl}
                  alt={passage.author}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
              ) : (
                <span className="text-slate-500 text-xs">Author</span>
              )}
            </div>
            
            {/* Like and bookmark - placeholders right now */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 bg-red-400 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">♥</span>
                </div>
                <span className="text-slate-600 text-sm font-medium">{passage.likes || 0}</span>
              </div>
            
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}