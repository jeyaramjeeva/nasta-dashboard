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
  orderCount: number
}

export function summarizePosCashToday(
  orders: StallOrder[],
  now = new Date(),
): PosCashSummary {
  const today = germanyTodayYmd(now)
  let netIn = 0
  let paidTotal = 0
  let changeReturned = 0
  let orderCount = 0
  for (const o of orders) {
    if (o.status !== 'completed' || o.voided) continue
    const day = germanyYmd(new Date(o.completedAt || o.createdAt))
    if (day !== today) continue
    orderCount += 1
    const net = netCashIn(o)
    netIn += net
    if (o.paid != null) paidTotal += o.paid
    else paidTotal += net
    if (o.change != null && o.change > 0) changeReturned += o.change
  }
  return {
    netIn: Math.round(netIn * 100) / 100,
    paidTotal: Math.round(paidTotal * 100) / 100,
    changeReturned: Math.round(changeReturned * 100) / 100,
    orderCount,
  }
}

/** Excel physical count + today's POS net into the box. */
export function liveCashCounted(excelCounted: number, posNetIn: number): number {
  return Math.round((excelCounted + posNetIn) * 100) / 100
}
