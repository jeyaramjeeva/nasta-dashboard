import { germanyYmd } from './germanyTime'
import { netCashIn } from './posCash'
import { orderTotal, type StallOrder } from './stallOps'

export interface ItemSalesRow {
  menuItemId: string
  name: string
  qty: number
  revenue: number
  avgPrice: number
}

export interface DaySalesRow {
  day: string
  orders: number
  items: number
  revenue: number
  cashIn: number
}

export interface EventSalesRow {
  eventId: string
  orders: number
  items: number
  revenue: number
  cashIn: number
  topItem: string | null
}

export interface SalesReport {
  orderCount: number
  itemCount: number
  revenue: number
  cashIn: number
  byItem: ItemSalesRow[]
  byDay: DaySalesRow[]
  byEvent: EventSalesRow[]
  topItem: ItemSalesRow | null
}

function completedOrders(orders: StallOrder[], filter?: { eventId?: string; day?: string }) {
  return orders.filter((o) => {
    if (o.status !== 'completed' || o.voided) return false
    if (filter?.eventId && (o.eventId || 'unassigned') !== filter.eventId) return false
    if (filter?.day) {
      const day = germanyYmd(new Date(o.completedAt || o.createdAt))
      if (day !== filter.day) return false
    }
    return true
  })
}

export function buildSalesReport(
  orders: StallOrder[],
  filter?: { eventId?: string; day?: string },
): SalesReport {
  const list = completedOrders(orders, filter)
  const itemMap = new Map<string, ItemSalesRow>()
  const dayMap = new Map<string, DaySalesRow>()
  const eventMap = new Map<string, { row: EventSalesRow; itemQty: Map<string, { name: string; qty: number }> }>()

  let revenue = 0
  let cashIn = 0
  let itemCount = 0

  for (const o of list) {
    const total = orderTotal(o.lines)
    const net = netCashIn(o)
    const day = germanyYmd(new Date(o.completedAt || o.createdAt))
    const eventId = o.eventId || 'unassigned'
    const linesQty = o.lines.reduce((s, l) => s + l.qty, 0)

    revenue += total
    cashIn += net
    itemCount += linesQty

    const dayRow = dayMap.get(day) || {
      day,
      orders: 0,
      items: 0,
      revenue: 0,
      cashIn: 0,
    }
    dayRow.orders += 1
    dayRow.items += linesQty
    dayRow.revenue += total
    dayRow.cashIn += net
    dayMap.set(day, dayRow)

    let ev = eventMap.get(eventId)
    if (!ev) {
      ev = {
        row: {
          eventId,
          orders: 0,
          items: 0,
          revenue: 0,
          cashIn: 0,
          topItem: null,
        },
        itemQty: new Map(),
      }
      eventMap.set(eventId, ev)
    }
    ev.row.orders += 1
    ev.row.items += linesQty
    ev.row.revenue += total
    ev.row.cashIn += net

    for (const l of o.lines) {
      const key =
        l.drink === 'chai' || l.drink === 'lassi' ? `${l.menuItemId}:${l.drink}` : l.menuItemId
      const cur = itemMap.get(key) || {
        menuItemId: key,
        name: l.name,
        qty: 0,
        revenue: 0,
        avgPrice: 0,
      }
      cur.qty += l.qty
      cur.revenue += l.qty * l.price
      cur.name = l.name
      itemMap.set(key, cur)

      const iq = ev.itemQty.get(key) || { name: l.name, qty: 0 }
      iq.qty += l.qty
      iq.name = l.name
      ev.itemQty.set(key, iq)
    }
  }

  const byItem = [...itemMap.values()]
    .map((r) => ({
      ...r,
      revenue: Math.round(r.revenue * 100) / 100,
      avgPrice: r.qty > 0 ? Math.round((r.revenue / r.qty) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)

  const byDay = [...dayMap.values()]
    .map((r) => ({
      ...r,
      revenue: Math.round(r.revenue * 100) / 100,
      cashIn: Math.round(r.cashIn * 100) / 100,
    }))
    .sort((a, b) => b.day.localeCompare(a.day))

  const byEvent = [...eventMap.values()]
    .map(({ row, itemQty }) => {
      let top: string | null = null
      let topQty = 0
      for (const v of itemQty.values()) {
        if (v.qty > topQty) {
          topQty = v.qty
          top = v.name
        }
      }
      return {
        ...row,
        revenue: Math.round(row.revenue * 100) / 100,
        cashIn: Math.round(row.cashIn * 100) / 100,
        topItem: top,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  return {
    orderCount: list.length,
    itemCount,
    revenue: Math.round(revenue * 100) / 100,
    cashIn: Math.round(cashIn * 100) / 100,
    byItem,
    byDay,
    byEvent,
    topItem: byItem[0] || null,
  }
}
