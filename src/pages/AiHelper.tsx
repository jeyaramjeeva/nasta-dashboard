import { Navigate } from 'react-router-dom'
import { MotionCard } from '../components/MotionCard'
import { useAuth } from '../context/AuthContext'
import { canUseAiHelper } from '../lib/authAllowlist'

/** Legacy route — AI helper lives in the bottom-right floating button. */
export function AiHelper() {
  const { user } = useAuth()

  if (!user || !canUseAiHelper(user)) {
    return (
      <MotionCard interactive={false}>
        <h2>AI helper</h2>
        <p className="hint-inline">Available for Sriram, Sneha, Jeeva, and Developer.</p>
      </MotionCard>
    )
  }

  return <Navigate to="/" replace />
}
