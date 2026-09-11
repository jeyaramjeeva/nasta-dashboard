import { eventCalendarDays } from './calendar'
import { impactsMetrics } from './eventStatus'
import { germanyTodayYmd } from './germanyTime'
import { isPreviewStallDayActive, previewStallDayLabel } from './stallDayPreview'
import type { Snapshot } from '../types'

const LOCAL_KEY = 'nasta-snapshot-v3'

type StallDayEvent = {
  id?: string
  name?: string
  location?: string
  status?: string
  startDate: string | null
  endDate: string | null
  days?: number
}

function firstStallDayEvent(
  events: StallDayEvent[] | undefined,
  today: string,
): StallDayEvent | null {
  if (!events?.length) return null
  for (const ev of events) {
    if (!impactsMetrics(ev.status)) continue
    if (!eventCalendarDays(ev).includes(today)) continue
    return ev
  }
  return null
}

/** Confirmed (or completed) calendar stall that includes Germany-today. */
export function snapshotHasStallDayToday(
  snap: { events?: StallDayEvent[] } | null | undefined,
  today = germanyTodayYmd(),
): boolean {
  if (isPreviewStallDayActive()) return true
  return firstStallDayEvent(snap?.events, today) != null
}

function labelFromSnapshot(snap: Snapshot | null | undefined): string | null {
  const ev = firstStallDayEvent(snap?.events, germanyTodayYmd())
  if (!ev) return null
  const place = [ev.name, ev.location].filter(Boolean).join(' · ')
  return `Open today · ${ev.id}${place ? ` — ${place}` : ''}`
}

function loadLocalSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Snapshot
  } catch {
    return null
  }
}

/** Cached Excel snapshot — used on login before cloud data loads. */
export function isStallDayToday(today = germanyTodayYmd()): boolean {
  return snapshotHasStallDayToday(loadLocalSnapshot(), today)
}

/** One-line “Open today” from cached Excel only — no cloud fetch on the login screen. */
export async function resolveOpenTodayStrip(): Promise<string | null> {
  return previewStallDayLabel() || labelFromSnapshot(loadLocalSnapshot())
}
