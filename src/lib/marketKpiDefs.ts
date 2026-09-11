import { RESEARCH_CHECKED_LABEL, isCoreIndian, type Venue } from './marketAnalysis'
import { isSouth, isVegFocused, isVeganFocused, isVegFriendly, venuesIn, type CityMode } from './marketKpis'

export type KpiId =
  | 'total'
  | 'koeln'
  | 'bonn'
  | 'open'
  | 'closed'
  | 'unknown'
  | 'veg-focus'
  | 'vegan-focus'
  | 'veg-friendly'
  | 'south'
  | 'street'
  | 'thali'
  | 'buffet'
  | 'delivery'
  | 'rated'
  | 'reviewed'

export type KpiDef = {
  id: KpiId
  title: string
  subtitle: string
  chip: string
  goLabel: string
  match: (v: Venue) => boolean
  tag: (v: Venue) => string
}

export function closedWhen(v: Venue): string {
  if (v.status !== 'Permanently closed') return ''
  const monthYear = v.statusEvidence.match(
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+20\d{2}\b/i,
  )
  if (monthYear) return monthYear[0]
  const year = v.statusEvidence.match(/\b20\d{2}\b/)
  if (year) return year[0]
  return 'Date unknown'
}

function def(
  id: KpiId,
  title: string,
  subtitle: string,
  chip: string,
  match: (v: Venue) => boolean,
  tag: (v: Venue) => string,
  goLabel = 'View businesses →',
): KpiDef {
  return { id, title, subtitle, chip, goLabel, match, tag }
}

export const KPI_DEFS: Record<KpiId, KpiDef> = {
  total: def('total', 'Indian food businesses', 'Core Indian records in this sample', 'All core Indian', isCoreIndian, (v) => v.format),
  koeln: def('koeln', 'Köln records', 'Core Indian sample, Köln only', 'City: Köln', (v) => isCoreIndian(v) && v.city === 'Köln', (v) => v.district || v.city),
  bonn: def('bonn', 'Bonn records', 'Core Indian sample, Bonn only', 'City: Bonn', (v) => isCoreIndian(v) && v.city === 'Bonn', (v) => v.district || v.city),
  open: def('open', 'Listed open', 'Status = Open', 'Status: Open', (v) => isCoreIndian(v) && v.status === 'Open', (v) => v.status),
  closed: def(
    'closed',
    'Permanently closed',
    'Status = Permanently closed',
    'Status: Permanently closed',
    (v) => isCoreIndian(v) && v.status === 'Permanently closed',
    (v) => `Closed · ${closedWhen(v)}`,
    'View closure history →',
  ),
  unknown: def('unknown', 'Status unknown', 'Status = Unknown', 'Status: Unknown', (v) => isCoreIndian(v) && v.status === 'Unknown', (v) => v.status),
  'veg-focus': def(
    'veg-focus',
    'Vegetarian-focused',
    '100% or mostly vegetarian',
    'Vegetarian-focused',
    (v) => isCoreIndian(v) && isVegFocused(v),
    (v) => v.veg,
  ),
  'vegan-focus': def(
    'vegan-focus',
    'Vegan-focused',
    '100% vegan or vegan-focused — not vegan-friendly',
    'Vegan-focused',
    (v) => isCoreIndian(v) && isVeganFocused(v),
    (v) => v.vegan,
  ),
  'veg-friendly': def(
    'veg-friendly',
    'Vegetarian-friendly',
    'Mixed rooms included — not vegetarian-focused',
    'Vegetarian-friendly',
    (v) => isCoreIndian(v) && isVegFriendly(v),
    (v) => v.veg,
  ),
  south: def(
    'south',
    'South Indian / dosa',
    'South / Tamil / Kerala cuisine or dosa = yes',
    'South Indian / dosa',
    (v) => isCoreIndian(v) && isSouth(v),
    (v) => (v.dosa === true ? 'Dosa tagged' : v.cuisine.filter((c) => /South|Tamil|Kerala/.test(c)).join(', ') || 'South Indian'),
  ),
  street: def('street', 'Street food', 'streetFood = true', 'Street food', (v) => isCoreIndian(v) && v.streetFood, (v) => v.format),
  thali: def('thali', 'Thali', 'thali = true', 'Thali', (v) => isCoreIndian(v) && v.thali === true, () => 'Thali'),
  buffet: def('buffet', 'Buffet', 'buffet = true', 'Buffet', (v) => isCoreIndian(v) && v.buffet === true, () => 'Buffet'),
  delivery: def('delivery', 'Delivery', 'delivery = true', 'Delivery', (v) => isCoreIndian(v) && v.delivery === true, () => 'Delivery'),
  rated: def(
    'rated',
    'With a snapshot rating',
    'Google snapshot rating present',
    'Has rating snapshot',
    (v) => isCoreIndian(v) && v.google.rating != null,
    (v) => (v.google.rating != null ? `${v.google.rating.toFixed(1)} ★` : 'Rated'),
  ),
  reviewed: def(
    'reviewed',
    'With a review count',
    'Google snapshot review count present',
    'Has review count',
    (v) => isCoreIndian(v) && v.google.reviewCount != null,
    (v) => (v.google.reviewCount != null ? `${v.google.reviewCount.toLocaleString('de-DE')} reviews` : 'Reviewed'),
  ),
}

export function kpiVenues(city: CityMode, id: KpiId): Venue[] {
  const scope = city === 'Compare' ? 'All' : city
  return venuesIn(scope).filter((v) => KPI_DEFS[id].match(v))
}

export function kpiBreakdown(venues: Venue[]) {
  const köln = venues.filter((v) => v.city === 'Köln').length
  const bonn = venues.filter((v) => v.city === 'Bonn').length
  return { köln, bonn, total: venues.length }
}

export function kpiCityLabel(city?: CityMode) {
  if (!city || city === 'All' || city === 'Compare') return 'this sample'
  return city
}

export function kpiEmptyCopy(id: KpiId, city?: CityMode) {
  return `No ${KPI_DEFS[id].title.toLowerCase()} businesses found for ${kpiCityLabel(city)}.`
}

export const KPI_DATASET_NOTE = `Based on latest dataset · last checked ${RESEARCH_CHECKED_LABEL}`
