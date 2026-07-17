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
import {
  checkStallUnlockPin,
  enterStallMode,
  exitStallMode,
  isStallMode,
  STALL_IDLE_ENTER_MS,
  STALL_IDLE_RELOCK_MS,
} from '../lib/stallMode'

interface StallModeContextValue {
  isStall: boolean
  enterStall: () => void
  /** Returns true if unlocked with PIN. */
  unlockStall: (pin: string) => boolean
  /** Call on Orders page activity so idle auto-enter resets. */
  bumpOrdersActivity: () => void
}

const StallModeContext = createContext<StallModeContextValue | null>(null)

export function StallModeProvider({ children }: { children: ReactNode }) {
  const [isStall, setIsStall] = useState(() => isStallMode())
  /** After a successful unlock, idle will re-lock. Fresh sessions stay unlocked. */
  const [relockArmed, setRelockArmed] = useState(false)
  const ordersIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const relockIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isStallRef = useRef(isStall)
  isStallRef.current = isStall

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
    setIsStall(true)
    clearRelockIdle()
  }, [clearRelockIdle])

  const unlockStall = useCallback((pin: string) => {
    if (!checkStallUnlockPin(pin)) return false
    exitStallMode()
    setIsStall(false)
    setRelockArmed(true)
    return true
  }, [])

  const scheduleRelock = useCallback(() => {
    clearRelockIdle()
    if (isStallRef.current) return
    relockIdleRef.current = setTimeout(() => {
      enterStallMode()
      setIsStall(true)
    }, STALL_IDLE_RELOCK_MS)
  }, [clearRelockIdle])

  const bumpOrdersActivity = useCallback(() => {
    clearOrdersIdle()
    if (isStallRef.current) return
    ordersIdleRef.current = setTimeout(() => {
      enterStallMode()
      setIsStall(true)
    }, STALL_IDLE_ENTER_MS)
  }, [clearOrdersIdle])

  // After unlock: idle → re-lock Stall mode
  useEffect(() => {
    if (isStall || !relockArmed) {
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
  }, [isStall, relockArmed, scheduleRelock, clearRelockIdle])

  useEffect(
    () => () => {
      clearOrdersIdle()
      clearRelockIdle()
    },
    [clearOrdersIdle, clearRelockIdle],
  )

  const value = useMemo(
    () => ({ isStall, enterStall, unlockStall, bumpOrdersActivity }),
    [isStall, enterStall, unlockStall, bumpOrdersActivity],
  )

  return <StallModeContext.Provider value={value}>{children}</StallModeContext.Provider>
}

/** Mount on Orders page to auto-enter Stall mode after 2 min idle. */
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
