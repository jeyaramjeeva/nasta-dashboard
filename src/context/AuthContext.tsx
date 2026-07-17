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
import {
  checkGuestPassword,
  GUEST_EMAIL,
  GUEST_NAME,
  isGuestEmail,
  isGuestName,
} from '../lib/guestAuth'
import { sendForgotPasswordRequest } from '../lib/passwordHelp'
import { checkUploadPassword, getSupabase, isCloudConfigured } from '../lib/supabase'

const LOCAL_AUTH_KEY = 'nasta-local-auth-v1'
const TEAM = ['Jeeva', 'Sriram', 'Sneha', GUEST_NAME] as const

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
  /** True after clicking a Supabase recovery link — must set a new password. */
  needsNewPassword: boolean
  clearNeedsNewPassword: () => void
  signInWithPassword: (email: string, password: string) => Promise<void>
  /** Local-only gate when Supabase is not configured */
  signInLocal: (name: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  setNewPassword: (newPassword: string) => Promise<void>
  requestPasswordReset: (accountName: string, accountEmail: string) => Promise<void>
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
  const [needsNewPassword, setNeedsNewPassword] = useState(false)

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

    const { data: sub } = sb.auth.onAuthStateChange((event, next: Session | null) => {
      if (event === 'PASSWORD_RECOVERY') {
        setNeedsNewPassword(true)
      }
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

  const clearNeedsNewPassword = useCallback(() => setNeedsNewPassword(false), [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const trimmed = email.trim().toLowerCase()
    if (!isEmailAllowed(trimmed)) {
      throw new Error('This email is not on the team allowlist.')
    }
    const sb = getSupabase()
    if (!sb) throw new Error('Supabase is not configured')

    const { data, error } = await sb.auth.signInWithPassword({
      email: trimmed,
      password,
    })
    if (error) {
      if (isGuestEmail(trimmed)) {
        throw new Error(
          `Guest login failed. In Supabase → Authentication → Users, create ${GUEST_EMAIL} with password Guest9987 (Auto Confirm), then try again.`,
        )
      }
      throw new Error(error.message)
    }

    const mapped = toAuthUser(data.user?.email)
    if (!mapped) {
      await sb.auth.signOut()
      throw new Error('Account is not allowed. Contact Jeeva.')
    }
    setUser(mapped)
  }, [])

  const signInLocal = useCallback(async (name: string, password: string) => {
    if (!TEAM.includes(name as (typeof TEAM)[number])) {
      throw new Error('Pick Jeeva, Sriram, Sneha, or Guest.')
    }
    if (isGuestName(name)) {
      if (!checkGuestPassword(password)) {
        throw new Error('Wrong guest password.')
      }
    } else if (!checkUploadPassword(password)) {
      throw new Error('Wrong team password.')
    }
    const allowed: AllowedUser = findAllowedUser(emailForTeamName(name)) ?? {
      email: isGuestName(name) ? GUEST_EMAIL : emailForTeamName(name),
      name,
    }
    const next: AuthUser = {
      email: allowed.email,
      name: allowed.name,
      source: 'local',
    }
    saveLocalAuth(next)
    setUser(next)
  }, [])

  const signOut = useCallback(async () => {
    saveLocalAuth(null)
    setUser(null)
    setNeedsNewPassword(false)
    const sb = getSupabase()
    if (sb) await sb.auth.signOut()
  }, [])

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!cloudAuth) {
        throw new Error('Password changes need cloud login (Supabase).')
      }
      if (!user?.email) throw new Error('Not signed in.')
      if (newPassword.trim().length < 8) {
        throw new Error('New password must be at least 8 characters.')
      }
      const sb = getSupabase()
      if (!sb) throw new Error('Supabase is not configured')

      const { error: verifyError } = await sb.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (verifyError) throw new Error('Current password is wrong.')

      const { error } = await sb.auth.updateUser({ password: newPassword })
      if (error) throw new Error(error.message)
    },
    [cloudAuth, user?.email],
  )

  const setNewPassword = useCallback(
    async (newPassword: string) => {
      if (!cloudAuth) {
        throw new Error('Password changes need cloud login (Supabase).')
      }
      if (newPassword.trim().length < 8) {
        throw new Error('New password must be at least 8 characters.')
      }
      const sb = getSupabase()
      if (!sb) throw new Error('Supabase is not configured')
      const { error } = await sb.auth.updateUser({ password: newPassword })
      if (error) throw new Error(error.message)
    },
    [cloudAuth],
  )

  const requestPasswordReset = useCallback(
    async (accountName: string, accountEmail: string) => {
      const name = accountName.trim() || 'Team member'
      const email = accountEmail.trim().toLowerCase()
      if (!email.includes('@')) {
        throw new Error('Pick whose account needs a reset.')
      }

      await sendForgotPasswordRequest({ accountName: name, accountEmail: email })

      // Also try Supabase recovery to their account email (if inbox works).
      if (cloudAuth && isEmailAllowed(email)) {
        const sb = getSupabase()
        if (sb) {
          const redirectTo = `${window.location.origin}/account`
          await sb.auth.resetPasswordForEmail(email, { redirectTo }).catch(() => {
            /* admin Gmail notify already sent */
          })
        }
      }
    },
    [cloudAuth],
  )

  const value = useMemo(
    () => ({
      loading,
      user,
      cloudAuth,
      needsNewPassword,
      clearNeedsNewPassword,
      signInWithPassword,
      signInLocal,
      signOut,
      changePassword,
      setNewPassword,
      requestPasswordReset,
    }),
    [
      loading,
      user,
      cloudAuth,
      needsNewPassword,
      clearNeedsNewPassword,
      signInWithPassword,
      signInLocal,
      signOut,
      changePassword,
      setNewPassword,
      requestPasswordReset,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
