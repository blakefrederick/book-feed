'use client'

import { collection, query, orderBy, limit, startAfter, getDocs, DocumentSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Passage } from '@/types'

const mockPassages: Passage[] = [
]

class PassageService {
  private lastVisible: DocumentSnapshot | null = null
  private readonly BATCH_SIZE = 10
  private hasReachedEnd = false
  private useFallback = false
  private mockCurrentIndex = 0
  private currentBookId: string | null = null

  async getPassages(fresh = false, bookId?: string): Promise<Passage[]> {
    console.log('[PassageService] getPassages called with fresh:', fresh, 'bookId:', bookId);
    
    // Set current book ID if provided, otherwise use default
    if (bookId) {
      this.currentBookId = bookId
    } 

    // Try Firebase first
    if (!this.useFallback) {
      try {
        const firebaseResults = await this.getPassagesFromFirebase(fresh)
        // If Firebase returns empty results, fall back to mock data
        if (firebaseResults.length === 0 && fresh) {
          console.log('Firebase returned no results, falling back to mock data');
          this.useFallback = true
          return this.getPassagesFromMock(fresh)
        }
        return firebaseResults
      } catch (error) {
        console.warn('Firebase failed, falling back to mock data:', error);
        this.useFallback = true
        return this.getPassagesFromMock(fresh)
      }
    } else {
      return this.getPassagesFromMock(fresh)
    }
  }

  private async getPassagesFromFirebase(fresh: boolean): Promise<Passage[]> {
    if (fresh) {
      this.lastVisible = null
      this.hasReachedEnd = false
    }

    let q = query(
      collection(db, 'books', this.currentBookId!, 'passages'),
      orderBy('createdAt', 'desc'),
      limit(this.BATCH_SIZE)
    )

    if (this.lastVisible && !fresh) {
      q = query(
        collection(db, 'books', this.currentBookId!, 'passages'),
        orderBy('createdAt', 'desc'),
        startAfter(this.lastVisible),
        limit(this.BATCH_SIZE)
      )
    }

    console.log('Executing Firestore query...');
    const snapshot = await getDocs(q)
    console.log('Query result - empty:', snapshot.empty, 'size:', snapshot.size);
    
    if (!snapshot.empty) {
      this.lastVisible = snapshot.docs[snapshot.docs.length - 1]
      // Check if we got fewer docs than requested - means we've reached the end
      if (snapshot.docs.length < this.BATCH_SIZE) {
        this.hasReachedEnd = true
      }
    } else {
      // No docs returned means we've reached the end
      this.hasReachedEnd = true
    }

    const passages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    } as Passage))
    
    console.log('Mapped passages:', passages);
    return passages;
  }

  private getPassagesFromMock(fresh: boolean): Promise<Passage[]> {
    console.log('Using mock data fallback');
    
    if (fresh) {
      this.mockCurrentIndex = 0
      this.hasReachedEnd = false
    }

    const endIndex = Math.min(this.mockCurrentIndex + this.BATCH_SIZE, mockPassages.length)
    const passages = mockPassages.slice(this.mockCurrentIndex, endIndex)
    
    this.mockCurrentIndex = endIndex
    
    // Check if we've reached the end of mock data
    if (endIndex >= mockPassages.length) {
      this.hasReachedEnd = true
    }
        
    return Promise.resolve(passages)
  }

  async likePassage(passageId: string): Promise<void> {
    // @TODO
    console.log('Liking passage:', passageId)
  }

  async trackEngagement(passageId: string, readTime: number): Promise<void> {
    // @TODO
    console.log('Tracking engagement:', { passageId, readTime })
  }

  async sharePassage(passageId: string): Promise<void> {
    // @TODO
    console.log('Sharing passage:', passageId)
  }

  async bookmarkPassage(passageId: string): Promise<void> {
    // @TODO
    console.log('Bookmarking passage:', passageId)
  }

  hasMore(): boolean {
    return !this.hasReachedEnd
  }

  isUsingFallback(): boolean {
    return this.useFallback
  }

  async retryFirebase(): Promise<void> {
    this.useFallback = false
    this.hasReachedEnd = false
    this.lastVisible = null
    this.mockCurrentIndex = 0
  }

  setBookId(bookId: string): void {
    if (this.currentBookId !== bookId) {
      this.currentBookId = bookId
      // Reset pagination when switching books
      this.lastVisible = null
      this.hasReachedEnd = false
      this.mockCurrentIndex = 0
    }
  }

  getCurrentBookId(): string | null {
    return this.currentBookId
  }
}

export const passageService = new PassageService()