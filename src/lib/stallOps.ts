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

export type MenuKind = 'single' | 'combo'
export type DrinkChoice = 'chai' | 'lassi'

export interface MenuItem {
  id: string
  name: string
  kind: MenuKind
  /** Default price for single items. */
  price: number
  /** Default combo price with masala chai. */
  priceWithChai?: number
  /** Default combo price with mango lassi. */
  priceWithLassi?: number
  /** What’s included (combos). */
  contents?: string
  /** Estimated food cost € (excl. drink for combos). */
  foodCost?: number
  /** Extra cost when drink is masala chai. */
  drinkCostChai?: number
  /** Extra cost when drink is mango lassi. */
  drinkCostLassi?: number
}

export type PrepAssignee = 'Jeeva' | 'Sriram' | 'Sneha' | ''

export interface PrepTask {
  id: string
  text: string
  done: boolean
  assignee: PrepAssignee
}

/** Per-event overrides for one menu item. */
export interface EventPriceOverride {
  price?: number
  priceWithChai?: number
  priceWithLassi?: number
}

export interface OrderLine {
  menuItemId: string
  name: string
  price: number
  qty: number
  drink?: DrinkChoice
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
  /** Voided / refunded after completion. */
  voided?: boolean
  voidReason?: string
  voidedAt?: string
}

export interface StallOpsState {
  stock: StockItem[]
  menu: MenuItem[]
  orders: StallOrder[]
  /** Event selected for new POS tickets. */
  activeEventId?: string
  /** eventId → menuItemId → price overrides for that stall. */
  eventPrices?: Record<string, Record<string, EventPriceOverride>>
  /** Prep checklist per event. */
  prepChecklists?: Record<string, PrepTask[]>
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
  {
    id: 'combo-1',
    name: 'Combo Pack 1',
    kind: 'combo',
    price: 10,
    priceWithChai: 10,
    priceWithLassi: 11,
    contents: 'Masala dosa + chutney + sambar',
    foodCost: 3.5,
    drinkCostChai: 0.6,
    drinkCostLassi: 1.2,
  },
  {
    id: 'combo-2',
    name: 'Combo Pack 2',
    kind: 'combo',
    price: 12,
    priceWithChai: 12,
    priceWithLassi: 13,
    contents: 'Cheese masala dosa + chutney + sambar',
    foodCost: 4.2,
    drinkCostChai: 0.6,
    drinkCostLassi: 1.2,
  },
  {
    id: 'combo-3',
    name: 'Combo Pack 3',
    kind: 'combo',
    price: 14,
    priceWithChai: 14,
    priceWithLassi: 15,
    contents: '2× Sambar idli + Gobi 65 + chutney',
    foodCost: 5.0,
    drinkCostChai: 0.6,
    drinkCostLassi: 1.2,
  },
  { id: 'masala-dosa', name: 'Masala dosa', kind: 'single', price: 8, foodCost: 2.8 },
  {
    id: 'cheese-masala-dosa',
    name: 'Cheese masala dosa',
    kind: 'single',
    price: 9,
    foodCost: 3.4,
  },
  { id: 'plain-dosa', name: 'Plain dosa', kind: 'single', price: 7, foodCost: 2.2 },
  { id: 'sambar-idli', name: 'Sambar idli', kind: 'single', price: 6, foodCost: 2.0 },
  { id: 'gobi-65', name: 'Gobi 65', kind: 'single', price: 7, foodCost: 2.5 },
  { id: 'masala-chai', name: 'Masala chai', kind: 'single', price: 3, foodCost: 0.6 },
  { id: 'mango-lassi', name: 'Mango lassi', kind: 'single', price: 4, foodCost: 1.2 },
]

export const DEFAULT_PREP_TASKS: Omit<PrepTask, 'id'>[] = [
  { text: 'Batter ready (dosa / idli)', done: false, assignee: 'Jeeva' },
  { text: 'Chutney + sambar', done: false, assignee: 'Sneha' },
  { text: 'Gazebo / tables / float', done: false, assignee: 'Sriram' },
  { text: 'Cups, plates, napkins', done: false, assignee: '' },
  { text: 'Chai + lassi stocked', done: false, assignee: '' },
]

export function drinkLabel(drink: DrinkChoice): string {
  return drink === 'chai' ? 'Masala chai' : 'Mango lassi'
}

