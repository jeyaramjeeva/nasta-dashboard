import { impactsMetrics } from './eventStatus'
import type { EventMetrics } from '../types'
import type { ItemSalesRow } from './salesStats'

export type StallCity = 'Köln' | 'Bonn' | 'Other'

export type StallEvidenceRow = {
  id: string
  name: string
  location: string
  city: StallCity
  days: number
  startDate: string | null
  sales: number
  salesPerDay: number
  grocery: number
  foodShare: number | null
  platesHint: number | null
}

export type StallLocationRow = {
  location: string
  city: StallCity
  events: number
  days: number
  sales: number
  salesPerDay: number
  grocery: number
}

export type StallEvidence = {
  eventCount: number
  soldEvents: StallEvidenceRow[]
  byLocation: StallLocationRow[]
  byCity: { city: StallCity; events: number; days: number; sales: number; salesPerDay: number }[]
  totalSales: number
  totalDays: number
  salesPerDay: number
  grocery: number
  foodShare: number | null
  bestLocation: StallLocationRow | null
  koeln: { events: number; sales: number; salesPerDay: number } | null
  bonn: { events: number; sales: number; salesPerDay: number } | null
  topItems: ItemSalesRow[]
}

function cityOf(location: string): StallCity {
  const t = location.toLowerCase()
  if (/\bbonn\b|beuel|godesberg|poppelsdorf|endenich|kessenich/.test(t)) return 'Bonn'
  if (/\bköln\b|\bkoeln\b|\bcologne\b|wilhelmplatz|südbrücke|sudbrucke|old town/.test(t)) return 'Köln'
  return 'Other'
}

function isSetup(id: string) {
  return id.trim().toLowerCase() === 'setup'
}

/** Restaurant-relevant stall facts: sales + location + food cost. Stall fees are ignored. */
export function buildStallEvidence(
  events: EventMetrics[],
  topItems: ItemSalesRow[] = [],
): StallEvidence {
  const soldEvents = events
    .filter((e) => !isSetup(e.id) && impactsMetrics(e.status) && e.income > 0)
    .map((e): StallEvidenceRow => {
      const grocery = Math.max(0, e.grocery || 0)
      const sales = e.income
      return {
        id: e.id,
        name: e.name,
        location: e.location || 'Unknown',
        city: cityOf(e.location || ''),
        days: Math.max(1, e.days || 1),
        startDate: e.startDate,
        sales,
        salesPerDay: sales / Math.max(1, e.days || 1),
        grocery,
        foodShare: sales > 0 ? grocery / sales : null,
        platesHint: null,
      }
    })
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '') || b.sales - a.sales)

  const locMap = new Map<string, StallLocationRow>()
  for (const e of soldEvents) {
    const key = e.location
    const cur = locMap.get(key) || {
      location: e.location,
      city: e.city,
      events: 0,
      days: 0,
      sales: 0,
      salesPerDay: 0,
      grocery: 0,
    }
    cur.events += 1
    cur.days += e.days
    cur.sales += e.sales
    cur.grocery += e.grocery
    locMap.set(key, cur)
  }
  const byLocation = [...locMap.values()]
    .map((r) => ({ ...r, salesPerDay: r.days > 0 ? r.sales / r.days : 0 }))
    .sort((a, b) => b.salesPerDay - a.salesPerDay || b.sales - a.sales)

  const cityMap = new Map<StallCity, { events: number; days: number; sales: number }>()
  for (const e of soldEvents) {
    const cur = cityMap.get(e.city) || { events: 0, days: 0, sales: 0 }
    cur.events += 1
    cur.days += e.days
    cur.sales += e.sales
    cityMap.set(e.city, cur)
  }
  const byCity = (['Köln', 'Bonn', 'Other'] as StallCity[]).flatMap((city) => {
    const v = cityMap.get(city)
    if (!v) return []
    return [{ city, ...v, salesPerDay: v.days > 0 ? v.sales / v.days : 0 }]
  })

  const totalSales = soldEvents.reduce((s, e) => s + e.sales, 0)
  const totalDays = soldEvents.reduce((s, e) => s + e.days, 0)
  const grocery = soldEvents.reduce((s, e) => s + e.grocery, 0)
  const koeln = byCity.find((c) => c.city === 'Köln')
  const bonn = byCity.find((c) => c.city === 'Bonn')

  return {
    eventCount: soldEvents.length,
    soldEvents,
    byLocation,
    byCity,
    totalSales,
    totalDays,
    salesPerDay: totalDays > 0 ? totalSales / totalDays : 0,
    grocery,
    foodShare: totalSales > 0 ? grocery / totalSales : null,
    bestLocation: byLocation[0] ?? null,
    koeln: koeln ? { events: koeln.events, sales: koeln.sales, salesPerDay: koeln.salesPerDay } : null,
    bonn: bonn ? { events: bonn.events, sales: bonn.sales, salesPerDay: bonn.salesPerDay } : null,
    topItems: topItems.slice(0, 8),
  }
}
