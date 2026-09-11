import { useCallback, useState, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { peekPinEnrollPending } from '../lib/loginPin'
import { Login } from '../pages/Login'
import { PinEnroll } from './PinEnroll'
import { SkeletonPage } from './Skeleton'

export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth()
  const [enrollTick, setEnrollTick] = useState(0)
  const pending = peekPinEnrollPending()

  const clearEnroll = useCallback(() => {
    setEnrollTick((n) => n + 1)
  }, [])

  if (loading) return <SkeletonPage />
  if (!user) return <Login />
  // enrollTick forces re-read after PinEnroll clears sessionStorage
  void enrollTick
  if (pending) return <PinEnroll onDone={clearEnroll} />
  return <>{children}</>
}
