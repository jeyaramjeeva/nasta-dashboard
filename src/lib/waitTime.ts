/** Kitchen wait time helpers for pending tickets. */

export type WaitTone = 'fresh' | 'ok' | 'warn' | 'hot'

export function waitMinutesSince(iso: string, now = Date.now()): number {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((now - t) / 60000))
}

/** 0–4 fresh · 5–14 ok · 15–24 warn · 25+ hot */
export function waitTone(minutes: number): WaitTone {
  if (minutes < 5) return 'fresh'
  if (minutes < 15) return 'ok'
  if (minutes < 25) return 'warn'
  return 'hot'
}

export function formatWaitLabel(minutes: number): string {
  if (minutes < 1) return '<1m waiting'
  if (minutes < 60) return `${minutes}m waiting`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m waiting` : `${h}h waiting`
}
