import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isJeevaAccount } from '../lib/authAllowlist'

export function RequireJeeva({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!isJeevaAccount(user)) return <Navigate to="/" replace />
  return <>{children}</>
}
