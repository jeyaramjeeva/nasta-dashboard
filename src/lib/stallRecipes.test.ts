import { describe, expect, it } from 'vitest'
import type { StallOrder, StockAutoUseRule, StockItem } from './stallOps'
import { autoUseQtyForOrder, reverseAutoUseForOrder } from './stallRecipes'

const rules: StockAutoUseRule[] = [
  { menuItemId: 'masala-dosa', stockItemId: 'dosa-batter', qtyPerSale: 2 },
]

function stock(used: number): StockItem {
  return {
    id: 'dosa-batter',
    name: 'Dosa batter',
    unit: 'batch',
    lowAt: 1,
    bought: 10,
    used,
  }
}

function order(id: string, qty: number): StallOrder {
  return {
    id,
    label: id,
    status: 'completed',
    lines: [{ menuItemId: 'masala-dosa', name: 'Masala dosa', price: 8, qty }],
    createdAt: '2026-08-18T10:00:00.000Z',
  }
}

describe('reverseAutoUseForOrder', () => {
  it('puts used qty back and drops the order id', () => {
    const ticket = order('ord-1', 3)
    expect(autoUseQtyForOrder(ticket, rules)).toEqual({ 'dosa-batter': 6 })
    const next = reverseAutoUseForOrder(
      [stock(8)],
      ['ord-1', 'ord-2'],
      ticket,
      rules,
    )
    expect(next.stock[0]?.used).toBe(2)
    expect(next.stockAutoUseApplied).toEqual(['ord-2'])
  })

  it('is a no-op when auto-use was never applied', () => {
    const next = reverseAutoUseForOrder([stock(8)], ['ord-2'], order('ord-1', 3), rules)
    expect(next.stock[0]?.used).toBe(8)
    expect(next.stockAutoUseApplied).toEqual(['ord-2'])
  })
})
