/** Stall stock + POS orders (synced via team_extras.stall_ops). */

import { demoStorageKey } from './demoMode'
import { germanyTodayYmd, germanyYmd } from './germanyTime'

export interface StockItem {
  id: string
  name: string
  unit: string
  /** Alert when remaining ≤ this. */
  lowAt: number
  bought: number
  used: number
}

export interface MenuItem {
  id: string
  name: string
  price: number
}

export interface OrderLine {
  menuItemId: string
  name: string
  price: number
  qty: number
}

export type OrderStatus = 'pending' | 'completed'

export interface StallOrder {
  id: string
  /** Customer label / ticket # */
  label: string
  status: OrderStatus
  lines: OrderLine[]
  createdAt: string
  completedAt?: string
  /** Stall / Excel event this order belongs to. */
  eventId?: string
  /** Cash the customer handed over (€). */
  paid?: number
  /** Change to return (€) = paid − total. */
  change?: number
}

export interface StallOpsState {
  stock: StockItem[]
  menu: MenuItem[]
  orders: StallOrder[]
  /** Event selected for new POS tickets. */
  activeEventId?: string
}

const KEY = 'nasta-stall-ops-v1'

export const DEFAULT_STOCK: StockItem[] = [
  { id: 'plates', name: 'Plates', unit: 'pcs', lowAt: 20, bought: 0, used: 0 },
  { id: 'idly-bowl', name: 'Idly bowl', unit: 'pcs', lowAt: 5, bought: 0, used: 0 },
  { id: 'cauli-bowl', name: 'Cauliflower bowl', unit: 'pcs', lowAt: 5, bought: 0, used: 0 },
  { id: 'lassi-cup', name: 'Lassi cup', unit: 'pcs', lowAt: 10, bought: 0, used: 0 },
  { id: 'chai-cup', name: 'Masala chai cup', unit: 'pcs', lowAt: 10, bought: 0, used: 0 },
  { id: 'cauli-packet', name: 'Cauliflower packet', unit: 'pcs', lowAt: 3, bought: 0, used: 0 },
  { id: 'salad-packet', name: 'Salad packet', unit: 'pcs', lowAt: 3, bought: 0, used: 0 },
  { id: 'cabbage', name: 'Cabbage', unit: 'pcs', lowAt: 2, bought: 0, used: 0 },
  { id: 'dosa-batter', name: 'Dosa batter', unit: 'batch', lowAt: 1, bought: 0, used: 0 },
  { id: 'idli-batter', name: 'Idli batter', unit: 'batch', lowAt: 1, bought: 0, used: 0 },
  { id: 'chutney', name: 'Chutney', unit: 'bowl', lowAt: 2, bought: 0, used: 0 },
  { id: 'sambar', name: 'Sambar', unit: 'pot', lowAt: 1, bought: 0, used: 0 },
]

export const DEFAULT_MENU: MenuItem[] = [
  { id: 'masala-dosa', name: 'Masala dosa', price: 8 },
  { id: 'cheese-masala-dosa', name: 'Cheese masala dosa', price: 9 },
  { id: 'plain-dosa', name: 'Plain dosa', price: 7 },
  { id: 'sambar-idli', name: 'Sambar idli', price: 6 },
  { id: 'gobi-65', name: 'Gobi 65', price: 7 },
  { id: 'masala-chai', name: 'Masala chai', price: 3 },
  { id: 'mango-lassi', name: 'Mango lassi', price: 4 },
]

export function remainingOf(item: StockItem): number {
  return Math.max(0, (item.bought || 0) - (item.used || 0))
}

export function isLowStock(item: StockItem): boolean {
  return remainingOf(item) <= (item.lowAt ?? 0)
}

export function orderTotal(lines: OrderLine[]): number {
  return Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100
}

export function emptyStallOps(): StallOpsState {
  return {
    stock: DEFAULT_STOCK.map((s) => ({ ...s })),
    menu: DEFAULT_MENU.map((m) => ({ ...m })),
    orders: [],
    activeEventId: '',
  }
}

function normalize(raw: Partial<StallOpsState> | null): StallOpsState {
  const base = emptyStallOps()
  if (!raw) return base
  const stock =
    Array.isArray(raw.stock) && raw.stock.length
      ? raw.stock.map((s) => ({
          id: s.id,
          name: s.name || s.id,
          unit: s.unit || 'pcs',
          lowAt: Number(s.lowAt) || 0,
          bought: Math.max(0, Number(s.bought) || 0),
          used: Math.max(0, Number(s.used) || 0),
        }))
      : base.stock
  const menu =
    Array.isArray(raw.menu) && raw.menu.length
      ? raw.menu.map((m) => ({
          id: m.id,
          name: m.name || m.id,
          price: Math.max(0, Number(m.price) || 0),
        }))
      : base.menu
  const orders = Array.isArray(raw.orders)
    ? raw.orders.map((o) => ({
        id: o.id,
        label: o.label || '',
        status: o.status === 'completed' ? ('completed' as const) : ('pending' as const),
        lines: (o.lines || []).map((l) => ({
          menuItemId: l.menuItemId,
          name: l.name,
          price: Number(l.price) || 0,
          qty: Math.max(0, Number(l.qty) || 0),
        })),
        createdAt: o.createdAt || new Date().toISOString(),
        completedAt: o.completedAt,
        eventId: o.eventId || undefined,
        paid: o.paid != null ? Number(o.paid) : undefined,
        change: o.change != null ? Number(o.change) : undefined,
      }))
    : []
  return {
    stock,
    menu,
    orders,
    activeEventId: typeof raw.activeEventId === 'string' ? raw.activeEventId : '',
  }
}

export function loadStallOps(): StallOpsState {
  try {
    const raw = localStorage.getItem(demoStorageKey(KEY))
    if (!raw) return emptyStallOps()
    return normalize(JSON.parse(raw) as StallOpsState)
  } catch {
    return emptyStallOps()
  }
}

export function saveStallOpsLocal(state: StallOpsState) {
  localStorage.setItem(demoStorageKey(KEY), JSON.stringify(state))
}

export function soldCounts(orders: StallOrder[]): { name: string; qty: number; revenue: number }[] {
  const map = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const o of orders.filter((x) => x.status === 'completed')) {
    for (const l of o.lines) {
      const cur = map.get(l.menuItemId) || { name: l.name, qty: 0, revenue: 0 }
      cur.qty += l.qty
      cur.revenue += l.qty * l.price
      cur.name = l.name
      map.set(l.menuItemId, cur)
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty)
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** Next Customer N for today (Germany date). Resets to 1 each new day. */
export function nextCustomerNumber(orders: StallOrder[], now = new Date()): number {
  const today = germanyTodayYmd(now)
  let max = 0
  for (const o of orders) {
    const day = germanyYmd(new Date(o.createdAt))
    if (day !== today) continue
    const m = /^Customer\s+(\d+)$/i.exec(o.label.trim())
    if (m) max = Math.max(max, Number(m[1]) || 0)
  }
  return max + 1
}

export function customerLabel(n: number): string {
  return `Customer ${n}`
}

export function slugId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `item-${Date.now()}`
  )
}
