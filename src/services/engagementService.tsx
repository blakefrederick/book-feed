'use client'

import React, { createContext, useContext, useRef, useCallback, useEffect, useState } from 'react'
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  writeBatch,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { 
  UserEngagementEvent, 
  UserSession, 
  UserBehaviorProfile, 
  EngagementAggregates,
  EngagementEvent,
  EngagementConfig
} from '@/types/engagement'

interface EngagementContextType {
  currentSession: UserSession | null
  trackPassageView: (
    passageId: string, 
    bookId: string, 
    position: number, 
    passageData: any,
    previousPassageId?: string
  ) => Promise<void>
  trackPassageViewEnd: (passageId: string, visibilityPercentage?: number) => Promise<void>
  trackPause: (passageId: string) => void
  trackResume: (passageId: string) => void
  trackScroll: (passageId: string, scrollY: number) => void
  trackAction: (
    passageId: string,
    bookId: string,
    eventType: 'like' | 'share' | 'bookmark' | 'skip',
    position: number,
    additionalData?: any
  ) => Promise<void>
  startSession: (userId: string) => Promise<void>
  endSession: () => Promise<void>
  getUserBehaviorProfile: (userId: string) => Promise<UserBehaviorProfile | null>
  getPassageEngagementAggregates: (passageId: string) => Promise<EngagementAggregates | null>
}

const EngagementContext = createContext<EngagementContextType | null>(null)

const defaultConfig: EngagementConfig = {
  minViewDurationToTrack: 1000, // 1 second
  batchSize: 1, // Process events immediately
  flushInterval: 3000, // 3 seconds
  enableDetailedTracking: true,
  enableOfflineQueue: true,
  maxQueueSize: 100
}

