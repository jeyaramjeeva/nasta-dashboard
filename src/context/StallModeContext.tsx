import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  checkStallUnlockPassword,
  enterStallMode,
  exitStallMode,
  isStallMode,
} from '../lib/stallMode'

interface StallModeContextValue {
  isStall: boolean
  enterStall: () => void
  /** Returns true if unlocked. */
  unlockStall: (password: string) => boolean
}

const StallModeContext = createContext<StallModeContextValue | null>(null)

export function StallModeProvider({ children }: { children: ReactNode }) {
  const [isStall, setIsStall] = useState(() => isStallMode())

  const enterStall = useCallback(() => {
    enterStallMode()
    setIsStall(true)
  }, [])

  const unlockStall = useCallback((password: string) => {
    if (!checkStallUnlockPassword(password)) return false
    exitStallMode()
    setIsStall(false)
    return true
  }, [])

  const value = useMemo(
    () => ({ isStall, enterStall, unlockStall }),
    [isStall, enterStall, unlockStall],
  )

  return <StallModeContext.Provider value={value}>{children}</StallModeContext.Provider>
}

export function useStallMode() {
  const ctx = useContext(StallModeContext)
  if (!ctx) throw new Error('useStallMode must be used within StallModeProvider')
  return ctx
}
