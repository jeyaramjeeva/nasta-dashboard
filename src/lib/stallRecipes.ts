/** Recipes, yields, shopping list, suggested Made, stock auto-use. */

import type { EventMetrics } from '../types'
import type { InventoryItemDef } from './extrasStore'
import { forecastEvent } from './insights'
import type {
  FoodMadeRow,
  MenuItem,
  Recipe,
  StallOrder,
  StockAutoUseRule,
  StockItem,
} from './stallOps'
import { orderTotal } from './stallOps'

export const DEFAULT_RECIPES: Recipe[] = [
  {
    prepItemId: 'dosa-batter',
    batchSize: 1,
    unit: 'batch',
    yields: [
      { menuItemId: 'masala-dosa', portions: 25 },
      { menuItemId: 'plain-dosa', portions: 30 },
      { menuItemId: 'combo-1', portions: 20 },
      { menuItemId: 'combo-2', portions: 20 },
    ],
    ingredients: [
      { itemId: 'dosa-batter', qtyPerBatch: 1 },
    ],
  },
  {
    prepItemId: 'idli-batter',
    batchSize: 1,
    unit: 'batch',
    yields: [
      { menuItemId: 'sambar-idli', portions: 40 },
      { menuItemId: 'combo-2', portions: 30 },
    ],
    ingredients: [{ itemId: 'idli-batter', qtyPerBatch: 1 }],
  },
  {
    prepItemId: 'sambar',
    batchSize: 1,
    unit: 'litre',
    yields: [
      { menuItemId: 'sambar-idli', portions: 12 },
      { menuItemId: 'masala-dosa', portions: 10 },
      { menuItemId: 'combo-1', portions: 10 },
      { menuItemId: 'combo-2', portions: 10 },
    ],
    ingredients: [{ itemId: 'sambar', qtyPerBatch: 1 }],
  },
  {
    prepItemId: 'tomato-chutney',
    batchSize: 1,
    unit: 'bowl',
    yields: [
      { menuItemId: 'masala-dosa', portions: 20 },
      { menuItemId: 'sambar-idli', portions: 20 },
      { menuItemId: 'medu-vada', portions: 15 },
      { menuItemId: 'combo-1', portions: 15 },
      { menuItemId: 'combo-2', portions: 15 },
      { menuItemId: 'combo-3', portions: 15 },
    ],
    ingredients: [{ itemId: 'tomato-chutney', qtyPerBatch: 1 }],
  },
  {
    prepItemId: 'potato-masala',
    batchSize: 1,
    unit: 'batch',
    yields: [
      { menuItemId: 'masala-dosa', portions: 25 },
      { menuItemId: 'combo-1', portions: 20 },
    ],
    ingredients: [{ itemId: 'potato-masala', qtyPerBatch: 1 }],
  },
  {
    prepItemId: 'masala-chai',
    batchSize: 1,
    unit: 'litre',
    yields: [
      { menuItemId: 'masala-chai', portions: 8 },
      { menuItemId: 'combo-1', portions: 8 },
      { menuItemId: 'combo-2', portions: 8 },
      { menuItemId: 'combo-3', portions: 8 },
    ],
    ingredients: [{ itemId: 'masala-chai', qtyPerBatch: 1 }],
  },
  {
    prepItemId: 'mango-lassi',
    batchSize: 1,
    unit: 'litre',
    yields: [
      { menuItemId: 'mango-lassi', portions: 6 },
      { menuItemId: 'combo-1', portions: 6 },
      { menuItemId: 'combo-2', portions: 6 },
      { menuItemId: 'combo-3', portions: 6 },
    ],
    ingredients: [{ itemId: 'mango-lassi', qtyPerBatch: 1 }],
  },
]

export const DEFAULT_STOCK_AUTO_USE: StockAutoUseRule[] = [
  { menuItemId: 'masala-dosa', stockItemId: 'plates', qtyPerSale: 1 },
  { menuItemId: 'plain-dosa', stockItemId: 'plates', qtyPerSale: 1 },
  { menuItemId: 'sambar-idli', stockItemId: 'idly-bowl', qtyPerSale: 1 },
  { menuItemId: 'gobi-65', stockItemId: 'cauli-bowl', qtyPerSale: 1 },
  { menuItemId: 'combo-1', stockItemId: 'plates', qtyPerSale: 1 },
  { menuItemId: 'combo-2', stockItemId: 'plates', qtyPerSale: 1 },
  { menuItemId: 'combo-3', stockItemId: 'plates', qtyPerSale: 1 },
  { menuItemId: 'masala-chai', stockItemId: 'chai-cup', qtyPerSale: 1 },
  { menuItemId: 'mango-lassi', stockItemId: 'lassi-cup', qtyPerSale: 1 },
]

