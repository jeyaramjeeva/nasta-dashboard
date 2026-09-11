/** Stall analytics: margins, forecasts, heatmap, health score, combo recs. */

import { buildSalesReport } from './salesStats'
import {
  orderTotal,
  unitFoodCost,
  type MenuItem,
  type StallOrder,
} from './stallOps'
import { analyzeSentiment, detectLanguage, type DetectedLang, type SentimentLabel } from './textIntel'
import type { CustomerReview } from './customerReviews'

export interface ItemProfitRow {
  menuItemId: string
  name: string
  qty: number
  revenue: number
  cost: number
  profit: number
  costPerServing: number
  marginPct: number
}

export interface HourHeatCell {
  /** 0=Sun … 6=Sat (JS getDay) */
  dow: number
  hour: number
  orders: number
  revenue: number
}

export interface IncomeTrendPoint {
  day: string
  revenue: number
  forecast?: number
}

export interface ComboRec {
  a: string
  b: string
  together: number
  lift: number
  hint: string
}

export interface DemandPoint {
  name: string
  recentQty: number
  predictedQty: number
  trend: 'up' | 'flat' | 'down'
}

export interface HealthScore {
  score: number // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  factors: { label: string; impact: number; note: string }[]
}

export interface ReviewIntel {
  id: string
  lang: DetectedLang
  sentiment: SentimentLabel
  score: number
}

function completed(orders: StallOrder[]) {
  return orders.filter((o) => o.status === 'completed' && !o.voided)
}

function menuById(menu: MenuItem[]): Map<string, MenuItem> {
  return new Map(menu.map((m) => [m.id, m]))
}

/** Cost & profit per menu item from completed POS sales. */
export function itemProfitability(
  orders: StallOrder[],
  menu: MenuItem[],
): ItemProfitRow[] {
  const catalog = menuById(menu)
  const map = new Map<string, ItemProfitRow>()

  for (const o of completed(orders)) {
    for (const line of o.lines) {
      const item = catalog.get(line.menuItemId)
      const costUnit = item ? unitFoodCost(item, line.drink) : line.price * 0.35
      const cost = costUnit * line.qty
      const revenue = line.price * line.qty
      const prev = map.get(line.menuItemId) || {
        menuItemId: line.menuItemId,
        name: line.name.split(' · ')[0] || line.name,
        qty: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        costPerServing: costUnit,
        marginPct: 0,
      }
      prev.qty += line.qty
      prev.revenue += revenue
      prev.cost += cost
      prev.costPerServing =
        prev.qty > 0 ? Math.round((prev.cost / prev.qty) * 100) / 100 : costUnit
      map.set(line.menuItemId, prev)
    }
  }

  return [...map.values()]
    .map((r) => {
      const profit = Math.round((r.revenue - r.cost) * 100) / 100
      const marginPct =
        r.revenue > 0 ? Math.round((profit / r.revenue) * 1000) / 10 : 0
      return {
        ...r,
        revenue: Math.round(r.revenue * 100) / 100,
        cost: Math.round(r.cost * 100) / 100,
        profit,
        marginPct,
      }
    })
    .sort((a, b) => b.profit - a.profit)
}

const DOW_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/** Berlin weekday (0=Sun) + hour (0–23). */
export function berlinDowHour(iso: string): { dow: number; hour: number } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d)
    const wd = parts.find((p) => p.type === 'weekday')?.value || ''
    let hour = Number(parts.find((p) => p.type === 'hour')?.value)
    if (hour === 24) hour = 0
    if (!Number.isFinite(hour)) return null
    hour = ((hour % 24) + 24) % 24
    const dow = DOW_SHORT[wd]
    if (dow == null) return null
    return { dow, hour }
  } catch {
    return null
  }
}

/** Hour × weekday heatmap. Pass `eventId` to limit to one stall event (`''` / omit = all). */
export function salesHourHeatmap(
  orders: StallOrder[],
  eventId?: string,
): HourHeatCell[] {
  const map = new Map<string, HourHeatCell>()
  const filterId = eventId?.trim()
  for (const o of completed(orders)) {
    if (filterId) {
      const oid = (o.eventId || '').trim()
      if (filterId === '__none__') {
        if (oid) continue
      } else if (oid.toUpperCase() !== filterId.toUpperCase()) {
        continue
      }
    }
    const when = berlinDowHour(o.completedAt || o.createdAt)
    if (!when) continue
    const { dow, hour } = when
    const key = `${dow}-${hour}`
    const cell = map.get(key) || { dow, hour, orders: 0, revenue: 0 }
    cell.orders += 1
    cell.revenue += orderTotal(o.lines)
    map.set(key, cell)
  }
  return [...map.values()]
}

