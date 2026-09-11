import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import { isGuestUser } from '../lib/guestAuth'
import { setDataSaver } from '../lib/dataSaver'
import { checkStallUnlockPin, enterStallMode, exitStallMode, isStallMode, isStallUnlockedSession } from '../lib/stallMode'
import { idleEnterMs, idleRelockMs } from '../lib/siteConfig'
import { isStallDayToday } from '../lib/loginOpenToday'
import { useAuth } from './AuthContext'
import { useSiteConfig } from './SiteConfigContext'

interface StallModeContextValue {
  isStall: boolean
  /** Guest accounts are locked to stall view permanently. */
  isGuestLocked: boolean
  enterStall: () => void
  /** Returns true if unlocked with PIN. Guests cannot unlock. */
  unlockStall: (pin: string) => boolean
  /** Call on Orders page activity so idle auto-enter resets. */
  bumpOrdersActivity: () => void
}

const StallModeContext = createContext<StallModeContextValue | null>(null)

export function StallModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { config } = useSiteConfig()
  const idleEnter = idleEnterMs(config.settings)
  const idleRelock = idleRelockMs(config.settings)
  const isGuestLocked = isGuestUser(user)

  const [stallFlag, setStallFlag] = useState(() => {
    if (isStallMode()) return true
    return !isStallUnlockedSession() && isStallDayToday()
  })
  /** After a successful unlock, idle will re-lock. Fresh sessions stay unlocked. */
  const [relockArmed, setRelockArmed] = useState(false)
  const ordersIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const relockIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isStall = isGuestLocked || stallFlag
  const isStallRef = useRef(isStall)
  isStallRef.current = isStall

  useEffect(() => {
    if (!isGuestLocked) return
    enterStallMode()
    setStallFlag(true)
    setDataSaver(true)
  }, [isGuestLocked])

  useEffect(() => {
    if (isGuestLocked) return
    if (!stallFlag) return
    enterStallMode()
    setDataSaver(true)
  }, [isGuestLocked, stallFlag])

  const clearOrdersIdle = useCallback(() => {
    if (ordersIdleRef.current) {
      clearTimeout(ordersIdleRef.current)
      ordersIdleRef.current = null
    }
  }, [])

  const clearRelockIdle = useCallback(() => {
    if (relockIdleRef.current) {
      clearTimeout(relockIdleRef.current)
      relockIdleRef.current = null
    }
  }, [])

  const enterStall = useCallback(() => {
    enterStallMode()
    setStallFlag(true)
    // Event POS: cut cloud GB — slow sync + hide chat/AI in the dock.
    setDataSaver(true)
    clearRelockIdle()
  }, [clearRelockIdle])

  const unlockStall = useCallback(
    (pin: string) => {
      if (isGuestLocked) return false
      if (!checkStallUnlockPin(pin)) return false
      exitStallMode()
      setStallFlag(false)
      setRelockArmed(true)
      return true
    },
    [isGuestLocked],
  )

  const scheduleRelock = useCallback(() => {
    clearRelockIdle()
    if (isStallRef.current) return
    relockIdleRef.current = setTimeout(() => {
      enterStallMode()
      setStallFlag(true)
      setDataSaver(true)
    }, idleRelock)
  }, [clearRelockIdle, idleRelock])

  const bumpOrdersActivity = useCallback(() => {
    clearOrdersIdle()
    if (isStallRef.current) return
    ordersIdleRef.current = setTimeout(() => {
      enterStallMode()
      setStallFlag(true)
      setDataSaver(true)
    }, idleEnter)
  }, [clearOrdersIdle, idleEnter])

  // After unlock: idle → re-lock Stall mode
  useEffect(() => {
    if (isGuestLocked || isStall || !relockArmed) {
      clearRelockIdle()
      return
    }
    const onActivity = () => scheduleRelock()
    scheduleRelock()
    const evs = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const
    for (const e of evs) window.addEventListener(e, onActivity, { passive: true })
    return () => {
      for (const e of evs) window.removeEventListener(e, onActivity)
      clearRelockIdle()
    }
  }, [isGuestLocked, isStall, relockArmed, scheduleRelock, clearRelockIdle])

  useEffect(
    () => () => {
      clearOrdersIdle()
      clearRelockIdle()
    },
    [clearOrdersIdle, clearRelockIdle],
  )

  const value = useMemo(
    () => ({ isStall, isGuestLocked, enterStall, unlockStall, bumpOrdersActivity }),
    [isStall, isGuestLocked, enterStall, unlockStall, bumpOrdersActivity],
  )

  return <StallModeContext.Provider value={value}>{children}</StallModeContext.Provider>
}

/** Mount on Orders page to auto-enter Stall mode after idle timeout. */
export function useOrdersStallIdle() {
  const { isStall, bumpOrdersActivity } = useStallMode()
  const location = useLocation()

  useEffect(() => {
    if (!location.pathname.startsWith('/orders')) return
    if (isStall) return
    bumpOrdersActivity()
    const onActivity = () => bumpOrdersActivity()
    const evs = ['pointerdown', 'keydown', 'touchstart'] as const
    for (const e of evs) window.addEventListener(e, onActivity, { passive: true })
    return () => {
      for (const e of evs) window.removeEventListener(e, onActivity)
    }
  }, [location.pathname, isStall, bumpOrdersActivity])
}

export function useStallMode() {
  const ctx = useContext(StallModeContext)
  if (!ctx) throw new Error('useStallMode must be used within StallModeProvider')
  return ctx
}