export function EngagementProvider({ children }: { children: React.ReactNode }) {
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const sessionInitializedRef = useRef<boolean>(false)
  const trackedPassagesRef = useRef<Set<string>>(new Set())
  const lastSessionSaveRef = useRef<number>(0)
  const sessionStartTimeRef = useRef<Date>(new Date())
  const viewStartTimesRef = useRef<Map<string, Date>>(new Map())
  const pauseStartTimesRef = useRef<Map<string, Date>>(new Map())
  const pauseDurationsRef = useRef<Map<string, number[]>>(new Map())
  const interactionCountsRef = useRef<Map<string, number>>(new Map())
  const eventQueueRef = useRef<EngagementEvent[]>([])
  const scrollPositionsRef = useRef<Map<string, number[]>>(new Map())
  const configRef = useRef<EngagementConfig>(defaultConfig)

  // Helper functions
  const getDeviceType = useCallback((): 'mobile' | 'tablet' | 'desktop' => {
    if (typeof window === 'undefined') return 'desktop'
    const width = window.screen.width
    if (width < 768) return 'mobile'
    if (width < 1024) return 'tablet'
    return 'desktop'
  }, [])

  const getConnectionType = useCallback((): string => {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      return (navigator as any).connection?.effectiveType || 'unknown'
    }
    return 'unknown'
  }, [])

  const getTimeOfDay = useCallback((): string => {
    const hour = new Date().getHours()
    if (hour < 6) return 'night'
    if (hour < 12) return 'morning'
    if (hour < 18) return 'afternoon'
    if (hour < 22) return 'evening'
    return 'night'
  }, [])

  const calculateFeedVelocity = useCallback((): number => {
    if (!currentSession) return 0
    const sessionDurationMinutes = (Date.now() - sessionStartTimeRef.current.getTime()) / 60000
    return sessionDurationMinutes > 0 ? currentSession.passagesViewed.length / sessionDurationMinutes : 0
  }, [currentSession])

  const calculateReadingTime = useCallback((text: string): number => {
    const wordsPerMinute = 200
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length
    return (wordCount / wordsPerMinute) * 60 * 1000 // Return in milliseconds
  }, [])

  const getWordCount = useCallback((text: string): number => {
    return text.split(/\s+/).filter(word => word.length > 0).length
  }, [])

  const calculateTextComplexity = useCallback((text: string): number => {
    const words = text.split(/\s+/).filter(word => word.length > 0)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    if (words.length === 0 || sentences.length === 0) return 5
    
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length
    const avgSentenceLength = words.length / sentences.length
    
    return Math.min(10, (avgWordLength + avgSentenceLength) / 2)
  }, [])

  const calculateScrollSpeed = useCallback((positions: number[], duration: number): number => {
    if (positions.length < 2 || duration === 0) return 0
    const totalDistance = Math.abs(positions[positions.length - 1] - positions[0])
    return (totalDistance / duration) * 1000 // pixels per second
  }, [])

  const determineReadingBehavior = useCallback((
    totalViewDuration: number,
    scrollSpeed: number,
    pauseCount: number,
    visibilityPercentage: number,
    interactionCount: number
  ): 'fast-scroll' | 'careful-read' | 're-read' | 'abandon' => {
    if (totalViewDuration < 2000 && scrollSpeed > 100) return 'fast-scroll'
    if (visibilityPercentage < 0.3 && totalViewDuration < 3000) return 'abandon'
    if (pauseCount > 2 || interactionCount > 1) return 're-read'
    return 'careful-read'
  }, [])

  const calculateSessionQuality = useCallback((): 'high' | 'medium' | 'low' => {
    if (!currentSession) return 'medium'
    
    const { passagesViewed, passagesLiked, passagesBookmarked, totalDuration } = currentSession
    
    const likeRate = passagesViewed.length > 0 ? passagesLiked.length / passagesViewed.length : 0
    const bookmarkRate = passagesViewed.length > 0 ? passagesBookmarked.length / passagesViewed.length : 0
    const avgTimePerPassage = passagesViewed.length > 0 ? totalDuration / passagesViewed.length : 0
    
    if (likeRate > 0.3 || bookmarkRate > 0.1 || avgTimePerPassage > 30000) return 'high'
    if (likeRate > 0.1 || avgTimePerPassage > 10000) return 'medium'
    return 'low'
  }, [currentSession])

  const cleanupPassageTracking = useCallback((passageId: string): void => {
    viewStartTimesRef.current.delete(passageId)
    pauseDurationsRef.current.delete(passageId)
    pauseStartTimesRef.current.delete(passageId)
    interactionCountsRef.current.delete(passageId)
    scrollPositionsRef.current.delete(passageId)
  }, [])

  const cleanupAllTracking = useCallback((): void => {
    viewStartTimesRef.current.clear()
    pauseDurationsRef.current.clear()
    pauseStartTimesRef.current.clear()
    interactionCountsRef.current.clear()
    scrollPositionsRef.current.clear()
  }, [])

  const queueEvent = useCallback((event: EngagementEvent): void => {
    const queue = eventQueueRef.current
    if (queue.length >= configRef.current.maxQueueSize) {
      queue.shift() // Remove oldest event
    }
    queue.push(event)
  }, [])

  const processEvent = useCallback(async (event: EngagementEvent, batch?: any): Promise<void> => {
    switch (event.type) {
      case 'START_SESSION':
        await saveSession(event.payload.sessionData)
        break
        
      case 'TRACK_VIEW':
        try {
          const viewEventData = {
            ...event.payload,
            timestamp: Timestamp.fromDate(event.payload.timestamp || new Date()),
            id: `view-${event.payload.passageId}-${Date.now()}`
          }
          
          if (batch) {
            const viewEventRef = doc(collection(db, 'userEngagement'), viewEventData.id)
            batch.set(viewEventRef, viewEventData)
          } else {
            await addDoc(collection(db, 'userEngagement'), viewEventData)
          }
        } catch (error) {
          console.error('Error saving view event:', error)
        }
        break
        
      case 'END_VIEW':
        await updateViewEvent(event.payload.passageId, event.payload.viewData)
        break
        
      case 'TRACK_ACTION':
        try {
          const actionEventData = {
            ...event.payload,
            timestamp: Timestamp.fromDate(event.payload.timestamp || new Date()),
            id: `action-${event.payload.passageId}-${Date.now()}`
          }
          
          if (batch) {
            const actionEventRef = doc(collection(db, 'userEngagement'), actionEventData.id)
            batch.set(actionEventRef, actionEventData)
          } else {
            await addDoc(collection(db, 'userEngagement'), actionEventData)
          }
        } catch (error) {
          console.error('Error saving action event:', error)
        }
        break
        
      case 'END_SESSION':
        await saveSession(event.payload.sessionData)
        break
    }
  }, [])

  const saveSession = useCallback(async (sessionData: UserSession): Promise<void> => {
    try {
      const sessionToSave = {
        ...sessionData,
        startTime: Timestamp.fromDate(sessionData.startTime),
        endTime: sessionData.endTime ? Timestamp.fromDate(sessionData.endTime) : null,
        // Calculate duration if session is being ended
        totalDuration: sessionData.endTime 
          ? sessionData.endTime.getTime() - sessionData.startTime.getTime()
          : sessionData.totalDuration
      }
      
      await addDoc(collection(db, 'userSessions'), sessionToSave)
    } catch (error) {
      console.error('Error saving session:', error)
    }
  }, [])

  const updateViewEvent = useCallback(async (passageId: string, viewData: any): Promise<void> => {
    try {
      const q = query(
        collection(db, 'userEngagement'),
        where('userId', '==', currentUserIdRef.current),
        where('passageId', '==', passageId),
        where('eventType', '==', 'view'),
        orderBy('timestamp', 'desc'),
        limit(1)
      )

      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const docRef = doc(db, 'userEngagement', snapshot.docs[0].id)
        await updateDoc(docRef, {
          'viewData.endTime': Timestamp.fromDate(viewData.endTime),
          'viewData.totalViewDuration': viewData.totalViewDuration,
          'viewData.visibilityPercentage': viewData.visibilityPercentage,
          'viewData.scrollSpeed': viewData.scrollSpeed,
          'viewData.pauseDurations': viewData.pauseDurations,
          'viewData.readingBehavior': viewData.readingBehavior,
          'viewData.interactionCount': viewData.interactionCount
        })
      }
    } catch (error) {
      console.error('Error updating view event:', error)
    }
  }, [])

  const flushEventQueue = useCallback(async (force: boolean = false): Promise<void> => {
    const queue = eventQueueRef.current
    
    if (queue.length === 0) {
      return
    }
    if (!force && queue.length < configRef.current.batchSize) {
      return
    }

    const eventsToProcess = [...queue]
    eventQueueRef.current = []

    try {
      const batch = writeBatch(db)
      
      for (const event of eventsToProcess) {
        await processEvent(event, batch)
      }
      
      await batch.commit()
    } catch (error) {
      
      if (configRef.current.enableOfflineQueue) {
        eventQueueRef.current = [...eventsToProcess, ...eventQueueRef.current]
      }
    }
  }, [processEvent])

  const calculateBasicBehaviorProfile = useCallback(async (): Promise<Partial<UserBehaviorProfile>> => {
    return {
      contentPreferences: {
        preferredAuthors: [],
        preferredCategories: [],
        preferredTags: [],
        preferredLength: 'medium',
        preferredDensity: 'airy',
        optimalReadingTime: 30000,
        timeOfDayPreferences: {},
        complexityPreference: 5
      },
      engagementPatterns: {
        averageSessionDuration: currentSession?.totalDuration || 0,
        averagePassagesPerSession: currentSession?.passagesViewed.length || 0,
        skipRate: 0,
        likeRate: 0,
        shareRate: 0,
        bookmarkRate: 0,
        returnRate: 0,
        readingSpeed: 200,
        attentionSpan: 60000,
        explorationVsExploitation: 0.5
      },
      usagePatterns: {
        preferredDaysOfWeek: [],
        preferredTimesOfDay: [],
        sessionFrequency: 1,
        averageSessionGap: 24 * 60 * 60 * 1000,
        seasonalTrends: {}
      },
      featureVector: {
        engagement_score: 50,
        diversity_preference: 0.5,
        discovery_tendency: 0.5,
        reading_stamina: 0.5,
        social_engagement: 0.5,
        content_loyalty: 0.5
      }
    }
  }, [currentSession])

  const updateUserBehaviorProfile = useCallback(async (): Promise<void> => {
    if (!currentUserIdRef.current) return

    try {
      const profileRef = doc(db, 'userBehaviorProfiles', currentUserIdRef.current)
      const profileDoc = await getDoc(profileRef)

      const basicProfile = await calculateBasicBehaviorProfile()

      if (profileDoc.exists()) {
        await updateDoc(profileRef, {
          ...basicProfile,
          lastUpdated: Timestamp.fromDate(new Date())
        })
      } else {
        await addDoc(collection(db, 'userBehaviorProfiles'), {
          userId: currentUserIdRef.current,
          ...basicProfile,
          lastUpdated: Timestamp.fromDate(new Date())
        })
      }
    } catch (error) {
      console.error('Error updating user behavior profile:', error)
    }
  }, [calculateBasicBehaviorProfile])

  // Main API functions
  const startSession = useCallback(async (userId: string): Promise<void> => {
    // Prevent multiple session initialization for the same user
    if (sessionInitializedRef.current && currentUserIdRef.current === userId) {
      return
    }

    // If we have a different user, end the previous session
    if (currentUserIdRef.current && currentUserIdRef.current !== userId && currentSession) {
      await endSession()
    }

    // Generate unique session ID with better entropy
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 3)
    const newSessionId = `${userId}-${timestamp}-${randomString}`
    
    currentUserIdRef.current = userId
    sessionIdRef.current = newSessionId
    sessionInitializedRef.current = true
    trackedPassagesRef.current.clear() // Clear tracked passages for new session
    sessionStartTimeRef.current = new Date()
    
    const newSession: UserSession = {
      id: newSessionId,
      userId,
      startTime: sessionStartTimeRef.current,
      totalDuration: 0,
      passagesViewed: [],
      passagesLiked: [],
      passagesSkipped: [],
      passagesBookmarked: [],
      totalScrollDistance: 0,
      averageTimePerPassage: 0,
      engagementEvents: [],
      sessionQuality: 'medium',
      deviceInfo: {
        type: getDeviceType(),
        userAgent: navigator?.userAgent || 'unknown',
        screenSize: {
          width: window?.screen?.width || 0,
          height: window?.screen?.height || 0
        },
        connectionType: getConnectionType()
      }
    }

    setCurrentSession(newSession)

    // Save session immediately to prevent data loss
    await saveSession(newSession)

    queueEvent({
      type: 'START_SESSION',
      payload: { sessionData: newSession },
      timestamp: new Date(),
      userId
    })
  }, [currentSession, getDeviceType, getConnectionType, queueEvent])

  const trackPassageView = useCallback(async (
    passageId: string, 
    bookId: string, 
    position: number, 
    passageData: any,
    previousPassageId?: string
  ): Promise<void> => {
    if (!currentUserIdRef.current || !currentSession) {
      return
    }

    const now = new Date()
    viewStartTimesRef.current.set(passageId, now)
    
    pauseDurationsRef.current.set(passageId, [])
    interactionCountsRef.current.set(passageId, 0)
    scrollPositionsRef.current.set(passageId, [])

    const feedVelocity = calculateFeedVelocity()

    const engagementEvent: Omit<UserEngagementEvent, 'id'> = {
      userId: currentUserIdRef.current,
      passageId,
      bookId,
      eventType: 'view',
      timestamp: now,
      viewData: {
        startTime: now,
        endTime: now,
        totalViewDuration: 0,
        visibilityPercentage: 1.0,
        scrollSpeed: 0,
        pauseDurations: [],
        readingBehavior: 'careful-read',
        interactionCount: 0
      },
      contextData: {
        timeOfDay: getTimeOfDay(),
        dayOfWeek: now.getDay(),
        deviceType: getDeviceType(),
        position,
        previousPassageId,
        sessionDuration: now.getTime() - sessionStartTimeRef.current.getTime(),
        isFirstView: !currentSession.passagesViewed.includes(passageId),
        feedVelocity
      },
      passageSnapshot: {
        ...passageData,
        estimatedReadingTime: calculateReadingTime(passageData.text || ''),
        wordCount: getWordCount(passageData.text || ''),
        textComplexity: calculateTextComplexity(passageData.text || ''),
        currentLikes: passageData.likes || 0,
        currentViews: passageData.engagement?.views || 0
      }
    }

    queueEvent({
      type: 'TRACK_VIEW',
      payload: engagementEvent,
      timestamp: now,
      userId: currentUserIdRef.current
    })

    // Check if we've already tracked this passage in this session
    if (trackedPassagesRef.current.has(passageId)) {
      return
    }

    // Add to tracked passages immediately to prevent duplicates
    trackedPassagesRef.current.add(passageId)

    if (!currentSession.passagesViewed.includes(passageId)) {
      setCurrentSession(prev => {
        if (!prev) return null
        const updated = {
          ...prev,
          passagesViewed: [...prev.passagesViewed, passageId],
          totalDuration: Date.now() - sessionStartTimeRef.current.getTime()
        }
        
        // Throttle session saves - only save every 5 seconds
        const now = Date.now()
        if ((now - lastSessionSaveRef.current) > 5000) {
          lastSessionSaveRef.current = now
          saveSession(updated).then(() => {
          }).catch(console.error)
        }
        
        return updated
      })
    }
  }, [currentSession, calculateFeedVelocity, getTimeOfDay, getDeviceType, calculateReadingTime, getWordCount, calculateTextComplexity, queueEvent])

  const trackPause = useCallback((passageId: string): void => {
    if (!configRef.current.enableDetailedTracking) return
    pauseStartTimesRef.current.set(passageId, new Date())
  }, [])

  const trackResume = useCallback((passageId: string): void => {
    if (!configRef.current.enableDetailedTracking) return
    
    const pauseStart = pauseStartTimesRef.current.get(passageId)
    if (pauseStart) {
      const pauseDuration = Date.now() - pauseStart.getTime()
      const currentPauses = pauseDurationsRef.current.get(passageId) || []
      currentPauses.push(pauseDuration)
      pauseDurationsRef.current.set(passageId, currentPauses)
      pauseStartTimesRef.current.delete(passageId)
    }
  }, [])

  const trackScroll = useCallback((passageId: string, scrollY: number): void => {
    if (!configRef.current.enableDetailedTracking) return
    
    const positions = scrollPositionsRef.current.get(passageId) || []
    positions.push(scrollY)
    scrollPositionsRef.current.set(passageId, positions)
  }, [])

  const trackPassageViewEnd = useCallback(async (
    passageId: string,
    visibilityPercentage: number = 1.0
  ): Promise<void> => {
    if (!currentUserIdRef.current) return

    const viewStart = viewStartTimesRef.current.get(passageId)
    if (!viewStart) return

    const now = new Date()
    const totalViewDuration = now.getTime() - viewStart.getTime()
    
    if (totalViewDuration < configRef.current.minViewDurationToTrack) {
      cleanupPassageTracking(passageId)
      return
    }

    const pauseData = pauseDurationsRef.current.get(passageId) || []
    const interactionCount = interactionCountsRef.current.get(passageId) || 0
    const scrollData = scrollPositionsRef.current.get(passageId) || []
    
    const scrollSpeed = calculateScrollSpeed(scrollData, totalViewDuration)
    const readingBehavior = determineReadingBehavior(
      totalViewDuration, 
      scrollSpeed, 
      pauseData.length,
      visibilityPercentage,
      interactionCount
    )

    queueEvent({
      type: 'END_VIEW',
      payload: {
        passageId,
        viewData: {
          endTime: now,
          totalViewDuration,
          visibilityPercentage,
          scrollSpeed,
          pauseDurations: pauseData,
          readingBehavior,
          interactionCount
        }
      },
      timestamp: now,
      userId: currentUserIdRef.current
    })

    cleanupPassageTracking(passageId)
  }, [calculateScrollSpeed, determineReadingBehavior, cleanupPassageTracking, queueEvent])

  const trackAction = useCallback(async (
    passageId: string,
    bookId: string,
    eventType: 'like' | 'share' | 'bookmark' | 'skip',
    position: number,
    additionalData?: any
  ): Promise<void> => {
    if (!currentUserIdRef.current || !currentSession) return

    const currentCount = interactionCountsRef.current.get(passageId) || 0
    interactionCountsRef.current.set(passageId, currentCount + 1)

    // Update session tracking
    setCurrentSession(prev => {
      if (!prev) return null
      
      const updated = { ...prev }
      switch (eventType) {
        case 'like':
          if (!updated.passagesLiked.includes(passageId)) {
            updated.passagesLiked = [...updated.passagesLiked, passageId]
          }
          break
        case 'bookmark':
          if (!updated.passagesBookmarked.includes(passageId)) {
            updated.passagesBookmarked = [...updated.passagesBookmarked, passageId]
          }
          break
        case 'skip':
          if (!updated.passagesSkipped.includes(passageId)) {
            updated.passagesSkipped = [...updated.passagesSkipped, passageId]
          }
          break
      }
      return updated
    })

    const engagementEvent: Omit<UserEngagementEvent, 'id'> = {
      userId: currentUserIdRef.current,
      passageId,
      bookId,
      eventType,
      timestamp: new Date(),
      contextData: {
        timeOfDay: getTimeOfDay(),
        dayOfWeek: new Date().getDay(),
        deviceType: getDeviceType(),
        position,
        sessionDuration: Date.now() - sessionStartTimeRef.current.getTime(),
        isFirstView: true,
        feedVelocity: calculateFeedVelocity()
      },
      passageSnapshot: additionalData || {}
    }

    queueEvent({
      type: 'TRACK_ACTION',
      payload: engagementEvent,
      timestamp: new Date(),
      userId: currentUserIdRef.current
    })
  }, [currentSession, getTimeOfDay, getDeviceType, calculateFeedVelocity, queueEvent])

  const endSession = useCallback(async (): Promise<void> => {
    if (!currentSession || !currentUserIdRef.current) {
      return
    }

    const now = new Date()
    const sessionDuration = now.getTime() - sessionStartTimeRef.current.getTime()
    
    const updatedSession = {
      ...currentSession,
      endTime: now,
      totalDuration: sessionDuration,
      sessionQuality: calculateSessionQuality()
    }

    updatedSession.averageTimePerPassage = 
      updatedSession.passagesViewed.length > 0 
        ? updatedSession.totalDuration / updatedSession.passagesViewed.length
        : 0

    // Save the final session data
    await saveSession(updatedSession)

    queueEvent({
      type: 'END_SESSION',
      payload: { sessionData: updatedSession },
      timestamp: now,
      userId: currentUserIdRef.current
    })

    await flushEventQueue(true)
    await updateUserBehaviorProfile()

    setCurrentSession(null)
    currentUserIdRef.current = null
    sessionIdRef.current = null
    sessionInitializedRef.current = false
    trackedPassagesRef.current.clear()
    cleanupAllTracking()
  }, [currentSession, calculateSessionQuality, queueEvent, flushEventQueue, updateUserBehaviorProfile, cleanupAllTracking, saveSession])

  const getUserBehaviorProfile = useCallback(async (userId: string): Promise<UserBehaviorProfile | null> => {
    try {
      const profileDoc = await getDoc(doc(db, 'userBehaviorProfiles', userId))
      if (profileDoc.exists()) {
        return {
          id: profileDoc.id,
          ...profileDoc.data(),
          lastUpdated: profileDoc.data().lastUpdated?.toDate() || new Date()
        } as UserBehaviorProfile
      }
      return null
    } catch (error) {
      console.error('Error fetching user behavior profile:', error)
      return null
    }
  }, [])

  const getPassageEngagementAggregates = useCallback(async (passageId: string): Promise<EngagementAggregates | null> => {
    try {
      const aggregateDoc = await getDoc(doc(db, 'engagementAggregates', passageId))
      if (aggregateDoc.exists()) {
        return {
          ...aggregateDoc.data(),
          lastUpdated: aggregateDoc.data().lastUpdated?.toDate() || new Date()
        } as EngagementAggregates
      }
      return null
    } catch (error) {
      console.error('Error fetching engagement aggregates:', error)
      return null
    }
  }, [])

  // Set up periodic flushing and session updates
  useEffect(() => {
    const flushInterval = setInterval(() => {
      flushEventQueue()
    }, configRef.current.flushInterval)

    // Update session duration periodically while session is active
    const sessionUpdateInterval = setInterval(async () => {
      if (currentSession && currentUserIdRef.current && sessionInitializedRef.current) {
        const updatedSession = {
          ...currentSession,
          totalDuration: Date.now() - sessionStartTimeRef.current.getTime()
        }
        
        setCurrentSession(updatedSession)
        
        // Save session data every 5 minutes to ensure persistence (reduced frequency)
        if (updatedSession.totalDuration > 0 && updatedSession.totalDuration % 300000 < 30000) {
          await saveSession(updatedSession)
        }
      }
    }, 30000) // Update every 30 seconds

    const handleBeforeUnload = () => {
      flushEventQueue(true)
      // Also end session before unload
      if (currentSession && currentUserIdRef.current) {
        endSession()
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      clearInterval(flushInterval)
      clearInterval(sessionUpdateInterval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [flushEventQueue, currentSession, endSession])

  const value: EngagementContextType = {
    currentSession,
    trackPassageView,
    trackPassageViewEnd,
    trackPause,
    trackResume,
    trackScroll,
    trackAction,
    startSession,
    endSession,
    getUserBehaviorProfile,
    getPassageEngagementAggregates
  }

  return (
    <EngagementContext.Provider value={value}>
      {children}
    </EngagementContext.Provider>
  )
}

export function useEngagement(): EngagementContextType {
  const context = useContext(EngagementContext)
  if (!context) {
    throw new Error('useEngagement must be used within an EngagementProvider')
  }
  return context
}