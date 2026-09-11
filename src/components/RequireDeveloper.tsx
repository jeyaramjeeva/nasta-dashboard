import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canDevelop } from '../lib/authAllowlist'

export function RequireDeveloper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!canDevelop(user)) return <Navigate to="/" replace />
  return <>{children}</>
}
