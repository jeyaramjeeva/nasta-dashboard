import { countCash, ledgerBalance } from './cash'
import {
  findDuplicateExpenses,
  formatDuplicateAlert,
} from './duplicateExpenses'
import { categorySpendForEvent } from './insights'
import type {
  DashboardMetrics,
  EventMetrics,
  LocationScore,
  MetricsFilter,
  PartnerRow,
  SettlementPlan,
  SmartAlert,
  Snapshot,
} from '../types'

const PARTNER_OWED_THRESHOLD = 100

function isSetupEventId(eventId: string): boolean {
  return eventId.trim().toLowerCase() === 'setup'
}

function isCompletedStatus(status: string | undefined | null): boolean {
  return (status || '').trim().toLowerCase() === 'completed'
}

export function computeMetrics(
  snapshot: Snapshot,
  filter: MetricsFilter = {},
): DashboardMetrics {
  const months = filter.months?.length ? new Set(filter.months) : null
  const eventTypes = filter.eventTypes?.length ? new Set(filter.eventTypes) : null
  const categoryFilter = filter.category || null
  const statusFilter =
    filter.status && filter.status !== 'all' ? filter.status : null

  const eventById = new Map(snapshot.events.map((e) => [e.id, e]))

  const events = snapshot.events.filter((e) => {
    if (eventTypes && !eventTypes.has(e.name)) return false
    if (months && e.month && !months.has(e.month)) return false
    if (statusFilter === 'completed' && !isCompletedStatus(e.status)) return false
    if (statusFilter === 'upcoming' && isCompletedStatus(e.status)) return false
    return true
  })

  /**
   * Type filter → only those events (never shared Setup).
   * Status = completed → completed stalls + Setup (sunk costs so far), not upcoming.
   * Status = upcoming → upcoming stalls only.
   */
  const matchesEventFilter = (eventId: string) => {
    if (eventTypes) {
      const ev = eventById.get(eventId)
      if (!ev || !eventTypes.has(ev.name)) return false
    }
    if (statusFilter === 'completed') {
      // Keep Setup in "completed so far" books; drop only upcoming stalls.
      if (isSetupEventId(eventId)) return true
      const ev = eventById.get(eventId)
      return Boolean(ev && isCompletedStatus(ev.status))
    }
    if (statusFilter === 'upcoming') {
      if (isSetupEventId(eventId)) return false
      const ev = eventById.get(eventId)
      return Boolean(ev && !isCompletedStatus(ev.status))
    }
    return true
  }

  const transactions = snapshot.transactions.filter((t) => {
    if (months) {
      const m =
        t.month || (t.date && t.date.length >= 7 ? t.date.slice(0, 7) : null)
      if (!m || !months.has(m)) return false
    }
    if (!matchesEventFilter(t.eventId)) return false
    if (categoryFilter && t.type === 'Expense' && t.category !== categoryFilter) {
      return false
    }
    return true
  })

  const { cashBox, denominations, partners } = snapshot
  const paypalBalance = snapshot.paypalBalance || 0

  const totalIncome = transactions
    .filter((t) => t.type === 'Income')
    .reduce((s, t) => s + t.amount, 0)

  const expenseTx = snapshot.transactions.filter((t) => {
    if (t.type !== 'Expense') return false
    if (months) {
      const m =
        t.month || (t.date && t.date.length >= 7 ? t.date.slice(0, 7) : null)
      if (!m || !months.has(m)) return false
    }
    if (!matchesEventFilter(t.eventId)) return false
    if (categoryFilter && t.category !== categoryFilter) return false
    return true
  })

  const totalExpense = round2(
    expenseTx.reduce((s, t) => s + Math.abs(t.amount), 0),
  )
  const net = totalIncome - totalExpense
  const profitMargin = totalExpense > 0 ? totalIncome / totalExpense : 0

  const settlementsPaid = round2(
    transactions
      .filter((t) => t.type === 'Settlement')
      .reduce((s, t) => s + Math.abs(t.amount), 0),
  )

  const partnerPeople = partners.filter((p) => !['Box', 'Paypal', 'PayPal'].includes(p.name))
  const partnerOwed = partnerPeople.reduce((s, p) => s + Math.max(0, p.balance), 0)

  const eventsCompleted = events.filter((e) => isCompletedStatus(e.status)).length
  const eventsUpcoming = events.filter((e) => !isCompletedStatus(e.status)).length

  const monthMap = new Map<string, { income: number; expense: number }>()
  for (const t of snapshot.transactions) {
    if (!matchesEventFilter(t.eventId)) continue
    if (categoryFilter && t.type === 'Expense' && t.category !== categoryFilter) continue
    if (categoryFilter && t.type === 'Income') continue
    const month =
      t.month || (t.date && t.date.length >= 7 ? t.date.slice(0, 7) : null) || 'Unknown'
    if (months && !months.has(month)) continue
    if (!monthMap.has(month)) monthMap.set(month, { income: 0, expense: 0 })
    const row = monthMap.get(month)!
    if (t.type === 'Income') row.income += t.amount
    if (t.type === 'Expense') row.expense += Math.abs(t.amount)
  }
  const monthly = [...monthMap.entries()]
    .filter(([m]) => m !== 'Unknown')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      income: round2(v.income),
      expense: round2(v.expense),
      net: round2(v.income - v.expense),
    }))

  const catMap = new Map<string, number>()
  for (const t of expenseTx) {
    const cat = t.category || 'Other'
    if (cat === 'Income' || cat === 'Settlement') continue
    catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(t.amount))
  }
  const byCategory = [...catMap.entries()]
    .map(([category, amount]) => ({ category, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount)

  const byEvent: EventMetrics[] = events.map((e) => {
    const income = snapshot.transactions
      .filter((t) => t.eventId === e.id && t.type === 'Income')
      .reduce((s, t) => s + t.amount, 0)
    const expense = Math.abs(
      snapshot.transactions
        .filter((t) => t.eventId === e.id && t.type === 'Expense')
        .reduce((s, t) => s + t.amount, 0),
    )
    const days = e.days || 1
    const fee = Math.abs(
      snapshot.transactions
        .filter(
          (t) =>
            t.eventId === e.id &&
            t.type === 'Expense' &&
            (t.category === 'Stall Fee' || t.description.toLowerCase().includes('fee')),
        )
        .reduce((s, t) => s + t.amount, 0),
    )
    const grocery = categorySpendForEvent(snapshot, e.id, 'Grocery')
    const transport = categorySpendForEvent(snapshot, e.id, 'Transport')
    const feeFinal = round2(fee || e.fee)
    const breakEven = round2(feeFinal + grocery + transport)
    const profit = round2(income - expense)
    return {
      id: e.id,
      name: e.name,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      days: e.days,
      status: e.status,
      income: round2(income),
      expense: round2(expense),
      profit,
      incomePerDay: round2(income / days),
      fee: feeFinal,
      grocery: round2(grocery),
      transport: round2(transport),
      otherExpense: round2(Math.max(0, expense - feeFinal - grocery - transport)),
      breakEven,
      operatingProfit: round2(income - breakEven),
      margin: income > 0 ? round2(profit / income) : 0,
    }
  })

  const locMap = new Map<
    string,
    { income: number; expense: number; days: number; events: string[] }
  >()
  for (const e of byEvent) {
    if (e.status !== 'Completed' && e.income <= 0) continue
    const loc = e.location || 'Unknown'
    if (!locMap.has(loc)) locMap.set(loc, { income: 0, expense: 0, days: 0, events: [] })
    const row = locMap.get(loc)!
    row.income += e.income
    row.expense += e.expense
    row.days += e.days || 0
    row.events.push(e.id)
  }
  const byLocation: LocationScore[] = [...locMap.entries()]
    .map(([location, v]) => {
      const profit = v.income - v.expense
      return {
        location,
        income: round2(v.income),
        expense: round2(v.expense),
        profit: round2(profit),
        days: v.days,
        incomePerDay: v.days > 0 ? round2(v.income / v.days) : 0,
        margin: v.income > 0 ? round2(profit / v.income) : 0,
        events: v.events,
        rank: 0,
      }
    })
    .sort((a, b) => b.incomePerDay - a.incomePerDay || b.margin - a.margin)
    .map((row, i) => ({ ...row, rank: i + 1 }))

  const typeMap = new Map<
    string,
    {
      income: number
      days: number
      count: number
      grocery: number
      fee: number
      transport: number
    }
  >()
  for (const e of byEvent) {
    if (e.status !== 'Completed') continue
    if (!typeMap.has(e.name)) {
      typeMap.set(e.name, {
        income: 0,
        days: 0,
        count: 0,
        grocery: 0,
        fee: 0,
        transport: 0,
      })
    }
    const row = typeMap.get(e.name)!
    row.income += e.income
    row.days += e.days || 0
    row.count += 1
    row.grocery += e.grocery
    row.fee += e.fee
    row.transport += e.transport
  }
  const byEventType = [...typeMap.entries()]
    .map(([type, v]) => ({
      type,
      income: round2(v.income),
      days: v.days,
      incomePerDay: v.days > 0 ? round2(v.income / v.days) : 0,
      count: v.count,
      avgGroceryPerDay: v.days > 0 ? round2(v.grocery / v.days) : 0,
      avgFee: v.count > 0 ? round2(v.fee / v.count) : 0,
      avgTransport: v.count > 0 ? round2(v.transport / v.count) : 0,
    }))
    .sort((a, b) => b.incomePerDay - a.incomePerDay)

  const cashExpected = ledgerBalance(cashBox)
  const cashCounted = countCash(denominations)
  const cashWithPaypal = round2(cashCounted + paypalBalance)
  const cashMismatch = round2(cashWithPaypal - cashExpected)
  const coinReserveTotal = round2(
    snapshot.coinReserveTotal ?? countCash(snapshot.coinReserve || []),
  )
  const mainBoxTotal = round2(snapshot.mainBoxTotal ?? cashWithPaypal)
  const allBoxesTotal = round2(
    snapshot.allBoxesTotal ?? mainBoxTotal + coinReserveTotal,
  )

  const settlementPlan: SettlementPlan[] = partnerPeople
    .filter((p) => p.balance > 0.5)
    .map((p) => ({
      name: p.name,
      owed: round2(Math.max(0, p.balance)),
      shareOfTotal: 0,
      suggestedPay: round2(Math.max(0, p.balance)),
    }))
    .sort((a, b) => b.owed - a.owed)
  const settleTotal = settlementPlan.reduce((s, p) => s + p.owed, 0) || 1
  for (const p of settlementPlan) {
    p.shareOfTotal = round2(p.owed / settleTotal)
  }

  const alerts: SmartAlert[] = []
  if (partnerOwed >= PARTNER_OWED_THRESHOLD) {
    alerts.push({
      kind: 'partner_owed',
      severity: partnerOwed > 1000 ? 'critical' : 'warn',
      message: `Partners owed €${partnerOwed.toFixed(2)} (threshold €${PARTNER_OWED_THRESHOLD})`,
      meta: { amount: partnerOwed },
    })
  } else if (partnerOwed > 1) {
    alerts.push({
      kind: 'partner_owed',
      severity: 'info',
      message: `Partners still owed €${partnerOwed.toFixed(2)}`,
      meta: { amount: partnerOwed },
    })
  }

  if (Math.abs(cashMismatch) > 5) {
    alerts.push({
      kind: 'cash_mismatch',
      severity: Math.abs(cashMismatch) > 50 ? 'critical' : 'warn',
      message: `Cash mismatch €${cashMismatch.toFixed(2)} (mit PayPal €${cashWithPaypal.toFixed(2)} vs ledger €${cashExpected.toFixed(2)})`,
      meta: { diff: cashMismatch },
    })
  }

  for (const e of snapshot.events.filter((x) => x.status === 'Upcoming')) {
    const prep = snapshot.transactions.filter((t) => t.eventId === e.id).length
    if (prep === 0) {
      alerts.push({
        kind: 'upcoming_empty',
        severity: 'warn',
        message: `${e.id} ${e.name} (${e.location}) upcoming with no prep costs`,
        meta: { eventId: e.id },
      })
    }
  }

  const unpaid = snapshot.transactions.filter((t) =>
    ['unpaid', 'pending', 'open'].includes((t.status || '').toLowerCase()),
  ).length
  if (unpaid > 0) {
    alerts.push({
      kind: 'unpaid',
      severity: 'warn',
      message: `${unpaid} transaction(s) still unpaid / pending`,
      meta: { count: unpaid },
    })
  }

  if (!months && !eventTypes && !categoryFilter && net < 0) {
    alerts.push({
      kind: 'negative_net',
      severity: 'info',
      message: `Overall net still negative (€${net.toFixed(2)}) — setup not fully recovered`,
      meta: { net },
    })
  }

  const duplicateGroups = findDuplicateExpenses(expenseTx)
  if (duplicateGroups.length > 0) {
    const hitCount = duplicateGroups.reduce((s, g) => s + g.count, 0)
    alerts.push({
      kind: 'duplicate_expense',
      severity: duplicateGroups.length >= 3 || hitCount >= 6 ? 'critical' : 'warn',
      message: `Duplicate expense hunter: ${duplicateGroups.length} group(s), ${hitCount} rows with same day + person + amount`,
      meta: { groups: duplicateGroups.length, rows: hitCount },
    })
    for (const g of duplicateGroups.slice(0, 5)) {
      alerts.push({
        kind: 'duplicate_expense',
        severity: 'warn',
        message: formatDuplicateAlert(g),
        meta: {
          date: g.date,
          person: g.person,
          amount: g.amount,
          count: g.count,
        },
      })
    }
    if (duplicateGroups.length > 5) {
      alerts.push({
        kind: 'duplicate_expense',
        severity: 'info',
        message: `…and ${duplicateGroups.length - 5} more duplicate group(s)`,
        meta: { more: duplicateGroups.length - 5 },
      })
    }
  }

  return {
    totalIncome: round2(totalIncome),
    totalExpense: round2(totalExpense),
    net: round2(net),
    profitMargin: round2(profitMargin),
    settlementsPaid: round2(settlementsPaid),
    partnerOwed: round2(partnerOwed),
    eventsCompleted,
    eventsUpcoming,
    monthly,
    byCategory,
    byEvent,
    byLocation,
    byEventType,
    partners: partners as PartnerRow[],
    cashExpected,
    cashCounted,
    paypalBalance: round2(paypalBalance),
    cashWithPaypal,
    cashMismatch,
    coinReserveTotal,
    mainBoxTotal,
    allBoxesTotal,
    alerts,
    settlementPlan,
    duplicateExpenses: duplicateGroups,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
