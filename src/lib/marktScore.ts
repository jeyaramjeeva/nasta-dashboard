/** “Should we apply?” score for a new Markt invitation. */

import { impactsMetrics } from './eventStatus'
import type { EventMetrics, EventRow } from '../types'

export interface MarktInviteInput {
  location: string
  /** yyyy-mm-dd */
  startDate: string
  days?: number
  fee?: number
  eventType?: string
  /** Optional organizer note / indoor / outdoor */
  outdoor?: boolean
  rainyForecast?: boolean
}

export interface MarktScoreFactor {
  label: string
  impact: number
  note: string
}

export interface MarktScoreResult {
  score: number
  grade: 'Go' | 'Maybe' | 'Skip'
  summary: string
  factors: MarktScoreFactor[]
}

function cityKey(location: string): string {
  return location
    .split(',')[0]
    ?.trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') || ''
}

function berlinDow(ymd: string): number {
  try {
    const wd = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      weekday: 'short',
    }).format(new Date(ymd + 'T12:00:00'))
    const map: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    }
    return map[wd] ?? 3
  } catch {
    return 3
  }
}

export function scoreMarktInvite(
  input: MarktInviteInput,
  history: EventMetrics[] | EventRow[],
): MarktScoreResult {
  const factors: MarktScoreFactor[] = []
  let score = 50
  const city = cityKey(input.location)
  const fee = Math.max(0, Number(input.fee) || 0)
  const days = Math.max(1, Number(input.days) || 1)
  const type = (input.eventType || '').trim()

  const past = history.filter((e) => {
    if (!impactsMetrics(e.status) && e.status !== 'Completed') return false
    return cityKey(e.location) === city
  }) as EventMetrics[]

  if (city) {
    if (past.length >= 2) {
      const avgIncome =
        past.reduce((s, e) => s + (Number((e as EventMetrics).income) || 0), 0) /
        past.length
      const avgProfit =
        past.reduce((s, e) => s + (Number((e as EventMetrics).profit) || 0), 0) /
        past.length
      if (avgProfit > 80) {
        score += 18
        factors.push({
          label: 'Location track record',
          impact: 18,
          note: `${past.length} past stalls here · avg profit ~€${avgProfit.toFixed(0)}`,
        })
      } else if (avgIncome > 200) {
        score += 10
        factors.push({
          label: 'Location track record',
          impact: 10,
          note: `Solid volume here (~€${avgIncome.toFixed(0)} income avg)`,
        })
      } else if (avgProfit < 0) {
        score -= 15
        factors.push({
          label: 'Location track record',
          impact: -15,
          note: 'Past stalls here lost money on average',
        })
      } else {
        factors.push({
          label: 'Location track record',
          impact: 4,
          note: `${past.length} visits — mixed results`,
        })
        score += 4
      }
    } else if (past.length === 1) {
      score += 5
      factors.push({
        label: 'Location track record',
        impact: 5,
        note: 'One prior stall — thin sample',
      })
    } else {
      score -= 4
      factors.push({
        label: 'New location',
        impact: -4,
        note: 'No history — scout on arrival',
      })
    }
  }

  const dow = input.startDate ? berlinDow(input.startDate) : 6
  if (dow === 6 || dow === 0) {
    score += 12
    factors.push({
      label: 'Weekend start',
      impact: 12,
      note: 'Sat/Sun usually busier for street food',
    })
  } else if (dow === 5) {
    score += 6
    factors.push({ label: 'Friday start', impact: 6, note: 'Decent evening traffic' })
  } else {
    score -= 6
    factors.push({
      label: 'Weekday start',
      impact: -6,
      note: 'Mid-week markets are quieter unless office lunch',
    })
  }

  if (fee > 0) {
    const feePerDay = fee / days
    if (feePerDay > 180) {
      score -= 14
      factors.push({
        label: 'Stall fee',
        impact: -14,
        note: `€${feePerDay.toFixed(0)}/day is steep — need strong volume`,
      })
    } else if (feePerDay > 100) {
      score -= 6
      factors.push({
        label: 'Stall fee',
        impact: -6,
        note: `€${feePerDay.toFixed(0)}/day — plan combos hard`,
      })
    } else {
      score += 8
      factors.push({
        label: 'Stall fee',
        impact: 8,
        note: `€${feePerDay.toFixed(0)}/day looks manageable`,
      })
    }
  } else {
    factors.push({ label: 'Stall fee', impact: 0, note: 'Fee not entered' })
  }

  if (type.toLowerCase().includes('gourmet')) {
    score += 5
    factors.push({
      label: 'Event type',
      impact: 5,
      note: 'Gourmet often supports higher ticket',
    })
  } else if (type.toLowerCase().includes('floh')) {
    score += 3
    factors.push({
      label: 'Event type',
      impact: 3,
      note: 'Flohmarkt — volume + value combos',
    })
  }

  if (input.rainyForecast && input.outdoor !== false) {
    score -= 12
    factors.push({
      label: 'Weather risk',
      impact: -12,
      note: 'Rain forecast outdoors — push chai / covered seating',
    })
  } else if (input.outdoor === false) {
    score += 4
    factors.push({
      label: 'Indoor / covered',
      impact: 4,
      note: 'Weather less of a threat',
    })
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  const grade: MarktScoreResult['grade'] =
    score >= 68 ? 'Go' : score >= 45 ? 'Maybe' : 'Skip'
  const summary =
    grade === 'Go'
      ? 'Looks worth applying — history and timing lean positive.'
      : grade === 'Maybe'
        ? 'Borderline — confirm fee, weather, and organizer footfall before yes.'
        : 'Lean skip unless strategic (new city / brand) — numbers don’t smile yet.'

  return { score, grade, summary, factors: factors.sort((a, b) => b.impact - a.impact) }
}
