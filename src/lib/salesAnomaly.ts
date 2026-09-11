import { germanyParts, germanyTodayYmd, germanyYmd } from './germanyTime'
import { orderTotal, type StallOrder } from './stallOps'

export interface SalesCrashAlert {
  kind: 'sales_crash'
  severity: 'warn' | 'critical'
  message: string
  meta: {
    todayHourly: number
    typicalHourly: number
    ratio: number
    hour: number
  }
}

function completedToday(orders: StallOrder[], day: string): StallOrder[] {
  return orders.filter((o) => {
    if (o.status !== 'completed' || o.voided) return false
    return germanyYmd(new Date(o.completedAt || o.createdAt)) === day
  })
}

/** Revenue in a Berlin wall-clock hour window for one calendar day. */
function revenueInHour(orders: StallOrder[], day: string, hour: number): number {
  let sum = 0
  for (const o of orders) {
    if (o.status !== 'completed' || o.voided) continue
    const when = new Date(o.completedAt || o.createdAt)
    if (germanyYmd(when) !== day) continue
    if (germanyParts(when).hour !== hour) continue
    sum += orderTotal(o.lines)
  }
  return Math.round(sum * 100) / 100
}

/**
 * Mid-day sales crash: last ~90 minutes underperform vs same weekday history.
 * Only fires during typical stall hours (10–19 Berlin) with enough history.
 */
export function detectMidDaySalesCrash(
  orders: StallOrder[],
  now = new Date(),
): SalesCrashAlert | null {
  const parts = germanyParts(now)
  const hour = parts.hour
  if (hour < 10 || hour > 19) return null

  const today = germanyTodayYmd(now)
  const todayOrders = completedToday(orders, today)
  if (todayOrders.length < 2) return null

  const windowHours = [hour - 1, hour].filter((h) => h >= 9)
  const todayWindow = windowHours.reduce(
    (s, h) => s + revenueInHour(orders, today, h),
    0,
  )

  // Typical: same Berlin weekday, same hours, last 8 matching days (exclude today).
  const byDay = new Map<string, number>()
  for (const o of orders) {
    if (o.status !== 'completed' || o.voided) continue
    const when = new Date(o.completedAt || o.createdAt)
    const day = germanyYmd(when)
    if (day === today) continue
    const p = germanyParts(when)
    // JS getUTCDay via germanyParts — use weekday from en-GB parts? germanyParts doesn't have weekday.
    // Compare using Date in Berlin via Intl.
    const wd = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      weekday: 'short',
    }).format(when)
    const todayWd = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      weekday: 'short',
    }).format(now)
    if (wd !== todayWd) continue
    if (!windowHours.includes(p.hour)) continue
    byDay.set(day, (byDay.get(day) || 0) + orderTotal(o.lines))
  }

  const samples = [...byDay.values()].sort((a, b) => b - a).slice(0, 8)
  if (samples.length < 2) return null
  const typical =
    samples.reduce((s, n) => s + n, 0) / samples.length
  if (typical < 40) return null // quiet stalls — skip noise

  const ratio = todayWindow / typical
  if (ratio >= 0.45) return null

  const severity = ratio < 0.25 ? 'critical' : 'warn'
  return {
    kind: 'sales_crash',
    severity,
    message:
      severity === 'critical'
        ? `Sales crash: last ~2h only €${todayWindow.toFixed(0)} vs typical €${typical.toFixed(0)} for this weekday (${Math.round(ratio * 100)}%).`
        : `Sales soft: last ~2h €${todayWindow.toFixed(0)} vs typical €${typical.toFixed(0)} (${Math.round(ratio * 100)}% of usual).`,
    meta: {
      todayHourly: todayWindow,
      typicalHourly: Math.round(typical * 100) / 100,
      ratio: Math.round(ratio * 100) / 100,
      hour,
    },
  }
}

/** Compact sales facts for AI “why was Saturday slow?” */
export function buildSalesAiContext(orders: StallOrder[], now = new Date()): string {
  const completed = orders.filter((o) => o.status === 'completed' && !o.voided)
  const byDow = new Map<string, { days: Set<string>; revenue: number; orders: number }>()
  const byDay = new Map<string, number>()

  for (const o of completed) {
    const when = new Date(o.completedAt || o.createdAt)
    const day = germanyYmd(when)
    const rev = orderTotal(o.lines)
    byDay.set(day, (byDay.get(day) || 0) + rev)
    const wd = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      weekday: 'long',
    }).format(when)
    const slot = byDow.get(wd) || { days: new Set<string>(), revenue: 0, orders: 0 }
    slot.days.add(day)
    slot.revenue += rev
    slot.orders += 1
    byDow.set(wd, slot)
  }

  const lines: string[] = ['Live POS sales context (Germany time):']
  for (const wd of [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ]) {
    const s = byDow.get(wd)
    if (!s || !s.days.size) {
      lines.push(`${wd}: no completed sales logged`)
      continue
    }
    const avg = s.revenue / s.days.size
    lines.push(
      `${wd}: ${s.days.size} day(s), ${s.orders} orders, €${s.revenue.toFixed(0)} total, €${avg.toFixed(0)}/day avg`,
    )
  }

  const recent = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10)
  if (recent.length) {
    lines.push('Recent days:')
    for (const [d, rev] of recent) {
      lines.push(`  ${d}: €${rev.toFixed(0)}`)
    }
  }

  const crash = detectMidDaySalesCrash(orders, now)
  if (crash) lines.push(`Active alert: ${crash.message}`)

  lines.push(
    'Answer why a day (esp. Saturday) may have been slow using only this data + stall common sense (weather, location, fee, prep). Be brief.',
  )
  return lines.join('\n')
}
