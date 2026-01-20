'use client'

import { useEffect } from 'react'
import { EngagementProvider } from '@/services/engagementService'
import { UserProvider, useUser } from '@/services/userService'

function SessionInitializer({ children }: { children: React.ReactNode }) {
  const { currentUser, isAuthInitialized, createAnonymousUser } = useUser()

  useEffect(() => {
    console.log('🔐 SessionInitializer effect:', { isAuthInitialized, currentUser: !!currentUser })
    if (isAuthInitialized && !currentUser) {
      // Create anonymous user if none exists
      console.log('🆔 Creating anonymous user...')
      createAnonymousUser()
    }
  }, [isAuthInitialized, currentUser, createAnonymousUser])

  return <>{children}</>
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <EngagementProvider>
      <UserProvider>
        <SessionInitializer>
          {children}
        </SessionInitializer>
      </UserProvider>
    </EngagementProvider>
  )
}