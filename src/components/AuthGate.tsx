import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { Login } from '../pages/Login'
import { SkeletonPage } from './Skeleton'

export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth()

  if (loading) return <SkeletonPage />
  if (!user) return <Login />
  return <>{children}</>
}
