import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canManageUploads } from '../lib/authAllowlist'

/** Blocks /upload for anyone who is not Jeeva. */
export function RequireUploadAccess({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!canManageUploads(user)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
