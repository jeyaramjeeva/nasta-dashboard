import { describe, expect, it } from 'vitest'
import {
  claimOrderByCode,
  mergeStallOrderBags,
  mergeStockItems,
  nextCustomerNumber,
  orderTotal,
  type StallOrder,
} from './stallOps'

function ticket(
  id: string,
  eventId: string,
  label: string,
  opts?: Partial<StallOrder>,
): StallOrder {
  const now = opts?.createdAt || '2026-08-22T10:00:00.000Z'
  return {
    id,
    label,
    status: opts?.status || 'pending',
    lines: opts?.lines || [{ menuItemId: 'masala-dosa', name: 'Ghee Masala dosa', price: 6, qty: 1 }],
    createdAt: now,
    updatedAt: opts?.updatedAt || now,
    eventId,
    source: 'pos',
    ...opts,
  }
}

describe('same-day two-stall isolation', () => {
  it('gives each stall its own Customer 1 on the same Germany day', () => {
    const noon = new Date('2026-08-22T12:00:00+02:00')
    const existing = [
      ticket('a', 'E013', 'Customer 1', { createdAt: '2026-08-22T08:00:00.000Z' }),
      ticket('b', 'E013', 'Customer 2', { createdAt: '2026-08-22T08:05:00.000Z' }),
      ticket('c', 'E014', 'Customer 1', { createdAt: '2026-08-22T08:01:00.000Z' }),
    ]
    expect(nextCustomerNumber(existing, noon, 'E013')).toBe(3)
    expect(nextCustomerNumber(existing, noon, 'E014')).toBe(2)
  })

  it('does not reuse the other stall’s numbers when merging simultaneous creates', () => {
    const remote = {
      orders: [ticket('ord-a', 'E013', 'Customer 1')],
      deletedOrderIds: [] as string[],
    }
    const local = {
      orders: [ticket('ord-b', 'E014', 'Customer 1')],
      deletedOrderIds: [] as string[],
    }
    const merged = mergeStallOrderBags(remote, local)
    const ids = merged.orders.map((o) => o.id).sort()
    expect(ids).toEqual(['ord-a', 'ord-b'])
    expect(merged.orders.filter((o) => o.eventId === 'E013')).toHaveLength(1)
    expect(merged.orders.filter((o) => o.eventId === 'E014')).toHaveLength(1)
  })

  it('keeps historical line prices when the other stall’s catalog is different', () => {
    const gourmet = ticket('g', 'E013', 'Customer 1', {
      status: 'completed',
      lines: [
        { menuItemId: 'masala-dosa', name: 'Ghee Masala dosa', price: 8, qty: 1 },
        { menuItemId: 'mango-lassi', name: 'Mango lassi', price: 3.5, qty: 1 },
      ],
    })
    const flea = ticket('f', 'E014', 'Customer 1', {
      status: 'completed',
      lines: [
        { menuItemId: 'masala-dosa', name: 'Ghee Masala dosa', price: 6, qty: 2 },
        { menuItemId: 'masala-chai', name: 'Masala chai', price: 2, qty: 1 },
      ],
    })
    expect(orderTotal(gourmet.lines)).toBe(11.5)
    expect(orderTotal(flea.lines)).toBe(14)
    const merged = mergeStallOrderBags({ orders: [gourmet] }, { orders: [flea] })
    expect(merged.orders.find((o) => o.id === 'g')?.lines[0]?.price).toBe(8)
    expect(merged.orders.find((o) => o.id === 'f')?.lines[0]?.price).toBe(6)
  })

  it('demonstrates a lost update if a stale save never saw the other device’s new ticket', () => {
    const base = { orders: [] as StallOrder[], deletedOrderIds: [] as string[] }
    const afterA = mergeStallOrderBags(base, {
      orders: [ticket('ord-a', 'E013', 'Customer 1')],
      deletedOrderIds: [],
    })
    // Device B fetched `base` before A’s write landed, then saved only B.
    const staleSave = mergeStallOrderBags(base, {
      orders: [ticket('ord-b', 'E014', 'Customer 1')],
      deletedOrderIds: [],
    })
    expect(staleSave.orders.map((o) => o.id)).toEqual(['ord-b'])
    expect(staleSave.orders.some((o) => o.id === 'ord-a')).toBe(false)
    // A later honest merge of both local bags recovers both tickets.
    const recovered = mergeStallOrderBags(
      { orders: afterA.orders, deletedOrderIds: [] },
      { orders: staleSave.orders, deletedOrderIds: [] },
    )
    expect(recovered.orders.map((o) => o.id).sort()).toEqual(['ord-a', 'ord-b'])
  })

  it('lets tombstones win so a delete on one stall cannot be resurrected by the other device', () => {
    const remote = {
      orders: [ticket('ord-a', 'E013', 'Customer 1'), ticket('ord-b', 'E014', 'Customer 1')],
      deletedOrderIds: [] as string[],
    }
    const local = {
      orders: [ticket('ord-b', 'E014', 'Customer 1')],
      deletedOrderIds: ['ord-a'],
    }
    const merged = mergeStallOrderBags(remote, local)
    expect(merged.orders.map((o) => o.id)).toEqual(['ord-b'])
    expect(merged.deletedOrderIds).toContain('ord-a')
  })

  it('relabels a later same-stall Customer 5 after two devices mint the same number', () => {
    const merged = mergeStallOrderBags(
      {
        orders: [ticket('ord-a', 'E014', 'Customer 5', { createdAt: '2026-08-22T08:00:00.000Z' })],
        deletedOrderIds: [],
      },
      {
        orders: [ticket('ord-b', 'E014', 'Customer 5', { createdAt: '2026-08-22T08:01:00.000Z' })],
        deletedOrderIds: [],
      },
    )
    const labels = merged.orders
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((o) => o.label)
    expect(labels).toEqual(['Customer 5', 'Customer 6'])
  })

  it('keeps restocks and deductions from both tablets (stock used/bought only go up)', () => {
    const merged = mergeStockItems(
      [{ id: 'batter', name: 'Batter', unit: 'kg', lowAt: 1, bought: 4, used: 1 }],
      [{ id: 'batter', name: 'Batter', unit: 'kg', lowAt: 1, bought: 5, used: 2 }],
    )
    expect(merged[0]?.bought).toBe(5)
    expect(merged[0]?.used).toBe(2)
  })

  it('does not claim the other same-day stall’s unique code when Event menu is set', () => {
    const orders = [
      ticket('ord-a', 'E013', 'Hold 4242', {
        status: 'awaiting_claim',
        claimCode: '4242',
      }),
    ]
    const scoped = claimOrderByCode(orders, '4242', 'E014')
    expect(scoped.claimed).toBeNull()
    expect(scoped.error).toMatch(/E013/)
    const unscoped = claimOrderByCode(orders, '4242')
    expect(unscoped.claimed?.id).toBe('ord-a')
  })
})
