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
import { useAuth } from './AuthContext'
import { useStallOps } from './StallOpsContext'
import { askAiCoach } from '../lib/aiClient'
import { canUseAiHelper } from '../lib/authAllowlist'
import {
  buildBackgroundTips,
  buildCoachLlmContext,
  parseCoachLlmReply,
  tipsToBriefing,
  type AiTip,
} from '../lib/backgroundAi'
import { isStallMode } from '../lib/stallMode'

const STORE_KEY = 'nasta-bg-ai-v1'
const RULES_MS = 3 * 60 * 1000
const LLM_MS = 25 * 60 * 1000

interface Stored {
  tips: AiTip[]
  briefing: string
  actions: string[]
  source: 'rules' | 'llm'
  lastRulesAt: number
  lastLlmAt: number
  dismissed: string[]
}

interface BackgroundAiContextValue {
  tips: AiTip[]
  visibleTips: AiTip[]
  briefing: string
  actions: string[]
  source: 'rules' | 'llm'
  running: boolean
  lastRunAt: number | null
  urgentCount: number
  refresh: (opts?: { forceLlm?: boolean }) => Promise<void>
  dismiss: (id: string) => void
  clearDismissed: () => void
}

const BackgroundAiContext = createContext<BackgroundAiContextValue | null>(null)

function loadStore(): Partial<Stored> {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<Stored>
  } catch {
    return {}
  }
}

function saveStore(s: Stored) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s))
  } catch {
    /* ignore quota */
  }
}

export function BackgroundAiProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { orders, menu, stock, foodMade, teamTodos } = useStallOps()
  const enabled = Boolean(user && canUseAiHelper(user))

  const initial = useRef(loadStore())
  const [tips, setTips] = useState<AiTip[]>(() => initial.current.tips || [])
  const [briefing, setBriefing] = useState(() => initial.current.briefing || '')
  const [actions, setActions] = useState<string[]>(() => initial.current.actions || [])
  const [source, setSource] = useState<'rules' | 'llm'>(() => initial.current.source || 'rules')
  const [dismissed, setDismissed] = useState<string[]>(() => initial.current.dismissed || [])
  const [lastRulesAt, setLastRulesAt] = useState(() => initial.current.lastRulesAt || 0)
  const [lastLlmAt, setLastLlmAt] = useState(() => initial.current.lastLlmAt || 0)
  const [running, setRunning] = useState(false)
  const runLock = useRef(false)

  const persist = useCallback(
    (next: Partial<Stored> & { tips?: AiTip[] }) => {
      const full: Stored = {
        tips: next.tips ?? tips,
        briefing: next.briefing ?? briefing,
        actions: next.actions ?? actions,
        source: next.source ?? source,
        lastRulesAt: next.lastRulesAt ?? lastRulesAt,
        lastLlmAt: next.lastLlmAt ?? lastLlmAt,
        dismissed: next.dismissed ?? dismissed,
      }
      saveStore(full)
    },
    [tips, briefing, actions, source, lastRulesAt, lastLlmAt, dismissed],
  )

  const refresh = useCallback(
    async (opts?: { forceLlm?: boolean }) => {
      if (!enabled || runLock.current) return
      runLock.current = true
      setRunning(true)
      try {
        const input = { orders, menu, stock, foodMade, teamTodos }
        const nextTips = buildBackgroundTips(input)
        const rulesBrief = tipsToBriefing(nextTips)
        const now = Date.now()
        setTips(nextTips)
        setLastRulesAt(now)
        if (!briefing || source === 'rules') {
          setBriefing(rulesBrief)
          setActions(
            nextTips
              .filter((t) => t.id !== 'all-clear')
              .slice(0, 4)
              .map((t) => t.title),
          )
          setSource('rules')
        }
        persist({
          tips: nextTips,
          briefing: !briefing || source === 'rules' ? rulesBrief : briefing,
          lastRulesAt: now,
          source: !briefing || source === 'rules' ? 'rules' : source,
        })

        const wantLlm =
          opts?.forceLlm || !lastLlmAt || now - lastLlmAt >= LLM_MS
        if (wantLlm && user && typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            const context = buildCoachLlmContext(input, nextTips)
            const res = await askAiCoach(user, context, rulesBrief)
            const parsed = parseCoachLlmReply(res.briefing)
            setBriefing(parsed.briefing)
            setActions(
              parsed.actions.length
                ? parsed.actions
                : nextTips
                    .filter((t) => t.id !== 'all-clear')
                    .slice(0, 4)
                    .map((t) => t.title),
            )
            setSource(res.source === 'llm' ? 'llm' : 'rules')
            setLastLlmAt(now)
            persist({
              tips: nextTips,
              briefing: parsed.briefing,
              actions: parsed.actions,
              source: res.source === 'llm' ? 'llm' : 'rules',
              lastRulesAt: now,
              lastLlmAt: now,
            })
          } catch {
            /* keep rules briefing */
          }
        }
      } finally {
        setRunning(false)
        runLock.current = false
      }
    },
    [
      enabled,
      orders,
      menu,
      stock,
      foodMade,
      teamTodos,
      user,
      briefing,
      source,
      lastLlmAt,
      persist,
    ],
  )

  useEffect(() => {
    if (!enabled) return
    // Stall mode = event POS — skip background AI (no dock; less work).
    if (isStallMode()) return
    const stale = !lastRulesAt || Date.now() - lastRulesAt > RULES_MS
    if (stale || tips.length === 0) {
      void refresh()
    }
    const id = window.setInterval(() => {
      if (isStallMode()) return
      void refresh()
    }, RULES_MS)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: interval owns refresh cadence
  }, [enabled, orders.length])

  const dismiss = useCallback(
    (id: string) => {
      setDismissed((d) => {
        const next = [...new Set([...d, id])].slice(-40)
        persist({ dismissed: next })
        return next
      })
    },
    [persist],
  )

  const clearDismissed = useCallback(() => {
    setDismissed([])
    persist({ dismissed: [] })
  }, [persist])

  const visibleTips = useMemo(
    () => tips.filter((t) => !dismissed.includes(t.id)),
    [tips, dismissed],
  )

  const urgentCount = useMemo(
    () =>
      visibleTips.filter((t) => t.severity === 'warn' || t.severity === 'critical').length,
    [visibleTips],
  )

  const value = useMemo(
    () => ({
      tips,
      visibleTips,
      briefing,
      actions,
      source,
      running,
      lastRunAt: lastRulesAt || null,
      urgentCount,
      refresh,
      dismiss,
      clearDismissed,
    }),
    [
      tips,
      visibleTips,
      briefing,
      actions,
      source,
      running,
      lastRulesAt,
      urgentCount,
      refresh,
      dismiss,
      clearDismissed,
    ],
  )

  return (
    <BackgroundAiContext.Provider value={value}>{children}</BackgroundAiContext.Provider>
  )
}

export function useBackgroundAi(): BackgroundAiContextValue {
  const ctx = useContext(BackgroundAiContext)
  if (!ctx) {
    return {
      tips: [],
      visibleTips: [],
      briefing: '',
      actions: [],
      source: 'rules',
      running: false,
      lastRunAt: null,
      urgentCount: 0,
      refresh: async () => {},
      dismiss: () => {},
      clearDismissed: () => {},
    }
  }
  return ctx
}
