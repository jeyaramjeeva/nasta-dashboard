/** Catch-up for stall E012 (Flohmarkt): delivery stamps + sold prices. */

export const E012_EVENT_ID = 'E012'
export const E012_CATCHUP_LAG_MS = 5 * 60 * 1000

export const E012_LINE_PRICES: Record<string, number> = {
  'masala-dosa': 6,
  'cheese-masala-dosa': 7,
  'masala-chai': 2,
  'mango-lassi': 3,
  'sambar-idli': 6,
}

export type RepairOrderLine = {
  menuItemId?: string
  price?: number
  qty?: number
  deliveredQty?: number
  name?: string
  drink?: string
}

export type RepairOrder = {
  id?: string
  eventId?: string
  status?: string
  voided?: boolean
  createdAt?: string
  completedAt?: string
  paidAt?: string
  paid?: number
  tip?: number
  change?: number
  payMethod?: string
  lines?: RepairOrderLine[]
  updatedAt?: string
}

type MenuRow = { id?: string; price?: number }

export type RepairOps = {
  orders?: RepairOrder[]
  eventMenus?: Record<string, MenuRow[]>
  eventPrices?: Record<string, Record<string, { price?: number }>>
  eventMenusRev?: Record<string, number>
  e012CatchupV1?: string
}

function germanyYmd(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function lineTotal(lines: RepairOrderLine[] | undefined): number {
  return (
    Math.round(
      (lines || []).reduce(
        (s, l) => s + (Number(l.price) || 0) * (Number(l.qty) || 0),
        0,
      ) * 100,
    ) / 100
  )
}

export function stampTakenPlus5(createdAt: string | undefined): string {
  const taken = Date.parse(String(createdAt || ''))
  if (!Number.isFinite(taken)) return new Date().toISOString()
  return new Date(taken + E012_CATCHUP_LAG_MS).toISOString()
}

function retargetLines(lines: RepairOrderLine[] | undefined): RepairOrderLine[] {
  return (lines || []).map((l) => {
    const id = String(l.menuItemId || '')
    const next = E012_LINE_PRICES[id]
    if (next == null) return { ...l }
    return { ...l, price: next }
  })
}

export function repairE012Catchup<T extends RepairOps>(ops: T, now = new Date()): {
  next: T
  summary: {
    e012: number
    completedNow: number
    stampsFixed: number
    pricesFixed: number
    catalogTouched: boolean
    changed: boolean
    skipped: boolean
    flohmarktMasala: number | undefined
    flohmarktLassi: number | undefined
  }
} {
  const emptySummary = {
    e012: 0,
    completedNow: 0,
    stampsFixed: 0,
    pricesFixed: 0,
    catalogTouched: false,
    changed: false,
    skipped: true,
    flohmarktMasala: ops.eventMenus?.Flohmarkt?.find((m) => m.id === 'masala-dosa')?.price,
    flohmarktLassi: ops.eventMenus?.Flohmarkt?.find((m) => m.id === 'mango-lassi')?.price,
  }
  if (ops.e012CatchupV1) {
    return { next: ops, summary: emptySummary }
  }

  const nowIso = now.toISOString()
  const orders = Array.isArray(ops.orders) ? ops.orders : []
  let completedNow = 0
  let stampsFixed = 0
  let pricesFixed = 0
  let e012 = 0

  const nextOrders = orders.map((o) => {
    if (String(o.eventId || '').trim() !== E012_EVENT_ID || o.voided) return o
    e012 += 1
    const oldLines = o.lines || []
    const lines = retargetLines(oldLines).map((l) => ({
      ...l,
      deliveredQty: Math.max(0, Number(l.qty) || 0),
    }))
    const priceChanged = lines.some(
      (l, i) => Number(l.price) !== Number(oldLines[i]?.price),
    )
    if (priceChanged) pricesFixed += 1
    const total = lineTotal(lines)
    const oldTotal = lineTotal(oldLines)
    const paidWasExact =
      o.paid == null || Math.abs(Number(o.paid) - oldTotal) < 0.02
    const paid = paidWasExact ? total : Number(o.paid)
    const tip = Math.max(0, Number(o.tip) || 0)
    const doneAt = stampTakenPlus5(o.createdAt)
    const takenDay = germanyYmd(o.createdAt)
    const late = Boolean(takenDay && takenDay !== germanyYmd(now.toISOString()))
    const needsComplete = o.status === 'pending' && late
    const needsStampFix =
      o.status === 'completed' &&
      (!o.completedAt || germanyYmd(o.completedAt) !== germanyYmd(o.createdAt))
    if (needsComplete) completedNow += 1
    if (needsStampFix) stampsFixed += 1
    if (!needsComplete && !needsStampFix && !priceChanged) return o
    return {
      ...o,
      lines,
      status: needsComplete || o.status === 'completed' ? 'completed' : o.status,
      completedAt: needsComplete || needsStampFix ? doneAt : o.completedAt,
      paid: needsComplete || o.status === 'completed' ? paid : o.paid,
      tip: tip > 0 ? tip : undefined,
      change:
        needsComplete || o.status === 'completed'
          ? Math.round((paid - total - tip) * 100) / 100
          : o.change,
      payMethod:
        needsComplete || o.status === 'completed'
          ? o.payMethod === 'paypal'
            ? 'paypal'
            : 'cash'
          : o.payMethod,
      paidAt: needsComplete || needsStampFix ? doneAt : o.paidAt || doneAt,
      updatedAt: nowIso,
    }
  })

  const floh = ops.eventMenus?.Flohmarkt || []
  return {
    next: {
      ...ops,
      orders: nextOrders,
      e012CatchupV1: nowIso,
    } as T,
    summary: {
      e012,
      completedNow,
      stampsFixed,
      pricesFixed,
      catalogTouched: false,
      changed: true,
      skipped: false,
      flohmarktMasala: floh.find((m) => m.id === 'masala-dosa')?.price,
      flohmarktLassi: floh.find((m) => m.id === 'mango-lassi')?.price,
    },
  }
}
