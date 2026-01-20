'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { 
  onAuthStateChanged, 
  signInAnonymously, 
  User as FirebaseUser,
  signOut 
} from 'firebase/auth'
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

interface AppUser {
  id: string
  isAnonymous: boolean
  createdAt: Date
}

interface UserContextType {
  currentUser: AppUser | null
  isAuthInitialized: boolean
  createAnonymousUser: () => Promise<AppUser | null>
  signOut: () => Promise<void>
}

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [authInitialized, setAuthInitialized] = useState(false)

  const handleUserSignIn = useCallback(async (firebaseUser: FirebaseUser): Promise<void> => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid)
      const userDoc = await getDoc(userDocRef)

      let userData: AppUser

      if (userDoc.exists()) {
        // Existing user
        userData = {
          id: firebaseUser.uid,
          isAnonymous: firebaseUser.isAnonymous,
          createdAt: userDoc.data().createdAt?.toDate() || new Date(),
        }
      } else {
        // New user
        userData = {
          id: firebaseUser.uid,
          isAnonymous: firebaseUser.isAnonymous,
          createdAt: new Date(),
        }

        // Create user document
        await setDoc(userDocRef, {
          ...userData,
          createdAt: Timestamp.fromDate(userData.createdAt),
        })
      }

      setCurrentUser(userData)
    } catch (error) {
      console.error("Error handling user sign-in:", error)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        handleUserSignIn(firebaseUser)
      } else {
        setCurrentUser(null)
      }
      setAuthInitialized(true)
    })

    return () => unsubscribe()
  }, [handleUserSignIn])

  const createAnonymousUser = async (): Promise<AppUser | null> => {
    try {
      const userCredential = await signInAnonymously(auth)
      if (userCredential.user) {
        // The onAuthStateChanged listener will handle the user creation/update
        // We can't immediately return the user object here as it's handled async
        // For simplicity, we'll return null and let the UI react to the context change
        return null
      }
      return null
    } catch (error) {
      console.error("Error creating anonymous user:", error)
      return null
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      setCurrentUser(null)
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const value: UserContextType = {
    currentUser,
    isAuthInitialized: authInitialized,
    createAnonymousUser,
    signOut: handleSignOut,
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}