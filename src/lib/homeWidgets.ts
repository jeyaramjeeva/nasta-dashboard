import type { CalendarEventCard } from './calendar'
import type { EventMetrics } from '../types'
import { germanyWallTime } from './germanyTime'

export interface CountdownParts {
  totalMs: number
  days: number
  hours: number
  minutes: number
  seconds: number
  isLive: boolean
  isPast: boolean
}

/** Stall open = 09:00 Europe/Berlin on the event start date. */
export function parseEventStart(iso: string | null): Date | null {
  if (!iso) return null
  return germanyWallTime(iso, 9, 0)
}

export function countdownTo(target: Date, now = new Date()): CountdownParts {
  const totalMs = target.getTime() - now.getTime()
  if (totalMs <= 0) {
    // Live if within ~14h of start (same market day)
    const hoursSince = -totalMs / 3600000
    return {
      totalMs,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isLive: hoursSince < 14,
      isPast: hoursSince >= 14,
    }
  }
  const days = Math.floor(totalMs / 86400000)
  const hours = Math.floor((totalMs % 86400000) / 3600000)
  const minutes = Math.floor((totalMs % 3600000) / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)
  return { totalMs, days, hours, minutes, seconds, isLive: false, isPast: false }
}

export function nextStallCard(cards: CalendarEventCard[], now = new Date()): CalendarEventCard | null {
  const upcoming = cards
    .filter((c) => c.event.status !== 'Completed' && c.event.startDate)
    .map((c) => ({ c, start: parseEventStart(c.event.startDate)! }))
    .filter((x) => x.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  // Prefer not-yet-finished: start within last 14h still "next/live"
  for (const row of upcoming) {
    const cd = countdownTo(row.start, now)
    if (!cd.isPast) return row.c
  }
  return upcoming[0]?.c ?? null
}

export function prepPercent(card: CalendarEventCard): number {
  let score = 0
  if (card.hasFee) score += 34
  if (card.hasGrocery) score += 33
  if (card.hasBeforeCount) score += 33
  if (card.prep === 'ready' || card.prep === 'done') score = 100
  return Math.min(100, score)
}

/** Rough plates needed to cover break-even at a typical plate price. */
export function platesToBreakEven(event: EventMetrics, platePrice = 8): number {
  const be = event.breakEven || event.fee + event.grocery + event.transport
  if (be <= 0 || platePrice <= 0) return 0
  return Math.ceil(be / platePrice)
}

export function profitStreak(completed: EventMetrics[]): number {
  const ordered = completed
    .filter((e) => e.startDate)
    .slice()
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
  let streak = 0
  for (const e of ordered) {
    if (e.profit > 0) streak += 1
    else break
  }
  return streak
}

export function moneyMood(net: number, upcomingNet: number | null): {
  title: string
  line: string
  tone: 'ok' | 'warn' | 'hot'
} {
  if (upcomingNet != null && upcomingNet > 200 && net >= 0) {
    return {
      title: 'Kitchen confident',
      line: 'Books are green and the next stall looks tasty.',
      tone: 'hot',
    }
  }
  if (net >= 0) {
    return {
      title: 'Steady simmer',
      line: 'In the black overall — keep the float tight.',
      tone: 'ok',
    }
  }
  if (upcomingNet != null && upcomingNet > 0) {
    return {
      title: 'Comeback batch',
      line: 'Overall red, but the next stall can pull you forward.',
      tone: 'warn',
    }
  }
  return {
    title: 'Watch the pot',
    line: 'Costs are ahead — trim grocery or hunt a better fee.',
    tone: 'warn',
  }
}

export function bestLocationHint(
  byLocation: { location: string; incomePerDay: number; margin: number }[],
): string | null {
  const best = byLocation[0]
  if (!best) return null
  return `${best.location} still leads at €${best.incomePerDay.toFixed(0)}/day`
}
