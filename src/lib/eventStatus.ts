import { germanyTodayYmd } from './germanyTime'

/** Stall event lifecycle status. Only Confirmed (and legacy Completed) hit the books. */

export const EVENT_STATUSES = ['Applied', 'Confirmed', 'Rejected'] as const
export type StallEventStatus = (typeof EVENT_STATUSES)[number]

export type StallDateFields = {
  status?: string | null
  startDate?: string | null
  endDate?: string | null
  days?: number
}

function isYmd(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

/** Last stall calendar day (end date, or start + days − 1). */
export function eventLastYmd(event: StallDateFields): string | null {
  if (isYmd(event.endDate)) return event.endDate
  if (!isYmd(event.startDate)) return null
  const days = Math.max(1, event.days || 1)
  if (days <= 1) return event.startDate
  const [y, m, d] = event.startDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days - 1)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** True when the stall’s last day is before today in Germany. */
export function isStallDateOver(event: StallDateFields, today = germanyTodayYmd()): boolean {
  const last = eventLastYmd(event)
  return last != null && last < today
}

/** Canonical display status for UI. */
export function normalizeEventStatus(status: string | undefined | null): string {
  const s = (status || '').trim().toLowerCase()
  if (!s) return 'Applied'
  if (s === 'confirmed' || s === 'confirm') return 'Confirmed'
  if (s === 'rejected' || s === 'reject' || s === 'cancelled' || s === 'canceled') {
    return 'Rejected'
  }
  if (s === 'applied' || s === 'apply' || s === 'pending' || s === 'application') {
    return 'Applied'
  }
  // Legacy Excel values
  if (s === 'completed' || s === 'complete' || s === 'done') return 'Completed'
  if (s === 'upcoming' || s === 'planned' || s === 'open') return 'Upcoming'
  return status!.trim()
}

/** Money / KPIs / forecasts only for these. */
export function impactsMetrics(status: string | undefined | null): boolean {
  const n = normalizeEventStatus(status)
  return n === 'Confirmed' || n === 'Completed'
}

/** Use logged income/expense instead of a forecast. Same set as KPI “completed”. */
export function usesActuals(status: string | undefined | null): boolean {
  return impactsMetrics(status)
}

/** Applied / planned — not yet on the books. */
export function isUpcomingStatus(status: string | undefined | null): boolean {
  const n = normalizeEventStatus(status)
  return n === 'Applied' || n === 'Upcoming'
}

/** Status says closed, or the stall date is already over. */
export function isFinishedStall(event: StallDateFields, today = germanyTodayYmd()): boolean {
  const n = normalizeEventStatus(event.status)
  if (n === 'Rejected' || n === 'Completed') return true
  return isStallDateOver(event, today)
}

/** Still running or in the future — can be “next stall”. */
export function isOpenUpcomingStall(event: StallDateFields, today = germanyTodayYmd()): boolean {
  const n = normalizeEventStatus(event.status)
  if (n === 'Rejected' || n === 'Completed') return false
  if (!event.startDate) return false
  return !isStallDateOver(event, today)
}

/** Can still be the next or live stall (booked or applied, not closed or rejected). */
export function isNextStallCandidate(status: string | undefined | null): boolean {
  const n = normalizeEventStatus(status)
  return n !== 'Completed' && n !== 'Rejected'
}

export function usesActualsForEvent(event: StallDateFields, today = germanyTodayYmd()): boolean {
  return usesActuals(event.status) || isStallDateOver(event, today)
}

/** Past stalls always show Completed, even if Excel still says Upcoming. */
export function displayStallStatus(event: StallDateFields, today = germanyTodayYmd()): string {
  const n = normalizeEventStatus(event.status)
  if (n === 'Rejected') return 'Rejected'
  if (isFinishedStall(event, today)) return 'Completed'
  return n
}

export function isRejectedStatus(status: string | undefined | null): boolean {
  return normalizeEventStatus(status) === 'Rejected'
}

export function statusPillClass(status: string | undefined | null): string {
  const n = normalizeEventStatus(status)
  if (n === 'Completed') return 'completed'
  if (n === 'Confirmed') return 'confirmed'
  if (n === 'Rejected') return 'rejected'
  if (n === 'Applied') return 'applied'
  return 'upcoming'
}

export function statusLabel(status: string | undefined | null): string {
  return normalizeEventStatus(status)
}
