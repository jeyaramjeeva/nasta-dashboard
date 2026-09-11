import { STALL_UNLOCKED_KEY } from './stallMode'

const UNTIL_KEY = 'nasta-dummy-stall-day-until'
const BOOT_KEY = 'nasta-dummy-stall-day-boot-20260820'
/** Auto-arm on first visit only during this morning’s test window. */
const AUTO_ARM_UNTIL = Date.parse('2026-08-20T12:00:00+02:00')
export const PREVIEW_STALL_DAY_MS = 5 * 60 * 1000

function readUntil(): number | null {
  try {
    const raw = localStorage.getItem(UNTIL_KEY)
    if (!raw) return null
    const until = Number(raw)
    if (!Number.isFinite(until) || until <= Date.now()) {
      localStorage.removeItem(UNTIL_KEY)
      return null
    }
    return until
  } catch {
    return null
  }
}

export function previewStallDayUntil(): number | null {
  return readUntil()
}

export function isPreviewStallDayActive(now = Date.now()): boolean {
  const until = readUntil()
  return until != null && until > now
}

export function previewStallDayLabel(now = Date.now()): string | null {
  const until = readUntil()
  if (until == null || until <= now) return null
  const ms = until - now
  const left =
    ms >= 60_000 ? `${Math.ceil(ms / 60_000)} min left` : `${Math.max(1, Math.ceil(ms / 1000))}s left`
  return `Dummy stall day (test) · ${left}`
}

export function armPreviewStallDay(ms = PREVIEW_STALL_DAY_MS): number {
  const until = Date.now() + ms
  try {
    localStorage.setItem(UNTIL_KEY, String(until))
    sessionStorage.removeItem(STALL_UNLOCKED_KEY)
  } catch {
    /* ignore */
  }
  return until
}

function stripDemoQuery() {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('demoStallDay') && !url.searchParams.has('dummyStallDay')) return
    url.searchParams.delete('demoStallDay')
    url.searchParams.delete('dummyStallDay')
    const search = url.searchParams.toString()
    window.history.replaceState(
      null,
      '',
      `${url.pathname}${search ? `?${search}` : ''}${url.hash}`,
    )
  } catch {
    /* ignore */
  }
}

/** First load after this deploy, or ?demoStallDay=1, starts a 5-minute dummy stall day. */
export function bootStallDayPreview(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    const fromQuery =
      params.get('demoStallDay') === '1' || params.get('dummyStallDay') === '1'
    if (fromQuery) {
      armPreviewStallDay()
      stripDemoQuery()
      return true
    }
    if (Date.now() >= AUTO_ARM_UNTIL) return isPreviewStallDayActive()
    if (localStorage.getItem(BOOT_KEY) === '1') return isPreviewStallDayActive()
    localStorage.setItem(BOOT_KEY, '1')
    armPreviewStallDay()
    return true
  } catch {
    return false
  }
}