export function mergeRecipes(saved?: Recipe[] | null): Recipe[] {
  const byId = new Map(DEFAULT_RECIPES.map((r) => [r.prepItemId, { ...r, yields: [...r.yields], ingredients: r.ingredients ? [...r.ingredients] : undefined }]))
  for (const r of saved || []) {
    const id = String(r.prepItemId || '').trim()
    if (!id) continue
    byId.set(id, {
      prepItemId: id,
      batchSize: Math.max(0.1, Number(r.batchSize) || 1),
      unit: String(r.unit || 'batch').trim().slice(0, 24) || 'batch',
      yields: (r.yields || [])
        .map((y) => ({
          menuItemId: String(y.menuItemId || '').trim(),
          portions: Math.max(0, Number(y.portions) || 0),
        }))
        .filter((y) => y.menuItemId && y.portions > 0),
      ingredients: (r.ingredients || [])
        .map((ing) => ({
          itemId: String(ing.itemId || '').trim(),
          qtyPerBatch: Math.max(0, Number(ing.qtyPerBatch) || 0),
        }))
        .filter((ing) => ing.itemId && ing.qtyPerBatch > 0),
    })
  }
  return [...byId.values()]
}

export function mergeStockAutoUse(saved?: StockAutoUseRule[] | null): StockAutoUseRule[] {
  const byKey = new Map(
    DEFAULT_STOCK_AUTO_USE.map((r) => [`${r.menuItemId}|${r.stockItemId}`, { ...r }]),
  )
  for (const r of saved || []) {
    const menuItemId = String(r.menuItemId || '').trim()
    const stockItemId = String(r.stockItemId || '').trim()
    if (!menuItemId || !stockItemId) continue
    byKey.set(`${menuItemId}|${stockItemId}`, {
      menuItemId,
      stockItemId,
      qtyPerSale: Math.max(0, Number(r.qtyPerSale) || 0),
    })
  }
  return [...byKey.values()].filter((r) => r.qtyPerSale > 0)
}

/** Portions from batches for one prep item. */
export function batchesToPortions(recipe: Recipe, batches: number, menuItemId?: string): number {
  const b = Math.max(0, Number(batches) || 0)
  if (!recipe.yields.length) return 0
  if (menuItemId) {
    const y = recipe.yields.find((x) => x.menuItemId === menuItemId)
    return y ? Math.round(b * y.portions * 10) / 10 : 0
  }
  const primary = recipe.yields[0]!
  return Math.round(b * primary.portions * 10) / 10
}

/** Batches needed for desired portions. */
export function portionsToBatches(recipe: Recipe, portions: number, menuItemId?: string): number {
  const p = Math.max(0, Number(portions) || 0)
  const y = menuItemId
    ? recipe.yields.find((x) => x.menuItemId === menuItemId)
    : recipe.yields[0]
  if (!y || y.portions <= 0) return 0
  return Math.round((p / y.portions) * 100) / 100
}

export interface ShoppingLine {
  itemId: string
  name: string
  unit: string
  qty: number
}

