import { forecastEvent } from './insights'
import { inventoryCostForEvent, type WeatherTag } from './extrasStore'
import type { DashboardMetrics, EventMetrics, Snapshot } from '../types'

export type PrepStatus = 'ready' | 'partial' | 'missing' | 'done'

export interface CalendarEventCard {
  event: EventMetrics
  prep: PrepStatus
  prepNotes: string[]
  /** Income (completed) or expected income (upcoming). */
  gain: number
  /** Expenses + inventory (completed) or logged + inventory / forecast costs (upcoming). */
  spend: number
  /** gain - spend */
  net: number | null
  expectedNet: number | null
  hasBeforeCount: boolean
  hasFee: boolean
  hasGrocery: boolean
  inventoryCost: number
  weather: WeatherTag
  /** Total stall days (3, 4, …). */
  totalDays: number
  /** Inclusive date list yyyy-mm-dd for the stall run. */
  dateSpan: string[]
}

export interface CalendarDayMark {
  card: CalendarEventCard
  dayIndex: number
  totalDays: number
  role: 'start' | 'mid' | 'end' | 'single'
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toIso(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Build every calendar day an event occupies (start → end, or start + days). */
export function eventDateSpan(event: EventMetrics): string[] {
  if (!event.startDate) return []
  const start = parseIso(event.startDate)
  let total = Math.max(1, event.days || 1)
  if (event.endDate) {
    const end = parseIso(event.endDate)
    const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    if (diff > 0) total = diff
  }
  const out: string[] = []
  for (let i = 0; i < total; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    out.push(toIso(d))
  }
  return out
}

function prepFor(
  e: EventMetrics,
  snapshot: Snapshot,
): { prep: PrepStatus; notes: string[]; hasBefore: boolean } {
  const count = (snapshot.eventCashCounts || []).find((c) => c.eventId === e.id)
  const hasBefore = !!(
    count &&
    (count.beforeCash > 0 || count.before.length || count.startOfDay.length)
  )
  const hasFee = e.fee > 0
  const hasGrocery = e.grocery > 0
  const notes: string[] = []
  if (!hasFee) notes.push('No stall fee logged')
  if (!hasGrocery) notes.push('No grocery prep')
  if (!hasBefore && e.status !== 'Completed') notes.push('No start-of-day cash count')

  if (e.status === 'Completed') {
    return { prep: 'done', notes: notes.length ? notes : ['Closed'], hasBefore }
  }
  if (!notes.length) return { prep: 'ready', notes: ['Fee + grocery + float ready'], hasBefore }
  if (hasFee || hasGrocery || hasBefore) return { prep: 'partial', notes, hasBefore }
  return { prep: 'missing', notes, hasBefore }
}

export function buildCalendarCards(
  snapshot: Snapshot,
  metrics: DashboardMetrics,
  weather: Record<string, WeatherTag>,
): CalendarEventCard[] {
  return metrics.byEvent
    .slice()
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
    .map((event) => {
      const { prep, notes, hasBefore } = prepFor(event, snapshot)
      const inv = inventoryCostForEvent(event.id)
      const dateSpan = eventDateSpan(event)
      const totalDays = dateSpan.length || Math.max(1, event.days || 1)

      let gain = 0
      let spend = 0
      let expectedNet: number | null = null
      let net: number | null = null

      if (event.status === 'Completed') {
        gain = event.income
        spend = round2(event.expense + inv)
        net = round2(gain - spend)
        expectedNet = event.operatingProfit
      } else {
        const fc = forecastEvent(metrics.byEventType, event.name, totalDays)
        const fee = event.fee > 0 ? event.fee : fc.feeEstimate
        const grocery = event.grocery > 0 ? event.grocery : fc.groceryBudget
        const transport = event.transport > 0 ? event.transport : fc.transportEstimate
        gain = event.income > 0 ? event.income : fc.expectedIncome
        const logged = event.expense
        if (logged > 0) {
          const missingFee = event.fee > 0 ? 0 : fee
          const missingGrocery = event.grocery > 0 ? 0 : grocery
          const missingTransport = event.transport > 0 ? 0 : transport
          spend = round2(logged + inv + missingFee + missingGrocery + missingTransport)
        } else {
          spend = round2(fee + grocery + transport + inv)
        }
        expectedNet = round2(gain - spend)
        net = expectedNet
      }

      return {
        event,
        prep,
        prepNotes: notes,
        gain: round2(gain),
        spend: round2(spend),
        net,
        expectedNet,
        hasBeforeCount: hasBefore,
        hasFee: event.fee > 0,
        hasGrocery: event.grocery > 0,
        inventoryCost: inv,
        weather: weather[event.id] || '',
        totalDays,
        dateSpan,
      }
    })
}

/** Marks for a given calendar month — every stall day, not only start. */
export function marksForMonth(
  cards: CalendarEventCard[],
  year: number,
  month: number,
): Map<number, CalendarDayMark[]> {
  const map = new Map<number, CalendarDayMark[]>()
  for (const card of cards) {
    const span = card.dateSpan
    const total = span.length
    span.forEach((iso, idx) => {
      const [y, m, day] = iso.split('-').map(Number)
      if (y !== year || m !== month) return
      const role: CalendarDayMark['role'] =
        total === 1 ? 'single' : idx === 0 ? 'start' : idx === total - 1 ? 'end' : 'mid'
      const list = map.get(day) || []
      list.push({ card, dayIndex: idx + 1, totalDays: total, role })
      map.set(day, list)
    })
  }
  return map
}

export function monthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const startPad = first.getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function formatDaySpan(totalDays: number, start?: string | null, end?: string | null) {
  if (totalDays <= 1) return '1 day'
  const range =
    start && end && start !== end ? `${start} → ${end}` : start ? `${start} (+${totalDays - 1}d)` : ''
  return `${totalDays}-day stall${range ? ` · ${range}` : ''}`
}
