import type {
  EventForecast,
  EventMetrics,
  Snapshot,
} from '../types'

const GROCERY_PER_DAY: Record<string, number> = {
  Flohmarkt: 125,
  'Street Festival': 116.67,
  'Gourmet Festival': 116.67,
}

export function forecastEvent(
  byEventType: {
    type: string
    incomePerDay: number
    count: number
    avgGroceryPerDay: number
    avgFee: number
    avgTransport: number
  }[],
  type: string,
  days: number,
): EventForecast {
  const bench = byEventType.find((t) => t.type === type)
  const incomePerDay = bench?.incomePerDay || 0
  const expectedIncome = round2(incomePerDay * days)
  const groceryBudget = round2(
    (bench?.avgGroceryPerDay || GROCERY_PER_DAY[type] || 120) * days,
  )
  const feeEstimate = round2(bench?.avgFee || 0)
  const transportEstimate = round2((bench?.avgTransport || 0) * Math.max(days / 3, 1))
  const breakEven = round2(groceryBudget + feeEstimate + transportEstimate)
  const expectedNet = round2(expectedIncome - breakEven)

  return {
    type,
    days,
    sampleSize: bench?.count || 0,
    expectedIncome,
    incomePerDay: round2(incomePerDay),
    groceryBudget,
    feeEstimate,
    transportEstimate,
    expectedNet,
    breakEven,
  }
}

export function breakEvenSeries(event: EventMetrics) {
  return [
    { name: 'Fee', value: event.fee },
    { name: 'Grocery', value: event.grocery },
    { name: 'Transport', value: event.transport },
    { name: 'Income', value: event.income },
  ]
}

/** Operating costs used for break-even line. */
export function operatingCosts(e: EventMetrics) {
  return round2(e.fee + e.grocery + e.transport)
}

export function categorySpendForEvent(
  snapshot: Snapshot,
  eventId: string,
  category: string,
) {
  return Math.abs(
    snapshot.transactions
      .filter(
        (t) =>
          t.eventId === eventId &&
          t.type === 'Expense' &&
          t.category === category,
      )
      .reduce((s, t) => s + t.amount, 0),
  )
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
