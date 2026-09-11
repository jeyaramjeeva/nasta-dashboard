import { describe, expect, it } from 'vitest'
import { buildStallEvidence } from './stallMarketEvidence'
import type { EventMetrics } from '../types'

function ev(partial: Partial<EventMetrics> & Pick<EventMetrics, 'id' | 'location' | 'income'>): EventMetrics {
  return {
    name: 'Flohmarkt',
    startDate: '2026-04-01',
    endDate: '2026-04-01',
    days: 1,
    status: 'Completed',
    expense: 0,
    profit: partial.income,
    incomePerDay: partial.income,
    fee: 180,
    grocery: 80,
    transport: 20,
    otherExpense: 0,
    breakEven: 280,
    operatingProfit: partial.income - 280,
    margin: 0,
    ...partial,
  }
}

describe('buildStallEvidence', () => {
  it('uses sales and location, ignores stall fee', () => {
    const out = buildStallEvidence([
      ev({ id: 'E001', location: 'Wilhelmplatz, Köln', income: 420, grocery: 90, fee: 150, days: 1 }),
      ev({ id: 'E004', location: 'Beuel, Bonn', income: 900, grocery: 200, fee: 400, days: 3 }),
      ev({ id: 'setup', location: 'Warehouse', income: 0, status: 'Confirmed' }),
    ])
    expect(out.eventCount).toBe(2)
    expect(out.totalSales).toBe(1320)
    expect(out.soldEvents.every((e) => !('fee' in e && typeof (e as { fee?: number }).fee === 'number' && e.id === 'fee'))).toBe(true)
    expect(out.koeln?.sales).toBe(420)
    expect(out.bonn?.salesPerDay).toBe(300)
    expect(out.bestLocation?.location).toBe('Wilhelmplatz, Köln')
    expect(out.grocery).toBe(290)
  })
})
