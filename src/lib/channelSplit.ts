import type { EventMetrics, Snapshot } from '../types'

export interface ChannelSplitRow {
  type: string
  cash: number
  paypal: number
  total: number
  cashPct: number
  paypalPct: number
  events: number
}

export interface EventChannel {
  eventId: string
  type: string
  cash: number
  paypal: number
  total: number
  cashPct: number
  paypalPct: number
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** PayPal Δ from Event Cash Box; cash ≈ income − PayPal (floor 0). */
export function channelByEvent(
  snapshot: Snapshot,
  byEvent: EventMetrics[],
): EventChannel[] {
  const counts = new Map((snapshot.eventCashCounts || []).map((c) => [c.eventId, c]))
  return byEvent
    .filter((e) => e.income > 0)
    .map((e) => {
      const c = counts.get(e.id)
      let paypal = 0
      if (c) {
        paypal = Math.max(0, round2(c.afterPaypal - c.beforePaypal))
      }
      // Cap PayPal at income; remainder treated as cash
      paypal = Math.min(paypal, e.income)
      const cash = round2(Math.max(0, e.income - paypal))
      const total = round2(cash + paypal) || 1
      return {
        eventId: e.id,
        type: e.name,
        cash,
        paypal,
        total: round2(cash + paypal),
        cashPct: round2((cash / total) * 100),
        paypalPct: round2((paypal / total) * 100),
      }
    })
}

export function channelByEventType(
  snapshot: Snapshot,
  byEvent: EventMetrics[],
): ChannelSplitRow[] {
  const rows = channelByEvent(snapshot, byEvent)
  const map = new Map<string, ChannelSplitRow>()
  for (const r of rows) {
    const cur = map.get(r.type) || {
      type: r.type,
      cash: 0,
      paypal: 0,
      total: 0,
      cashPct: 0,
      paypalPct: 0,
      events: 0,
    }
    cur.cash += r.cash
    cur.paypal += r.paypal
    cur.total += r.cash + r.paypal
    cur.events += 1
    map.set(r.type, cur)
  }
  return [...map.values()]
    .map((r) => {
      const t = r.total || 1
      return {
        ...r,
        cash: round2(r.cash),
        paypal: round2(r.paypal),
        total: round2(r.total),
        cashPct: round2((r.cash / t) * 100),
        paypalPct: round2((r.paypal / t) * 100),
      }
    })
    .sort((a, b) => b.total - a.total)
}
