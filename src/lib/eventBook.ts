import type { EventRow, Snapshot } from '../types'
import { normalizeEventStatus } from './eventStatus'

export interface EventBook {
  /** App-created events (not from Excel). */
  extras: EventRow[]
  /** Patches over Excel or extras by id. */
  patches: Record<string, Partial<EventRow>>
}

export function emptyEventBook(): EventBook {
  return { extras: [], patches: {} }
}

export function normalizeEventBook(raw: unknown): EventBook {
  if (!raw || typeof raw !== 'object') return emptyEventBook()
  const o = raw as Partial<EventBook>
  const extras = Array.isArray(o.extras)
    ? o.extras
        .map(normalizeEventRow)
        .filter((e): e is EventRow => Boolean(e?.id))
    : []
  const patches: Record<string, Partial<EventRow>> = {}
  if (o.patches && typeof o.patches === 'object') {
    for (const [id, patch] of Object.entries(o.patches)) {
      if (!id || !patch || typeof patch !== 'object') continue
      patches[id] = sanitizePatch(patch)
    }
  }
  return { extras, patches }
}

function sanitizePatch(patch: Partial<EventRow>): Partial<EventRow> {
  const out: Partial<EventRow> = {}
  if (patch.name != null) out.name = String(patch.name)
  if (patch.location != null) out.location = String(patch.location)
  if (patch.mapsQuery !== undefined) {
    out.mapsQuery = String(patch.mapsQuery || '').trim()
  }
  if (patch.startDate !== undefined) out.startDate = patch.startDate ? String(patch.startDate).slice(0, 10) : null
  if (patch.endDate !== undefined) out.endDate = patch.endDate ? String(patch.endDate).slice(0, 10) : null
  if (patch.month !== undefined) out.month = patch.month ? String(patch.month).slice(0, 7) : null
  if (patch.days != null) out.days = Math.max(0, Number(patch.days) || 0)
  if (patch.fee != null) out.fee = Number(patch.fee) || 0
  if (patch.status != null) out.status = normalizeEventStatus(String(patch.status))
  return out
}

function normalizeEventRow(raw: Partial<EventRow> | null | undefined): EventRow | null {
  if (!raw) return null
  const id = String(raw.id || '').trim()
  if (!id) return null
  const startDate = raw.startDate ? String(raw.startDate).slice(0, 10) : null
  const endDate = raw.endDate ? String(raw.endDate).slice(0, 10) : null
  const days =
    Number(raw.days) ||
    (startDate && endDate
      ? Math.max(
          1,
          Math.round(
            (new Date(endDate + 'T12:00:00').getTime() -
              new Date(startDate + 'T12:00:00').getTime()) /
              86400000,
          ) + 1,
        )
      : 1)
  const mapsQuery = String(raw.mapsQuery || '').trim()
  return {
    id,
    name: String(raw.name || 'Stall').trim() || 'Stall',
    location: String(raw.location || '').trim(),
    ...(mapsQuery ? { mapsQuery } : {}),
    startDate,
    endDate,
    month: raw.month
      ? String(raw.month).slice(0, 7)
      : startDate
        ? startDate.slice(0, 7)
        : null,
    days,
    fee: Number(raw.fee) || 0,
    status: normalizeEventStatus(raw.status || 'Applied'),
  }
}

/** Merge Excel snapshot events with app extras + patches. */
export function mergeEventRows(
  excelEvents: EventRow[],
  book: EventBook | null | undefined,
): EventRow[] {
  const b = book || emptyEventBook()
  const map = new Map<string, EventRow>()
  for (const e of excelEvents) {
    map.set(e.id, { ...e, status: normalizeEventStatus(e.status) })
  }
  for (const e of b.extras) {
    map.set(e.id, { ...e, status: normalizeEventStatus(e.status) })
  }
  for (const [id, patch] of Object.entries(b.patches)) {
    const prev = map.get(id)
    if (!prev) continue
    const next = { ...prev, ...sanitizePatch(patch) }
    if (next.mapsQuery !== undefined && !String(next.mapsQuery).trim()) {
      delete next.mapsQuery
    }
    if (next.startDate && !next.month) next.month = next.startDate.slice(0, 7)
    if (next.startDate && next.endDate) {
      const diff =
        Math.round(
          (new Date(next.endDate + 'T12:00:00').getTime() -
            new Date(next.startDate + 'T12:00:00').getTime()) /
            86400000,
        ) + 1
      if (diff > 0) next.days = diff
    }
    next.status = normalizeEventStatus(next.status)
    map.set(id, next)
  }
  return [...map.values()].sort((a, b) =>
    (b.startDate || '').localeCompare(a.startDate || ''),
  )
}

export function applyEventBook(snapshot: Snapshot, book: EventBook | null | undefined): Snapshot {
  return {
    ...snapshot,
    events: mergeEventRows(snapshot.events, book),
  }
}

export function newEventId(location: string, startDate: string | null): string {
  const loc = (location || 'STALL')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 8) || 'STALL'
  const d = (startDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '').slice(2)
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `${loc}-${d}-${rand}`
}

export interface CalendarNote {
  id: string
  /** yyyy-mm-dd */
  date: string
  title: string
  note?: string
  createdAt: string
  from?: string
}

export function normalizeCalendarNotes(raw: unknown): CalendarNote[] {
  if (!Array.isArray(raw)) return []
  const out: CalendarNote[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Partial<CalendarNote>
    const id = String(o.id || '').trim()
    const date = String(o.date || '').slice(0, 10)
    const title = String(o.title || '').trim()
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) continue
    out.push({
      id,
      date,
      title,
      ...(o.note ? { note: String(o.note) } : {}),
      createdAt: String(o.createdAt || new Date().toISOString()),
      ...(o.from ? { from: String(o.from) } : {}),
    })
  }
  return out.slice(0, 400)
}