/** Hour columns for the heatmap — always cover stall hours, expand if data is outside. */
export function heatmapHourColumns(cells: HourHeatCell[]): number[] {
  const base = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
  const fromData = cells.filter((c) => c.orders > 0).map((c) => c.hour)
  if (!fromData.length) return base
  const min = Math.min(9, ...fromData)
  const max = Math.max(21, ...fromData)
  const out: number[] = []
  for (let h = min; h <= max; h++) out.push(h)
  return out.length ? out : base
}

/** Daily income + simple linear forecast for next 7 days. */
export function incomeTrendForecast(orders: StallOrder[]): {
  history: IncomeTrendPoint[]
  forecast: IncomeTrendPoint[]
  slopePerDay: number
} {
  const report = buildSalesReport(orders)
  const history = report.byDay
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ day: d.day, revenue: d.revenue }))

  if (history.length < 2) {
    return { history, forecast: [], slopePerDay: 0 }
  }

  const n = history.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  history.forEach((p, i) => {
    sumX += i
    sumY += p.revenue
    sumXY += i * p.revenue
    sumXX += i * i
  })
  const denom = n * sumXX - sumX * sumX || 1
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  const forecast: IncomeTrendPoint[] = []
  const last = history[history.length - 1]
  const lastDate = new Date(last.day + 'T12:00:00')
  for (let i = 1; i <= 7; i++) {
    const d = new Date(lastDate)
    d.setDate(d.getDate() + i)
    const ymd = d.toISOString().slice(0, 10)
    const x = n - 1 + i
    const revenue = Math.max(0, Math.round((intercept + slope * x) * 100) / 100)
    forecast.push({ day: ymd, revenue, forecast: revenue })
  }

  return {
    history,
    forecast,
    slopePerDay: Math.round(slope * 100) / 100,
  }
}

/** AI-style sales forecast summary (rule-based). */
export function aiSalesForecast(orders: StallOrder[]): {
  next7Revenue: number
  vsRecentAvg: number
  narrative: string
} {
  const { history, forecast, slopePerDay } = incomeTrendForecast(orders)
  const next7Revenue = Math.round(forecast.reduce((s, p) => s + (p.forecast || 0), 0) * 100) / 100
  const recent = history.slice(-7)
  const avg =
    recent.length > 0 ? recent.reduce((s, p) => s + p.revenue, 0) / recent.length : 0
  const vsRecentAvg =
    avg > 0 ? Math.round(((next7Revenue / 7 - avg) / avg) * 1000) / 10 : 0
  const narrative =
    history.length < 3
      ? 'Need a few more sold days for a steadier forecast. Keep logging POS tickets.'
      : slopePerDay > 5
        ? `Uptrend (~€${slopePerDay}/day). Next 7 days look like ~€${next7Revenue.toFixed(0)} if the pace holds.`
        : slopePerDay < -5
          ? `Softening (~€${Math.abs(slopePerDay)}/day down). Next 7 days ~€${next7Revenue.toFixed(0)} — push combos & weather-friendly stalls.`
          : `Stable. Next 7 days roughly €${next7Revenue.toFixed(0)} (about €${(next7Revenue / 7).toFixed(0)}/day).`
  return { next7Revenue, vsRecentAvg, narrative }
}

/** Demand prediction per menu item from recent vs prior window. */
export function aiDemandPrediction(
  orders: StallOrder[],
  menu: MenuItem[],
): DemandPoint[] {
  const done = completed(orders).sort((a, b) =>
    (a.completedAt || a.createdAt).localeCompare(b.completedAt || b.createdAt),
  )
  if (!done.length) return []
  const mid = Math.floor(done.length / 2)
  const older = done.slice(0, mid)
  const recent = done.slice(mid)

  const count = (list: StallOrder[]) => {
    const m = new Map<string, { name: string; qty: number }>()
    for (const o of list) {
      for (const l of o.lines) {
        const id = l.menuItemId
        const prev = m.get(id) || { name: l.name.split(' · ')[0], qty: 0 }
        prev.qty += l.qty
        m.set(id, prev)
      }
    }
    return m
  }
  const a = count(older)
  const b = count(recent)
  const ids = new Set([...a.keys(), ...b.keys(), ...menu.map((m) => m.id)])

  return [...ids]
    .map((id) => {
      const recentQty = b.get(id)?.qty || 0
      const olderQty = a.get(id)?.qty || 0
      const name = b.get(id)?.name || a.get(id)?.name || menu.find((m) => m.id === id)?.name || id
      // Simple projection: recent + half the delta
      const predictedQty = Math.max(0, Math.round(recentQty + (recentQty - olderQty) * 0.5))
      const trend: DemandPoint['trend'] =
        recentQty > olderQty * 1.15 ? 'up' : recentQty < olderQty * 0.85 ? 'down' : 'flat'
      return { name, recentQty, predictedQty, trend }
    })
    .filter((r) => r.recentQty + r.predictedQty > 0)
    .sort((x, y) => y.predictedQty - x.predictedQty)
    .slice(0, 12)
}

