import type { EventMetrics } from '../types'
import type { WeatherTag } from './extrasStore'

export interface SeasonPair {
  key: string
  location: string
  name: string
  yearA: number
  yearB: number
  a: EventMetrics | null
  b: EventMetrics | null
  incomeDelta: number
  profitDelta: number
  perDayDelta: number
}

export interface WeatherCompare {
  tag: WeatherTag
  events: number
  avgIncomePerDay: number
  avgMargin: number
  avgProfit: number
}

function yearOf(iso: string | null): number | null {
  if (!iso || iso.length < 4) return null
  const y = Number(iso.slice(0, 4))
  return Number.isFinite(y) ? y : null
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** Pair same location (+ similar name) across years for season compare. */
export function seasonPairs(byEvent: EventMetrics[]): SeasonPair[] {
  const groups = new Map<string, EventMetrics[]>()
  for (const e of byEvent) {
    if (!e.startDate) continue
    const key = `${e.location.trim().toLowerCase()}|${e.name.trim().toLowerCase()}`
    const list = groups.get(key) || []
    list.push(e)
    groups.set(key, list)
  }

  const pairs: SeasonPair[] = []
  for (const [key, list] of groups) {
    const byYear = new Map<number, EventMetrics>()
    for (const e of list) {
      const y = yearOf(e.startDate)
      if (y == null) continue
      const prev = byYear.get(y)
      if (!prev || (e.income || 0) > (prev.income || 0)) byYear.set(y, e)
    }
    const years = [...byYear.keys()].sort()
    if (years.length < 2) {
      // Still surface single-year rows so UI can say "waiting for prior year"
      if (years.length === 1) {
        const y = years[0]
        const e = byYear.get(y)!
        pairs.push({
          key,
          location: e.location,
          name: e.name,
          yearA: y - 1,
          yearB: y,
          a: null,
          b: e,
          incomeDelta: 0,
          profitDelta: 0,
          perDayDelta: 0,
        })
      }
      continue
    }
    for (let i = 1; i < years.length; i++) {
      const yearA = years[i - 1]
      const yearB = years[i]
      const a = byYear.get(yearA)!
      const b = byYear.get(yearB)!
      pairs.push({
        key: `${key}|${yearA}-${yearB}`,
        location: b.location,
        name: b.name,
        yearA,
        yearB,
        a,
        b,
        incomeDelta: round2(b.income - a.income),
        profitDelta: round2(b.profit - a.profit),
        perDayDelta: round2(b.incomePerDay - a.incomePerDay),
      })
    }
  }

  return pairs.sort((x, y) => y.yearB - x.yearB || x.location.localeCompare(y.location))
}

const WEATHER_BUCKETS: Exclude<WeatherTag, ''>[] = [
  'sunny',
  'good',
  'windy',
  'rainy',
  'mixed',
]

export function weatherCompare(
  byEvent: EventMetrics[],
  weather: Record<string, WeatherTag>,
): WeatherCompare[] {
  const buckets = Object.fromEntries(WEATHER_BUCKETS.map((t) => [t, [] as EventMetrics[]])) as Record<
    Exclude<WeatherTag, ''>,
    EventMetrics[]
  >
  for (const e of byEvent) {
    const tag = weather[e.id]
    if (tag && tag in buckets) buckets[tag].push(e)
  }
  return WEATHER_BUCKETS.map((tag) => {
    const list = buckets[tag]
    const days = list.reduce((s, e) => s + (e.days || 1), 0) || 1
    const income = list.reduce((s, e) => s + e.income, 0)
    const profit = list.reduce((s, e) => s + e.profit, 0)
    const margin =
      list.length === 0 ? 0 : list.reduce((s, e) => s + e.margin, 0) / list.length
    return {
      tag,
      events: list.length,
      avgIncomePerDay: round2(income / days),
      avgMargin: round2(margin),
      avgProfit: round2(list.length ? profit / list.length : 0),
    }
  })
}
