import { useEffect, useState } from 'react'
import { DATA_SAVER_EVENT, isTabVisible, stallOpsPollMs } from '../lib/dataSaver'

type PollKind = 'orders' | 'chat-open' | 'chat-closed'

/** Poll stall_ops only while the tab is visible; slower when Data saver is on. */
export function useStallOpsPoll(
  refresh: () => void | Promise<void>,
  kind: PollKind,
  enabled = true,
): void {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    window.addEventListener(DATA_SAVER_EVENT, bump)
    return () => window.removeEventListener(DATA_SAVER_EVENT, bump)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const ms = stallOpsPollMs(kind)
    void refresh()
    const id = window.setInterval(() => {
      if (!isTabVisible()) return
      void refresh()
    }, ms)
    const onVis = () => {
      if (isTabVisible()) void refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refresh, kind, enabled, tick])
}
