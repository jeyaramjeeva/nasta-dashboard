import { eventCalendarDays } from './calendar'
import { germanyYmd } from './germanyTime'
import { orderTotal, type StallOrder } from './stallOps'

export type SameDayPeerEvent = {
  eventId: string
  title: string
  paidCount: number
  revenue: number
}

function saleDay(o: StallOrder): string {
  return germanyYmd(new Date(o.completedAt || o.createdAt))
}

function isTodayOrder(o: StallOrder, todayYmd: string): boolean {
  return saleDay(o) === todayYmd
}

/** Other stalls that are on the calendar today or already have tickets today. */
export function sameDayPeerEvents(opts: {
  events: { id: string; name?: string; location?: string; startDate?: string | null; endDate?: string | null; days?: number }[]
  orders: StallOrder[]
  activeEventId: string
  todayYmd: string
  labels?: Map<string, string>
}): SameDayPeerEvent[] {
  const active = String(opts.activeEventId || '').trim()
  if (!active) return []
  const todayIds = new Set<string>()
  for (const e of opts.events) {
    const id = String(e.id || '').trim()
    if (!id || id.toLowerCase() === 'setup') continue
    if (eventCalendarDays({
      startDate: e.startDate ?? null,
      endDate: e.endDate ?? null,
      days: e.days,
    }).includes(opts.todayYmd)) todayIds.add(id)
  }
  for (const o of opts.orders) {
    if (o.voided) continue
    const eid = String(o.eventId || '').trim()
    if (!eid) continue
    if (isTodayOrder(o, opts.todayYmd)) todayIds.add(eid)
  }
  todayIds.delete(active)
  const out: SameDayPeerEvent[] = []
  for (const eventId of todayIds) {
    const paid = opts.orders.filter(
      (o) =>
        !o.voided &&
        o.status === 'completed' &&
        String(o.eventId || '').trim() === eventId &&
        isTodayOrder(o, opts.todayYmd),
    )
    const ev = opts.events.find((e) => e.id === eventId)
    const title =
      opts.labels?.get(eventId) ||
      [ev?.id, ev?.location || ev?.name].filter(Boolean).join(' · ') ||
      eventId
    out.push({
      eventId,
      title,
      paidCount: paid.length,
      revenue: paid.reduce((s, o) => s + orderTotal(o.lines), 0),
    })
  }
  return out.sort((a, b) => b.paidCount - a.paidCount || a.eventId.localeCompare(b.eventId))
}