/** Items often bought together → combo recommendations. */
export function comboRecommendations(orders: StallOrder[]): ComboRec[] {
  const pair = new Map<string, number>()
  const single = new Map<string, number>()
  let tickets = 0

  for (const o of completed(orders)) {
    const names = [
      ...new Set(o.lines.map((l) => l.name.split(' · ')[0].trim()).filter(Boolean)),
    ]
    if (names.length < 2) continue
    tickets += 1
    for (const n of names) single.set(n, (single.get(n) || 0) + 1)
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const [a, b] = [names[i], names[j]].sort()
        const key = `${a}|||${b}`
        pair.set(key, (pair.get(key) || 0) + 1)
      }
    }
  }

  if (!tickets) return []

  return [...pair.entries()]
    .map(([key, together]) => {
      const [a, b] = key.split('|||')
      const pa = (single.get(a) || 0) / tickets
      const pb = (single.get(b) || 0) / tickets
      const pab = together / tickets
      const lift = pa * pb > 0 ? pab / (pa * pb) : 1
      return {
        a,
        b,
        together,
        lift: Math.round(lift * 100) / 100,
        hint:
          lift >= 1.3
            ? `Strong pair — offer as a combo or upsell.`
            : `Often together (${together}×) — mention at the counter.`,
      }
    })
    .filter((r) => r.together >= 2)
    .sort((x, y) => y.together - x.together || y.lift - x.lift)
    .slice(0, 8)
}

export function reviewIntelligence(reviews: CustomerReview[]): ReviewIntel[] {
  return reviews.map((r) => {
    const text = [r.smileNote, r.itemsOther, r.wantOther].filter(Boolean).join(' ')
    const lang = r.lang === 'en' || r.lang === 'de' ? r.lang : detectLanguage(text)
    const sent = analyzeSentiment(text, r.overallRating || r.foodRating)
    return { id: r.id, lang, sentiment: sent.label, score: sent.score }
  })
}

export function businessHealthScore(input: {
  orders: StallOrder[]
  menu: MenuItem[]
  reviews?: CustomerReview[]
  lowStockCount?: number
}): HealthScore {
  const factors: HealthScore['factors'] = []
  let score = 55

  const profits = itemProfitability(input.orders, input.menu)
  const totalProfit = profits.reduce((s, p) => s + p.profit, 0)
  const totalRev = profits.reduce((s, p) => s + p.revenue, 0)
  const margin = totalRev > 0 ? totalProfit / totalRev : 0
  if (totalRev > 0) {
    const impact = Math.round((margin - 0.45) * 40)
    score += impact
    factors.push({
      label: 'Menu margin',
      impact,
      note: `${Math.round(margin * 100)}% estimated food margin`,
    })
  }

  const { slopePerDay, history } = incomeTrendForecast(input.orders)
  if (history.length >= 3) {
    const impact = Math.max(-12, Math.min(12, Math.round(slopePerDay / 3)))
    score += impact
    factors.push({
      label: 'Income trend',
      impact,
      note: slopePerDay >= 0 ? `+€${slopePerDay}/day` : `€${slopePerDay}/day`,
    })
  }

  const sold = completed(input.orders).length
  if (sold >= 20) {
    score += 8
    factors.push({ label: 'Sales volume', impact: 8, note: `${sold} completed tickets` })
  } else if (sold >= 5) {
    score += 3
    factors.push({ label: 'Sales volume', impact: 3, note: `${sold} tickets (building)` })
  } else {
    score -= 5
    factors.push({ label: 'Sales volume', impact: -5, note: 'Few POS sales yet' })
  }

  const revs = input.reviews || []
  if (revs.length) {
    const avg =
      revs.reduce((s, r) => s + (r.overallRating || r.foodRating || 0), 0) / revs.length
    const impact = Math.round((avg - 3.5) * 8)
    score += impact
    factors.push({
      label: 'Customer reviews',
      impact,
      note: `${avg.toFixed(1)}★ from ${revs.length} reviews`,
    })
  }

  const low = input.lowStockCount || 0
  if (low > 0) {
    const impact = -Math.min(15, low * 3)
    score += impact
    factors.push({ label: 'Stock risk', impact, note: `${low} low-stock items` })
  } else {
    score += 4
    factors.push({ label: 'Stock risk', impact: 4, note: 'No low-stock alerts' })
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  const grade: HealthScore['grade'] =
    score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F'

  return { score, grade, factors: factors.sort((a, b) => b.impact - a.impact) }
}

export const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