/** Shopping list from planned Made qty (batches) × recipe ingredients. */
export function shoppingListFromMade(
  planned: Record<string, number>,
  recipes: Recipe[],
  defs: InventoryItemDef[],
): ShoppingLine[] {
  const byId = new Map<string, ShoppingLine>()
  const defById = new Map(defs.map((d) => [d.id, d]))
  for (const recipe of recipes) {
    const batches = Math.max(0, Number(planned[recipe.prepItemId]) || 0)
    if (batches <= 0) continue
    const ings =
      recipe.ingredients?.length
        ? recipe.ingredients
        : [{ itemId: recipe.prepItemId, qtyPerBatch: recipe.batchSize || 1 }]
    for (const ing of ings) {
      const def = defById.get(ing.itemId)
      const qty = Math.round(batches * ing.qtyPerBatch * 100) / 100
      const prev = byId.get(ing.itemId)
      if (prev) prev.qty = Math.round((prev.qty + qty) * 100) / 100
      else {
        byId.set(ing.itemId, {
          itemId: ing.itemId,
          name: def?.name || ing.itemId,
          unit: def?.unit || recipe.unit,
          qty,
        })
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export interface SuggestedMadeRow {
  prepItemId: string
  name: string
  unit: string
  suggested: number
  reason: string
}

/** Suggest Made batches from forecast + historical averages + yields. */
export function suggestedMadeForEvent(opts: {
  eventType: string
  days: number
  byEventType: {
    type: string
    incomePerDay: number
    count: number
    avgGroceryPerDay: number
    avgFee: number
    avgTransport: number
  }[]
  /** prepItemId → avg used per day (excluding spoiled). */
  avgUsedByPrep: Record<string, number>
  recipes: Recipe[]
  defs: InventoryItemDef[]
  platePriceHint?: number
}): SuggestedMadeRow[] {
  const fc = forecastEvent(opts.byEventType, opts.eventType, Math.max(1, opts.days))
  const plate = opts.platePriceHint || 8
  const expectedPlates = plate > 0 ? fc.expectedIncome / plate / Math.max(1, opts.days) : 0
  const out: SuggestedMadeRow[] = []
  for (const recipe of opts.recipes) {
    const def = opts.defs.find((d) => d.id === recipe.prepItemId)
    const avgUsed = opts.avgUsedByPrep[recipe.prepItemId] || 0
    const primaryYield = recipe.yields[0]?.portions || 0
    let suggested = avgUsed
    let reason = avgUsed > 0 ? 'Historical avg used' : 'No history yet'
    if (expectedPlates > 0 && primaryYield > 0) {
      const fromForecast = expectedPlates / primaryYield
      if (avgUsed > 0) {
        suggested = Math.round(((avgUsed * 0.65 + fromForecast * 0.35) * 10) / 10)
        reason = 'Blend of history + forecast'
      } else {
        suggested = Math.round(fromForecast * 10) / 10
        reason = 'From sales forecast'
      }
    }
    suggested = Math.max(0, Math.ceil(suggested * 2) / 2)
    out.push({
      prepItemId: recipe.prepItemId,
      name: def?.name || recipe.prepItemId,
      unit: recipe.unit || def?.unit || 'batch',
      suggested,
      reason,
    })
  }
  return out.filter((r) => r.suggested > 0)
}

/** Food day cost from made × unitCost. */
export function foodDayCost(
  dayLog: Record<string, FoodMadeRow>,
  defs: InventoryItemDef[],
): number {
  const byId = new Map(defs.map((d) => [d.id, d]))
  let cost = 0
  for (const [id, row] of Object.entries(dayLog)) {
    const def = byId.get(id)
    const made = Math.max(0, Number(row.made) || 0)
    if (!def || made <= 0) continue
    cost += made * (Number(def.unitCost) || 0)
  }
  return Math.round(cost * 100) / 100
}

/** Revenue from completed (non-void) orders for event+day (Germany ymd). */
export function foodDayRevenue(
  orders: StallOrder[],
  eventId: string,
  dayYmd: string,
  germanyYmdFn: (iso: string) => string,
): number {
  const eid = String(eventId || '').trim()
  let rev = 0
  for (const o of orders) {
    if (o.status !== 'completed' || o.voided) continue
    if (String(o.eventId || '').trim() !== eid) continue
    const when = o.completedAt || o.createdAt
    if (!when || germanyYmdFn(when) !== dayYmd) continue
    rev += orderTotal(o.lines)
  }
  return Math.round(rev * 100) / 100
}

export function foodDayMarginPct(cost: number, revenue: number): number | null {
  if (revenue <= 0) return null
  return Math.round(((revenue - cost) / revenue) * 1000) / 10
}

/** Stock waste% = (bought − used − remaining) / bought. remaining = bought − used so waste is 0 unless we track discard separately via spoiled on food. */
export function stockWastePct(s: StockItem): number | null {
  const bought = Number(s.bought) || 0
  if (bought <= 0) return null
  const used = Number(s.used) || 0
  const remaining = Math.max(0, bought - used)
  // Explicit waste when bought exceeds used+remaining accounting — normally 0.
  // Use (bought - used - remaining) which is 0; instead report unused share as potential waste proxy:
  // waste% = unused / bought when low turnover. Plan: (bought − used − remaining_now) / bought.
  const waste = Math.max(0, bought - used - remaining)
  return Math.round((waste / bought) * 1000) / 10
}

/** Food spoil waste% = spoiled / made. */
export function foodSpoilWastePct(row: FoodMadeRow): number | null {
  const made = Number(row.made) || 0
  if (made <= 0) return null
  const spoiled = Math.max(0, Number(row.spoiled) || 0)
  return Math.round((spoiled / made) * 1000) / 10
}

/** Aggregate warehouse waste card: share of bought that was never used (sitting or gone). */
export function warehouseIdlePct(stock: StockItem[]): number | null {
  let bought = 0
  let used = 0
  for (const s of stock) {
    bought += Number(s.bought) || 0
    used += Number(s.used) || 0
  }
  if (bought <= 0) return null
  return Math.round(((bought - used) / bought) * 1000) / 10
}

export function foodDaySpoilWastePct(dayLog: Record<string, FoodMadeRow>): number | null {
  let made = 0
  let spoiled = 0
  for (const row of Object.values(dayLog)) {
    made += Number(row.made) || 0
    spoiled += Number(row.spoiled) || 0
  }
  if (made <= 0) return null
  return Math.round((spoiled / made) * 1000) / 10
}

export function convertKgToUnits(kg: number, kgPerUnit: number): number {
  if (kgPerUnit <= 0) return 0
  return Math.round((kg / kgPerUnit) * 100) / 100
}

export function convertUnitsToKg(units: number, kgPerUnit: number): number {
  if (kgPerUnit <= 0) return 0
  return Math.round(units * kgPerUnit * 100) / 100
}

export function convertPortionsToUnits(portions: number, portionPerUnit: number): number {
  if (portionPerUnit <= 0) return 0
  return Math.round((portions / portionPerUnit) * 100) / 100
}

export function convertUnitsToPortions(units: number, portionPerUnit: number): number {
  if (portionPerUnit <= 0) return 0
  return Math.round(units * portionPerUnit * 100) / 100
}

/** Stock qty to deduct for a completed order (idempotent caller stamps order id). */
export function autoUseQtyForOrder(
  order: StallOrder,
  rules: StockAutoUseRule[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const line of order.lines || []) {
    const qty = Math.max(0, Number(line.qty) || 0)
    if (qty <= 0) continue
    for (const rule of rules) {
      if (rule.menuItemId !== line.menuItemId) continue
      const add = qty * rule.qtyPerSale
      out[rule.stockItemId] = (out[rule.stockItemId] || 0) + add
    }
    // Combo drink cups
    if (line.drink === 'chai') {
      const chai = rules.find((r) => r.menuItemId === 'masala-chai')
      if (chai) out[chai.stockItemId] = (out[chai.stockItemId] || 0) + qty * chai.qtyPerSale
    }
    if (line.drink === 'lassi') {
      const lassi = rules.find((r) => r.menuItemId === 'mango-lassi')
      if (lassi) out[lassi.stockItemId] = (out[lassi.stockItemId] || 0) + qty * lassi.qtyPerSale
    }
  }
  return out
}

/** Put warehouse qty back when a completed ticket is reopened or voided. */
export function reverseAutoUseForOrder(
  stock: StockItem[],
  applied: string[] | undefined,
  order: StallOrder | undefined,
  rules: StockAutoUseRule[],
): { stock: StockItem[]; stockAutoUseApplied: string[] } {
  const nextApplied = [
    ...new Set((applied || []).map((id) => String(id || '').trim()).filter(Boolean)),
  ]
  if (!order || !nextApplied.includes(order.id)) {
    return { stock, stockAutoUseApplied: nextApplied }
  }
  const qtyByStock = autoUseQtyForOrder(order, rules)
  return {
    stock: stock.map((item) => {
      const requested = qtyByStock[item.id] || 0
      if (requested <= 0) return item
      return {
        ...item,
        used: Math.max(0, Math.round((item.used - requested) * 100) / 100),
      }
    }),
    stockAutoUseApplied: nextApplied.filter((id) => id !== order.id),
  }
}

export function menuName(menu: MenuItem[], id: string): string {
  return menu.find((m) => m.id === id)?.name || id
}

/** Avg used per prep (exclude spoiled from “used” for planning). */
export function avgUsedByPrepFromFoodMade(
  foodMade: Record<string, Record<string, Record<string, FoodMadeRow>>>,
  eventIds: string[],
): Record<string, number> {
  const buckets = new Map<string, number[]>()
  for (const eid of eventIds) {
    const days = foodMade[eid] || {}
    for (const items of Object.values(days)) {
      for (const [key, row] of Object.entries(items)) {
        const used = Math.max(0, Number(row.used) || 0)
        const spoiled = Math.max(0, Number(row.spoiled) || 0)
        // Plan averages exclude spoiled from “used”
        const effective = Math.max(0, used)
        if (effective <= 0 && spoiled <= 0 && !(Number(row.made) > 0)) continue
        if (effective <= 0 && !(Number(row.made) > 0)) continue
        const list = buckets.get(key) || []
        list.push(effective)
        buckets.set(key, list)
      }
    }
  }
  const out: Record<string, number> = {}
  for (const [k, vals] of buckets) {
    if (!vals.length) continue
    out[k] = Math.round((vals.reduce((s, n) => s + n, 0) / vals.length) * 10) / 10
  }
  return out
}

export function remainingFood(row: Pick<FoodMadeRow, 'made' | 'used' | 'spoiled'>): number {
  const made = Number(row.made) || 0
  const used = Number(row.used) || 0
  const spoiled = Number(row.spoiled) || 0
  return Math.round((made - used - spoiled) * 100) / 100
}

/** Next Germany calendar day yyyy-mm-dd. */
export function nextYmd(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ymd
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  d.setUTCDate(d.getUTCDate() + 1)
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

export type { EventMetrics }
