import {
  CONCEPTS,
  OBSERVED_PRICES,
  VENUES,
  densityPer10k,
  isCoreIndian,
  type City,
  type Venue,
} from './marketAnalysis'

export type CityMode = City | 'All' | 'Compare'

export function venuesIn(city: CityMode): Venue[] {
  if (city === 'All' || city === 'Compare') return VENUES.filter(isCoreIndian)
  return VENUES.filter((v) => isCoreIndian(v) && v.city === city)
}

export function isVegFocused(v: Venue) {
  return /100% vegetarian|Mostly vegetarian/.test(v.veg)
}

export function isVeganFocused(v: Venue) {
  return /100% vegan|Vegan-focused/.test(v.vegan)
}

export function isVegFriendly(v: Venue) {
  return /vegetarian|vegan/i.test(`${v.veg} ${v.vegan}`) && v.veg !== 'Not verified'
}

export function isSouth(v: Venue) {
  return v.dosa === true || v.cuisine.some((c) => /South|Tamil|Kerala/.test(c))
}

export function cuisineBuckets(v: Venue): string[] {
  const text = `${v.cuisine.join(' ')} ${v.distinctive}`.toLowerCase()
  const out: string[] = []
  if (/south|tamil|kerala|dosa|idli|sambar/.test(text) || v.dosa === true) out.push('South Indian')
  if (/north/.test(text)) out.push('North Indian')
  if (/punjab/.test(text)) out.push('Punjabi')
  if (/gujarat/.test(text)) out.push('Gujarati')
  if (/bengal/.test(text)) out.push('Bengali')
  if (v.streetFood || /street/.test(text)) out.push('Street food')
  if (/fusion|crossover/.test(text)) out.push('Fusion')
  if (!out.length) out.push('Indian (unspecified / North default)')
  return out
}

function avg(nums: number[]) {
  if (!nums.length) return null
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

function median(nums: number[]) {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function buildKpis(city: CityMode) {
  const list = venuesIn(city === 'Compare' ? 'All' : city)
  const koeln = list.filter((v) => v.city === 'Köln')
  const bonn = list.filter((v) => v.city === 'Bonn')
  const open = list.filter((v) => v.status === 'Open')
  const closed = list.filter((v) => v.status === 'Permanently closed')
  const unknown = list.filter((v) => v.status === 'Unknown')
  const rated = list.filter((v) => v.google.rating != null)
  const reviewed = list.filter((v) => v.google.reviewCount != null)
  const ratings = rated.map((v) => v.google.rating as number)
  const reviews = reviewed.map((v) => v.google.reviewCount as number)
  const prices = OBSERVED_PRICES.filter((p) => city === 'All' || city === 'Compare' || p.city === city).map((p) => p.eur)

  return {
    total: list.length,
    koeln: koeln.length,
    bonn: bonn.length,
    open: open.length,
    closed: closed.length,
    unknown: unknown.length,
    vegFocused: list.filter(isVegFocused).length,
    veganFocused: list.filter(isVeganFocused).length,
    vegFriendly: list.filter(isVegFriendly).length,
    south: list.filter(isSouth).length,
    street: list.filter((v) => v.streetFood).length,
    thali: list.filter((v) => v.thali === true).length,
    buffet: list.filter((v) => v.buffet === true).length,
    delivery: list.filter((v) => v.delivery === true).length,
    avgRating: avg(ratings),
    ratedCount: rated.length,
    totalReviews: reviews.reduce((s, n) => s + n, 0),
    reviewedCount: reviewed.length,
    avgMeal: avg(prices),
    medianMeal: median(prices),
    priceN: prices.length,
    densityKoeln: densityPer10k('Köln'),
    densityBonn: densityPer10k('Bonn'),
    list,
    closedList: closed,
  }
}

export function cityPair() {
  return { köln: buildKpis('Köln'), bonn: buildKpis('Bonn') }
}

export function regionalCounts(city: CityMode) {
  const buckets = [
    'South Indian',
    'North Indian',
    'Punjabi',
    'Gujarati',
    'Bengali',
    'Street food',
    'Fusion',
    'Indian (unspecified / North default)',
  ]
  const list = venuesIn(city === 'Compare' ? 'All' : city)
  return buckets.map((name) => {
    const rows = list.filter((v) => cuisineBuckets(v).includes(name))
    const ratings = rows.filter((v) => v.google.rating != null).map((v) => v.google.rating as number)
    return { name, count: rows.length, avgRating: avg(ratings) }
  })
}

export function priceBands(city: CityMode) {
  const list = venuesIn(city === 'Compare' ? 'All' : city)
  const kinds = ['Dosa', 'Veg main', 'Vegan main', 'Meat main', 'Buffet'] as const
  const observed = kinds.map((kind) => {
    const rows = OBSERVED_PRICES.filter((p) => p.kind === kind && (city === 'All' || city === 'Compare' || p.city === city))
    const nums = rows.map((r) => r.eur)
    return { kind: String(kind), n: nums.length, avg: avg(nums), median: median(nums) }
  })
  return [
    ...observed,
    {
      kind: 'Listed price band €€ (venues)',
      n: list.filter((v) => v.price === '€€').length,
      avg: null,
      median: null,
    },
  ]
}

export function opportunityLabel(score: number) {
  if (score >= 7) return 'Strong opportunity'
  if (score >= 5.5) return 'Moderate opportunity'
  if (score >= 4.5) return 'Potential gap / crowded'
  return 'Not attractive'
}

export function crowding(concept: (typeof CONCEPTS)[number]) {
  return Number((11 - concept.competition).toFixed(1))
}

export function recommendationTone(conceptId: string, city: City): 'proceed-test' | 'needs-evidence' | 'not-recommended' {
  if (conceptId === 'vegan-indian') return 'not-recommended'
  if (conceptId === 'south-veg-fast' && city === 'Köln') return 'proceed-test'
  if (conceptId === 'south-veg-fast' && city === 'Bonn') return 'needs-evidence'
  const c = CONCEPTS.find((x) => x.id === conceptId)
  if (!c || c.score < 5.5) return 'not-recommended'
  return 'needs-evidence'
}

export const DATA_STATUS = {
  label: 'Partially updated',
  reason: 'Ratings and menus are aggregator snapshots, not a live Google feed. OSM pins try live Overpass, then a saved extract.',
} as const
