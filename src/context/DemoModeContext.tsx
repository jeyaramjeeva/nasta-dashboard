import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  enterDemoMode,
  exitDemoMode,
  isDemoMode,
  resetDemoSandbox,
} from '../lib/demoMode'
import { enterTillTraining, isTillTraining } from '../lib/tillTraining'

interface DemoModeContextValue {
  isDemo: boolean
  enterDemo: () => void
  exitDemo: () => void
  resetDemo: () => void
  enterTillTraining: () => void
  isTillTraining: boolean
}

const DemoModeContext = createContext<DemoModeContextValue | null>(null)

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemo] = useState(() => isDemoMode())

  const enterDemo = useCallback(() => enterDemoMode(), [])
  const exitDemo = useCallback(() => exitDemoMode(), [])
  const startTillTraining = useCallback(() => enterTillTraining(), [])
  const resetDemo = useCallback(() => {
    if (isTillTraining()) enterTillTraining()
    else resetDemoSandbox()
  }, [])

  const value = useMemo(
    () => ({
      isDemo,
      enterDemo,
      exitDemo,
      resetDemo,
      enterTillTraining: startTillTraining,
      isTillTraining: isTillTraining(),
    }),
    [isDemo, enterDemo, exitDemo, resetDemo, startTillTraining],
  )

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>
}

export function useDemoMode() {
  const ctx = useContext(DemoModeContext)
  if (!ctx) throw new Error('useDemoMode must be used within DemoModeProvider')
  return ctx
}
