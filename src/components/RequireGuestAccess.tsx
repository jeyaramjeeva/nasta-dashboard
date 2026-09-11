import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isGuestUser } from '../lib/guestAuth'

/** Playground — Guest account only. */
export function RequireGuestAccess({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!isGuestUser(user)) {
    return <Navigate to="/orders" replace />
  }
  return <>{children}</>
}
