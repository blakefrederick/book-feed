export interface Passage {
  id: string
  text: string
  bookTitle: string
  author: string
  bookCoverUrl?: string
  authorPhotoUrl?: string
  tags: string[]
  category: ''
  length: 'short' | 'medium' | 'long'
  density: 'dense' | 'airy' | 'whatever'
  createdAt: Date
  likes: number
  engagement: {
    views: number
    averageReadTime: number
    totalReadTime: number
  }
}

export interface UserInteraction {
  userId: string
  passageId: string
  liked: boolean
  readTime: number // in milliseconds
  timestamp: Date
}

export interface User {
  id: string
  email: string
  preferences: {
    categories: string[]
    authors: string[]
    readingSpeed: number
  }
  engagementHistory: UserInteraction[]
}