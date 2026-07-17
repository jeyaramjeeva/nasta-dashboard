import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme, type ThemeMode } from '../context/ThemeContext'
import { fetchUserTheme, saveUserTheme } from '../lib/cloudExtras'
import { isDemoMode } from '../lib/demoMode'
import { isCloudConfigured } from '../lib/supabase'

/** Loads / saves theme preference to Supabase user_prefs when signed in. */
export function ThemeCloudSync() {
  const { user, cloudAuth } = useAuth()
  const { mode, setMode } = useTheme()
  const loadedFor = useRef<string | null>(null)
  const skipSave = useRef(false)

  useEffect(() => {
    if (isDemoMode()) return
    if (!cloudAuth || !user || !isCloudConfigured()) return
    if (user.source !== 'supabase') return
    if (loadedFor.current === user.email) return
    let cancelled = false
    ;(async () => {
      const remote = await fetchUserTheme()
      if (cancelled) return
      loadedFor.current = user.email
      if (remote && remote !== mode) {
        skipSave.current = true
        setMode(remote)
      } else if (!remote) {
        await saveUserTheme(mode)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cloudAuth, user, mode, setMode])

  useEffect(() => {
    if (isDemoMode()) return
    if (!cloudAuth || !user || user.source !== 'supabase') return
    if (!isCloudConfigured()) return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    if (loadedFor.current !== user.email) return
    const t = window.setTimeout(() => {
      void saveUserTheme(mode as ThemeMode)
    }, 400)
    return () => window.clearTimeout(t)
  }, [mode, cloudAuth, user])

  return null
}
