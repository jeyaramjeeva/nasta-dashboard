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

interface DemoModeContextValue {
  isDemo: boolean
  enterDemo: () => void
  exitDemo: () => void
  resetDemo: () => void
}

const DemoModeContext = createContext<DemoModeContextValue | null>(null)

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemo] = useState(() => isDemoMode())

  const enterDemo = useCallback(() => enterDemoMode(), [])
  const exitDemo = useCallback(() => exitDemoMode(), [])
  const resetDemo = useCallback(() => resetDemoSandbox(), [])

  const value = useMemo(
    () => ({ isDemo, enterDemo, exitDemo, resetDemo }),
    [isDemo, enterDemo, exitDemo, resetDemo],
  )

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>
}

export function useDemoMode() {
  const ctx = useContext(DemoModeContext)
  if (!ctx) throw new Error('useDemoMode must be used within DemoModeProvider')
  return ctx
}