/** Split combo contents string into editable item lines. */
export function parseComboContents(contents?: string): string[] {
  if (!contents?.trim()) return []
  return contents
    .split(/\s*[+·,|]\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinComboContents(items: string[]): string {
  return items.map((s) => s.trim()).filter(Boolean).join(' + ')
}

export function lineKey(menuItemId: string, drink?: DrinkChoice): string {
  return drink ? `${menuItemId}:${drink}` : menuItemId
}

export function comboLineName(item: MenuItem, drink: DrinkChoice): string {
  return `${item.name} · ${drinkLabel(drink)}`
}

export function resolveMenuPrice(
  item: MenuItem,
  eventId: string | undefined,
  eventPrices: Record<string, Record<string, EventPriceOverride>> | undefined,
  drink?: DrinkChoice,
): number {
  const ov = eventId ? eventPrices?.[eventId]?.[item.id] : undefined
  if (item.kind === 'combo') {
    const d = drink || 'chai'
    if (d === 'chai') {
      const v = ov?.priceWithChai ?? item.priceWithChai ?? item.price
      return Math.max(0, Number(v) || 0)
    }
    const v = ov?.priceWithLassi ?? item.priceWithLassi ?? item.price
    return Math.max(0, Number(v) || 0)
  }
  const v = ov?.price ?? item.price
  return Math.max(0, Number(v) || 0)
}

export function makeOrderLine(
  item: MenuItem,
  qty: number,
  eventId: string | undefined,
  eventPrices: Record<string, Record<string, EventPriceOverride>> | undefined,
  drink?: DrinkChoice,
): OrderLine {
  const d = item.kind === 'combo' ? drink || 'chai' : undefined
  return {
    menuItemId: item.id,
    name: d ? comboLineName(item, d) : item.name,
    price: resolveMenuPrice(item, eventId, eventPrices, d),
    qty,
    drink: d,
  }
}

/** Estimated cost for one unit (combo includes drink cost). */
export function unitFoodCost(item: MenuItem, drink?: DrinkChoice): number {
  const base = Math.max(0, Number(item.foodCost) || 0)
  if (item.kind !== 'combo') return base
  const d = drink || 'chai'
  const drinkCost =
    d === 'chai'
      ? Math.max(0, Number(item.drinkCostChai) || 0)
      : Math.max(0, Number(item.drinkCostLassi) || 0)
  return Math.round((base + drinkCost) * 100) / 100
}

export function comboMarginEuro(
  item: MenuItem,
  eventId: string | undefined,
  eventPrices: Record<string, Record<string, EventPriceOverride>> | undefined,
  drink: DrinkChoice,
): { price: number; cost: number; margin: number; marginPct: number } {
  const price = resolveMenuPrice(item, eventId, eventPrices, drink)
  const cost = unitFoodCost(item, drink)
  const margin = Math.round((price - cost) * 100) / 100
  const marginPct = price > 0 ? Math.round((margin / price) * 1000) / 10 : 0
  return { price, cost, margin, marginPct }
}

export function activeOrders(orders: StallOrder[]): StallOrder[] {
  return orders.filter((o) => !o.voided)
}

export function remainingOf(item: StockItem): number {
  return Math.max(0, (item.bought || 0) - (item.used || 0))
}

export function isLowStock(item: StockItem): boolean {
  return remainingOf(item) <= (item.lowAt ?? 0)
}

export function orderTotal(lines: OrderLine[]): number {
  return Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100
}

function normalizeMenuItem(raw: Partial<MenuItem> & { id: string }): MenuItem {
  const def = DEFAULT_MENU.find((d) => d.id === raw.id)
  const kind: MenuKind =
    raw.kind === 'combo' || raw.kind === 'single'
      ? raw.kind
      : def?.kind === 'combo' || /^combo-\d+$/i.test(raw.id)
        ? 'combo'
        : 'single'
  const price = Math.max(0, Number(raw.price ?? def?.price) || 0)
  if (kind === 'combo') {
    return {
      id: raw.id,
      name: raw.name || def?.name || raw.id,
      kind: 'combo',
      price,
      priceWithChai: Math.max(
        0,
        Number(raw.priceWithChai ?? def?.priceWithChai ?? price) || 0,
      ),
      priceWithLassi: Math.max(
        0,
        Number(raw.priceWithLassi ?? def?.priceWithLassi ?? price) || 0,
      ),
      contents: (raw.contents ?? def?.contents ?? '').trim() || undefined,
      foodCost: Math.max(0, Number(raw.foodCost ?? def?.foodCost) || 0),
      drinkCostChai: Math.max(0, Number(raw.drinkCostChai ?? def?.drinkCostChai) || 0),
      drinkCostLassi: Math.max(0, Number(raw.drinkCostLassi ?? def?.drinkCostLassi) || 0),
    }
  }
  return {
    id: raw.id,
    name: raw.name || def?.name || raw.id,
    kind: 'single',
    price,
    foodCost: Math.max(0, Number(raw.foodCost ?? def?.foodCost) || 0) || undefined,
  }
}

/** Merge saved menu with defaults so new combos appear for everyone. */
export function mergeMenu(raw: Partial<MenuItem>[] | undefined | null): MenuItem[] {
  const byId = new Map<string, MenuItem>()
  for (const d of DEFAULT_MENU) byId.set(d.id, { ...d })
  if (Array.isArray(raw)) {
    for (const r of raw) {
      if (!r?.id) continue
      const prev = byId.get(r.id)
      byId.set(r.id, normalizeMenuItem({ ...prev, ...r, id: r.id }))
    }
  }
  const defaults = DEFAULT_MENU.map((d) => byId.get(d.id)!)
  const extras = [...byId.values()].filter((m) => !DEFAULT_MENU.some((d) => d.id === m.id))
  return [...defaults, ...extras]
}

function normalizeEventPrices(
  raw: StallOpsState['eventPrices'],
): Record<string, Record<string, EventPriceOverride>> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, Record<string, EventPriceOverride>> = {}
  for (const [eventId, items] of Object.entries(raw)) {
    if (!items || typeof items !== 'object') continue
    out[eventId] = {}
    for (const [itemId, ov] of Object.entries(items)) {
      if (!ov || typeof ov !== 'object') continue
      const patch: EventPriceOverride = {}
      if (ov.price != null && Number.isFinite(Number(ov.price))) {
        patch.price = Math.max(0, Number(ov.price))
      }
      if (ov.priceWithChai != null && Number.isFinite(Number(ov.priceWithChai))) {
        patch.priceWithChai = Math.max(0, Number(ov.priceWithChai))
      }
      if (ov.priceWithLassi != null && Number.isFinite(Number(ov.priceWithLassi))) {
        patch.priceWithLassi = Math.max(0, Number(ov.priceWithLassi))
      }
      if (Object.keys(patch).length) out[eventId][itemId] = patch
    }
  }
  return out
}

export function emptyStallOps(): StallOpsState {
  return {
    stock: DEFAULT_STOCK.map((s) => ({ ...s })),
    menu: DEFAULT_MENU.map((m) => ({ ...m })),
    orders: [],
    activeEventId: '',
    eventPrices: {},
    prepChecklists: {},
  }
}

export function normalizeStallOps(raw: Partial<StallOpsState> | null): StallOpsState {
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
  const menu = mergeMenu(raw.menu as Partial<MenuItem>[] | undefined)
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
          drink: l.drink === 'chai' || l.drink === 'lassi' ? l.drink : undefined,
        })),
        createdAt: o.createdAt || new Date().toISOString(),
        completedAt: o.completedAt,
        eventId: o.eventId || undefined,
        paid: o.paid != null ? Number(o.paid) : undefined,
        change: o.change != null ? Number(o.change) : undefined,
        voided: Boolean(o.voided),
        voidReason: o.voidReason || undefined,
        voidedAt: o.voidedAt || undefined,
      }))
    : []
  const prepChecklists: Record<string, PrepTask[]> = {}
  if (raw.prepChecklists && typeof raw.prepChecklists === 'object') {
    for (const [eventId, tasks] of Object.entries(raw.prepChecklists)) {
      if (!Array.isArray(tasks)) continue
      prepChecklists[eventId] = tasks.map((t) => ({
        id: t.id || newId('prep'),
        text: t.text || '',
        done: Boolean(t.done),
        assignee:
          t.assignee === 'Jeeva' || t.assignee === 'Sriram' || t.assignee === 'Sneha'
            ? t.assignee
            : '',
      }))
    }
  }
  return {
    stock,
    menu,
    orders,
    activeEventId: typeof raw.activeEventId === 'string' ? raw.activeEventId : '',
    eventPrices: normalizeEventPrices(raw.eventPrices),
    prepChecklists,
  }
}

export function loadStallOps(): StallOpsState {
  try {
    const raw = localStorage.getItem(demoStorageKey(KEY))
    if (!raw) return emptyStallOps()
    return normalizeStallOps(JSON.parse(raw) as StallOpsState)
  } catch {
    return emptyStallOps()
  }
}

export function saveStallOpsLocal(state: StallOpsState) {
  localStorage.setItem(demoStorageKey(KEY), JSON.stringify(state))
}

export function soldCounts(orders: StallOrder[]): { name: string; qty: number; revenue: number }[] {
  const map = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const o of orders.filter((x) => x.status === 'completed' && !x.voided)) {
    for (const l of o.lines) {
      const key = lineKey(l.menuItemId, l.drink)
      const cur = map.get(key) || { name: l.name, qty: 0, revenue: 0 }
      cur.qty += l.qty
      cur.revenue += l.qty * l.price
      cur.name = l.name
      map.set(key, cur)
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty)
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function defaultPrepChecklist(): PrepTask[] {
  return DEFAULT_PREP_TASKS.map((t) => ({ ...t, id: newId('prep') }))
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
