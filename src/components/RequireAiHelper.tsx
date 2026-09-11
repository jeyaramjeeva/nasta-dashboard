import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canUseAiHelper } from '../lib/authAllowlist'

export function RequireAiHelper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!canUseAiHelper(user)) return <Navigate to="/" replace />
  return <>{children}</>
}
