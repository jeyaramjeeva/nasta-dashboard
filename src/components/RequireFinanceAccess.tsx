import { Navigate, useLocation } from 'react-router-dom'
import { useStallMode } from '../context/StallModeContext'
import { isMoneyPath } from '../lib/stallMode'

/** Redirects away from money pages while Stall mode is on. */
export function RequireFinanceAccess({ children }: { children: React.ReactNode }) {
  const { isStall } = useStallMode()
  const location = useLocation()
  if (isStall && isMoneyPath(location.pathname)) {
    return <Navigate to="/orders" replace />
  }
  return <>{children}</>
}
