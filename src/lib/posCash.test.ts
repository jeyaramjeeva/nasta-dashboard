import { describe, expect, it } from 'vitest'
import { summarizePosCashToday, type PosCashSummary } from './posCash'
import type { StallOrder } from './stallOps'

function cashOrder(id: string, eventId: string, paid: number, when: Date): StallOrder {
  return {
    id,
    label: id,
    status: 'completed',
    lines: [{ menuItemId: 'masala-dosa', name: 'Dosa', price: paid, qty: 1 }],
    createdAt: when.toISOString(),
    completedAt: when.toISOString(),
    paid,
    payMethod: 'cash',
    eventId,
  }
}

describe('summarizePosCashToday', () => {
  const noon = new Date('2026-08-18T12:00:00+02:00')

  it('sums all stalls when no event filter is passed', () => {
    const sum: PosCashSummary = summarizePosCashToday(
      [
        cashOrder('a', 'E010', 10, noon),
        cashOrder('b', 'E012', 20, noon),
      ],
      noon,
    )
    expect(sum.orderCount).toBe(2)
    expect(sum.netIn).toBe(30)
  })

  it('can isolate one stall so live event cash is not all-day POS', () => {
    const sum = summarizePosCashToday(
      [
        cashOrder('a', 'E010', 10, noon),
        cashOrder('b', 'E012', 20, noon),
      ],
      noon,
      'E010',
    )
    expect(sum.orderCount).toBe(1)
    expect(sum.netIn).toBe(10)
  })

  it('ignores empty paid input / voided / pending tickets', () => {
    const pending: StallOrder = {
      ...cashOrder('p', 'E010', 5, noon),
      status: 'pending',
    }
    const voided: StallOrder = {
      ...cashOrder('v', 'E010', 5, noon),
      voided: true,
    }
    const sum = summarizePosCashToday([pending, voided], noon, 'E010')
    expect(sum.orderCount).toBe(0)
    expect(sum.netIn).toBe(0)
  })
})
