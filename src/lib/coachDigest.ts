/** Weekly coach digest — top wins + fixes (Monday Germany-week window). */

import type { EventMetrics } from '../types'
import {
  businessHealthScore,
  itemProfitability,
  salesHourHeatmap,
  DOW_LABELS,
} from './businessIntel'
import type { FoodMadeRow, MenuItem, StallOrder, StockItem } from './stallOps'
import { orderTotal } from './stallOps'
import { germanyParts, germanyYmd } from './germanyTime'
import { foodDaySpoilWastePct, remainingFood } from './stallRecipes'
import { isLowStock } from './stallOps'

export interface CoachBullet {
  text: string
  kind: 'win' | 'fix'
}

export interface CoachDigest {
  weekLabel: string
  fromYmd: string
  toYmd: string
  wins: CoachBullet[]
  fixes: CoachBullet[]
  copyText: string
}

/** Monday (inclusive) → Sunday of the Germany week containing `now`. */
export function germanyWeekWindow(now = new Date()): { fromYmd: string; toYmd: string; weekLabel: string } {
  const p = germanyParts(now)
  // Find Monday of this week in Berlin
  const wall = new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0))
  // JS getUTCDay: 0=Sun … use Berlin weekday via formatter
  const dowStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
  }).format(now)
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const offset = map[dowStr] ?? 0
  const monday = new Date(wall)
  monday.setUTCDate(monday.getUTCDate() - offset)
  const sunday = new Date(monday)
  sunday.setUTCDate(sunday.getUTCDate() + 6)
  const fromYmd = germanyYmd(monday)
  const toYmd = germanyYmd(sunday)
  return {
    fromYmd,
    toYmd,
    weekLabel: `Week ${fromYmd} → ${toYmd}`,
  }
}

function inWeek(iso: string | undefined, fromYmd: string, toYmd: string): boolean {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  const y = germanyYmd(d)
  return y >= fromYmd && y <= toYmd
}

export function buildWeeklyCoachDigest(opts: {
  orders: StallOrder[]
  menu: MenuItem[]
  stock: StockItem[]
  foodMade?: Record<string, Record<string, Record<string, FoodMadeRow>>>
  events?: EventMetrics[]
  lowStockCount?: number
  now?: Date
}): CoachDigest {
  const { fromYmd, toYmd, weekLabel } = germanyWeekWindow(opts.now)
  const weekOrders = opts.orders.filter(
    (o) =>
      o.status === 'completed' &&
      !o.voided &&
      inWeek(o.completedAt || o.createdAt, fromYmd, toYmd),
  )
  const revenue = weekOrders.reduce((s, o) => s + orderTotal(o.lines), 0)
  const wins: CoachBullet[] = []
  const fixes: CoachBullet[] = []

  if (weekOrders.length > 0) {
    wins.push({
      kind: 'win',
      text: `${weekOrders.length} tickets · €${revenue.toFixed(0)} POS this week`,
    })
  }

  const profits = itemProfitability(opts.orders, opts.menu)
  const top = profits.filter((p) => p.qty > 0).sort((a, b) => b.profit - a.profit)[0]
  if (top && top.profit > 0) {
    wins.push({
      kind: 'win',
      text: `Best margin plate: ${top.name} (~€${top.profit.toFixed(0)} profit)`,
    })
  }

  const heat = salesHourHeatmap(weekOrders.length ? weekOrders : opts.orders)
  let peak: { dow: number; hour: number; orders: number } | null = null
  for (const c of heat) {
    if (!peak || c.orders > peak.orders) peak = c
  }
  if (peak && peak.orders > 0) {
    wins.push({
      kind: 'win',
      text: `Peak rush: ${DOW_LABELS[peak.dow] || '?'} ${peak.hour}:00 (${peak.orders} orders)`,
    })
  }

  const completedEvents = (opts.events || []).filter(
    (e) => e.status === 'Completed' && e.margin > 0.15,
  )
  if (completedEvents[0]) {
    const e = completedEvents.sort((a, b) => b.margin - a.margin)[0]!
    wins.push({
      kind: 'win',
      text: `Strong event: ${e.location || e.name} · ${(e.margin * 100).toFixed(0)}% margin`,
    })
  }

  const health = businessHealthScore({
    orders: opts.orders,
    menu: opts.menu,
    reviews: [],
    lowStockCount: opts.lowStockCount ?? opts.stock.filter(isLowStock).length,
  })
  if (health.score < 70) {
    fixes.push({
      kind: 'fix',
      text: `Health grade ${health.grade} (${health.score}) — ${health.factors.find((f) => f.impact < 0)?.note || 'tighten costs'}`,
    })
  }

  const low = opts.stock.filter(isLowStock)
  if (low.length) {
    fixes.push({
      kind: 'fix',
      text: `Restock: ${low
        .slice(0, 3)
        .map((s) => s.name)
        .join(', ')}`,
    })
  }

  const dogs = profits.filter((p) => p.qty > 0 && p.marginPct < 20).slice(0, 2)
  for (const d of dogs) {
    fixes.push({
      kind: 'fix',
      text: `Low margin: ${d.name} (${d.marginPct.toFixed(0)}%) — raise price or cut cost`,
    })
  }

  // Spoil / leftover pressure
  if (opts.foodMade) {
    let worst: { pct: number; day: string } | null = null
    for (const days of Object.values(opts.foodMade)) {
      for (const [day, items] of Object.entries(days)) {
        if (day < fromYmd || day > toYmd) continue
        const pct = foodDaySpoilWastePct(items)
        if (pct != null && pct > 10 && (!worst || pct > worst.pct)) {
          worst = { pct, day }
        }
        for (const row of Object.values(items)) {
          const rem = remainingFood(row)
          if (rem > 0 && Number(row.made) > 0 && rem / Number(row.made) > 0.35) {
            fixes.push({
              kind: 'fix',
              text: `Leftover heavy on ${day}: ${row.name} (${rem} ${row.unit} left)`,
            })
            break
          }
        }
      }
    }
    if (worst) {
      fixes.push({
        kind: 'fix',
        text: `Spoil waste ${worst.pct}% on ${worst.day} — tighten Made next time`,
      })
    }
  }

  if (weekOrders.length === 0) {
    fixes.push({
      kind: 'fix',
      text: 'No POS completions this week — log tickets so coach tips stay sharp',
    })
  }

  const wins3 = wins.slice(0, 3)
  while (wins3.length < 3 && wins.length === 0) {
    wins3.push({ kind: 'win', text: 'Keep logging Made / Used and POS — digest fills in' })
    break
  }
  const fixes3 = fixes.slice(0, 3)
  while (fixes3.length < 3) {
    if (fixes3.length === 0) {
      fixes3.push({ kind: 'fix', text: 'Tag weather on Calendar for better Go/Skip calls' })
    } else if (fixes3.length === 1) {
      fixes3.push({ kind: 'fix', text: 'Set food costs on Menu prices for true margins' })
    } else {
      fixes3.push({ kind: 'fix', text: 'Review best-hours heatmap before next stall' })
    }
  }

  const w = wins3.slice(0, 3)
  const f = fixes3.slice(0, 3)
  const copyText = [
    `Nasta weekly coach — ${weekLabel}`,
    '',
    'Wins:',
    ...w.map((x, i) => `${i + 1}. ${x.text}`),
    '',
    'Fixes:',
    ...f.map((x, i) => `${i + 1}. ${x.text}`),
  ].join('\n')

  return { weekLabel, fromYmd, toYmd, wins: w, fixes: f, copyText }
}
