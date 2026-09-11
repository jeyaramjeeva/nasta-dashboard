import { germanyTodayYmd, germanyYmd } from './germanyTime'
import { orderTotal, type StallOrder } from './stallOps'

/** Net cash that stays in the box after a sale (paid − change returned). */
export function netCashIn(order: StallOrder): number {
  if (order.status !== 'completed' || order.voided) return 0
  const total = orderTotal(order.lines)
  if (order.paid != null) {
    const change =
      order.change != null
        ? order.change
        : Math.round((order.paid - total) * 100) / 100
    // Only subtract change actually returned (positive change)
    const returned = Math.max(0, change)
    return Math.round((order.paid - returned) * 100) / 100
  }
  return total
}

export interface PosCashSummary {
  /** Sum of (paid − change) for completed orders today. */
  netIn: number
  /** Sum of amounts customers handed over. */
  paidTotal: number
  /** Sum of change returned. */
  changeReturned: number
  /** Tips kept in the box today. */
  tipTotal: number
  orderCount: number
}

export function summarizePosCashToday(
  orders: StallOrder[],
  now = new Date(),
  eventId?: string,
): PosCashSummary {
  const today = germanyTodayYmd(now)
  const wantEvent = String(eventId || '').trim()
  let netIn = 0
  let paidTotal = 0
  let changeReturned = 0
  let tipTotal = 0
  let orderCount = 0
  for (const o of orders) {
    if (o.status !== 'completed' || o.voided) continue
    if (wantEvent && String(o.eventId || '').trim() !== wantEvent) continue
    const day = germanyYmd(new Date(o.completedAt || o.createdAt))
    if (day !== today) continue
    orderCount += 1
    const net = netCashIn(o)
    netIn += net
    if (o.paid != null) paidTotal += o.paid
    else paidTotal += net
    if (o.change != null && o.change > 0) changeReturned += o.change
    if (o.tip != null && o.tip > 0) tipTotal += o.tip
  }
  return {
    netIn: Math.round(netIn * 100) / 100,
    paidTotal: Math.round(paidTotal * 100) / 100,
    changeReturned: Math.round(changeReturned * 100) / 100,
    tipTotal: Math.round(tipTotal * 100) / 100,
    orderCount,
  }
}

/** Excel physical count + today's POS net into the box. */
export function liveCashCounted(excelCounted: number, posNetIn: number): number {
  return Math.round((excelCounted + posNetIn) * 100) / 100
}

export interface PayMethodSummary {
  /** Order totals paid as cash (legacy missing method counted as cash). */
  cashRevenue: number
  /** Order totals paid via PayPal. */
  paypalRevenue: number
  /** cashRevenue + paypalRevenue */
  totalRevenue: number
  cashOrders: number
  paypalOrders: number
}

/** Sum completed (non-void) order revenue by payment method. */
export function summarizePayMethods(orders: StallOrder[]): PayMethodSummary {
  let cashRevenue = 0
  let paypalRevenue = 0
  let cashOrders = 0
  let paypalOrders = 0
  for (const o of orders) {
    if (o.status !== 'completed' || o.voided) continue
    const total = Math.round(orderTotal(o.lines) * 100) / 100
    if (o.payMethod === 'paypal') {
      paypalRevenue += total
      paypalOrders += 1
    } else {
      cashRevenue += total
      cashOrders += 1
    }
  }
  const cash = Math.round(cashRevenue * 100) / 100
  const paypal = Math.round(paypalRevenue * 100) / 100
  return {
    cashRevenue: cash,
    paypalRevenue: paypal,
    totalRevenue: Math.round((cash + paypal) * 100) / 100,
    cashOrders,
    paypalOrders,
  }
}
