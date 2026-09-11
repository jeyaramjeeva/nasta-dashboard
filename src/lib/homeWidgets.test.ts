import { describe, expect, it } from 'vitest'
import type { CalendarEventCard } from './calendar'
import type { EventMetrics } from '../types'
import { nextStallCard } from './homeWidgets'

function event(partial: Partial<EventMetrics> & Pick<EventMetrics, 'id' | 'status' | 'startDate'>): EventMetrics {
  return {
    name: 'Flohmarkt',
    location: 'Köln',
    endDate: partial.startDate,
    days: 1,
    income: 0,
    expense: 0,
    profit: 0,
    incomePerDay: 0,
    fee: 0,
    grocery: 0,
    transport: 0,
    otherExpense: 0,
    breakEven: 0,
    operatingProfit: 0,
    margin: 0,
    ...partial,
  }
}

function card(partial: Partial<EventMetrics> & Pick<EventMetrics, 'id' | 'status' | 'startDate'>): CalendarEventCard {
  return {
    event: event(partial),
    prep: 'partial',
    prepNotes: [],
    gain: 0,
    spend: 0,
    net: 0,
    expectedNet: 0,
    hasBeforeCount: false,
    hasFee: false,
    hasGrocery: false,
    inventoryCost: 0,
    weather: '',
    totalDays: 1,
    dateSpan: partial.startDate ? [partial.startDate] : [],
  }
}

describe('nextStallCard', () => {
  const now = new Date('2026-09-01T12:00:00+02:00')

  it('picks a future Confirmed stall instead of hiding it as Completed-only', () => {
    const next = nextStallCard(
      [
        card({ id: 'E015', status: 'Completed', startDate: '2026-08-28' }),
        card({ id: 'E016', status: 'Confirmed', startDate: '2026-09-12' }),
        card({ id: 'E017', status: 'Applied', startDate: '2026-10-03' }),
      ],
      now,
    )
    expect(next?.event.id).toBe('E016')
  })

  it('does not fall back to a past Confirmed stall', () => {
    const next = nextStallCard(
      [card({ id: 'E014', status: 'Confirmed', startDate: '2026-08-22' })],
      now,
    )
    expect(next).toBeNull()
  })

  it('does not treat a finished Upcoming stall as next (E012)', () => {
    const next = nextStallCard(
      [
        card({ id: 'E012', status: 'Upcoming', startDate: '2026-08-16' }),
        card({ id: 'E013', status: 'Upcoming', startDate: '2026-08-21' }),
      ],
      now,
    )
    expect(next).toBeNull()
  })

  it('skips Rejected and Completed', () => {
    const next = nextStallCard(
      [
        card({ id: 'E018', status: 'Rejected', startDate: '2026-09-05' }),
        card({ id: 'E019', status: 'Completed', startDate: '2026-09-06' }),
        card({ id: 'E020', status: 'Upcoming', startDate: '2026-09-20' }),
      ],
      now,
    )
    expect(next?.event.id).toBe('E020')
  })
})
