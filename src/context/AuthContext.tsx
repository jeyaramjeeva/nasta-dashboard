import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  findAllowedUser,
  getAllowedUsers,
  isEmailAllowed,
  type AllowedUser,
} from '../lib/authAllowlist'
import { checkUploadPassword, getSupabase, isCloudConfigured } from '../lib/supabase'

const LOCAL_AUTH_KEY = 'nasta-local-auth-v1'
const TEAM = ['Jeeva', 'Sriram', 'Sneha'] as const

export interface AuthUser {
  email: string
  name: string
  /** supabase | local (dev / no cloud) */
  source: 'supabase' | 'local'
}

interface AuthContextValue {
  loading: boolean
  user: AuthUser | null
  cloudAuth: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  /** Local-only gate when Supabase is not configured */
  signInLocal: (name: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toAuthUser(email: string | undefined): AuthUser | null {
  const allowed = findAllowedUser(email)
  if (!allowed) return null
  return {
    email: allowed.email,
    name: allowed.name,
    source: 'supabase',
  }
}

function loadLocalAuth(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(LOCAL_AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthUser
    if (!parsed?.name || parsed.source !== 'local') return null
    if (!TEAM.includes(parsed.name as (typeof TEAM)[number])) return null
    return parsed
  } catch {
    return null
  }
}

function saveLocalAuth(user: AuthUser | null) {
  if (!user) sessionStorage.removeItem(LOCAL_AUTH_KEY)
  else sessionStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(user))
}

function emailForTeamName(name: string): string {
  const hit = getAllowedUsers().find((u) => u.name.toLowerCase() === name.toLowerCase())
  return hit?.email ?? `${name.toLowerCase()}@local`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cloudAuth = isCloudConfigured()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!cloudAuth) {
      setUser(loadLocalAuth())
      setLoading(false)
      return
    }

    const sb = getSupabase()
    if (!sb) {
      setLoading(false)
      return
    }

    void sb.auth.getSession().then(({ data }) => {
      if (cancelled) return
      const mapped = toAuthUser(data.session?.user?.email)
      setUser(mapped)
      if (data.session?.user && !mapped) {
        void sb.auth.signOut()
      }
      setLoading(false)
    })

    const { data: sub } = sb.auth.onAuthStateChange((_event, next: Session | null) => {
      const mapped = toAuthUser(next?.user?.email)
      setUser(mapped)
      if (next?.user && !mapped) {
        void sb.auth.signOut()
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [cloudAuth])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const trimmed = email.trim().toLowerCase()
    if (!isEmailAllowed(trimmed)) {
      throw new Error('This email is not on the team allowlist (Jeeva / Sriram / Sneha only).')
    }
    const sb = getSupabase()
    if (!sb) throw new Error('Supabase is not configured')

    const { data, error } = await sb.auth.signInWithPassword({
      email: trimmed,
      password,
    })
    if (error) throw new Error(error.message)

    const mapped = toAuthUser(data.user?.email)
    if (!mapped) {
      await sb.auth.signOut()
      throw new Error('Account is not allowed. Contact Jeeva.')
    }
    setUser(mapped)
  }, [])

  const signInLocal = useCallback(async (name: string, password: string) => {
    if (!TEAM.includes(name as (typeof TEAM)[number])) {
      throw new Error('Pick Jeeva, Sriram, or Sneha.')
    }
    if (!checkUploadPassword(password)) {
      throw new Error('Wrong team password.')
    }
    const allowed: AllowedUser = findAllowedUser(emailForTeamName(name)) ?? {
      email: emailForTeamName(name),
      name,
    }
    const next: AuthUser = {
      email: allowed.email,
      name,
      source: 'local',
    }
    saveLocalAuth(next)
    setUser(next)
  }, [])

  const signOut = useCallback(async () => {
    saveLocalAuth(null)
    setUser(null)
    const sb = getSupabase()
    if (sb) await sb.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({
      loading,
      user,
      cloudAuth,
      signInWithPassword,
      signInLocal,
      signOut,
    }),
    [loading, user, cloudAuth, signInWithPassword, signInLocal, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
