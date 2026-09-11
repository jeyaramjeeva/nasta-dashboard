import type { City, Format, PriceBand, Status, Venue } from './marketAnalysis'
import { isSouth, isVegFocused, isVeganFocused } from './marketKpis'
import { mentionsIdli } from './marketDecision'

export type CompFilters = {
  q: string
  city: City | 'All'
  district: string
  cuisine: string
  concept: string
  veg: 'All' | 'veg-focus' | 'veg-friendly' | 'not-verified'
  vegan: 'All' | 'vegan-focus' | 'vegan-friendly' | 'not-verified'
  south: boolean
  dosa: 'All' | 'yes' | 'no' | 'unknown'
  idli: boolean
  lunch: 'All' | 'yes' | 'unknown'
  buffet: 'All' | 'yes' | 'no' | 'unknown'
  price: PriceBand | 'All'
  ratingMin: number | null
  reviewsMin: number | null
  status: Status | 'All'
}

export const EMPTY_FILTERS: CompFilters = {
  q: '',
  city: 'All',
  district: '',
  cuisine: '',
  concept: '',
  veg: 'All',
  vegan: 'All',
  south: false,
  dosa: 'All',
  idli: false,
  lunch: 'All',
  buffet: 'All',
  price: 'All',
  ratingMin: null,
  reviewsMin: null,
  status: 'All',
}

function flagMatch(value: boolean | 'Not verified', want: 'All' | 'yes' | 'no' | 'unknown') {
  if (want === 'All') return true
  if (want === 'yes') return value === true
  if (want === 'no') return value === false
  return value === 'Not verified'
}

export function applyCompFilters(list: Venue[], f: CompFilters) {
  return list.filter((v) => {
    if (f.city !== 'All' && v.city !== f.city) return false
    if (f.district && v.district !== f.district) return false
    if (f.cuisine && !v.cuisine.includes(f.cuisine)) return false
    if (f.concept && v.format !== f.concept) return false
    if (f.veg === 'veg-focus' && !isVegFocused(v)) return false
    if (f.veg === 'veg-friendly' && v.veg !== 'Vegetarian-friendly') return false
    if (f.veg === 'not-verified' && v.veg !== 'Not verified') return false
    if (f.vegan === 'vegan-focus' && !isVeganFocused(v)) return false
    if (f.vegan === 'vegan-friendly' && v.vegan !== 'Vegan-friendly') return false
    if (f.vegan === 'not-verified' && v.vegan !== 'Not verified') return false
    if (f.south && !isSouth(v)) return false
    if (!flagMatch(v.dosa, f.dosa)) return false
    if (f.idli && !mentionsIdli(v)) return false
    if (f.lunch === 'yes' && v.lunch !== true) return false
    if (f.lunch === 'unknown' && v.lunch !== 'Not verified') return false
    if (!flagMatch(v.buffet, f.buffet)) return false
    if (f.price !== 'All' && v.price !== f.price) return false
    if (f.ratingMin != null && (v.google.rating == null || v.google.rating < f.ratingMin)) return false
    if (f.reviewsMin != null && (v.google.reviewCount == null || v.google.reviewCount < f.reviewsMin)) return false
    if (f.status !== 'All' && v.status !== f.status) return false
    if (f.q) {
      const hay = `${v.name} ${v.district} ${v.cuisine.join(' ')} ${v.format}`.toLowerCase()
      if (!hay.includes(f.q.toLowerCase())) return false
    }
    return true
  })
}

export function filterChips(f: CompFilters) {
  const chips: { key: keyof CompFilters | 'clear'; label: string }[] = []
  if (f.q) chips.push({ key: 'q', label: `Search: ${f.q}` })
  if (f.city !== 'All') chips.push({ key: 'city', label: `City: ${f.city}` })
  if (f.district) chips.push({ key: 'district', label: `District: ${f.district}` })
  if (f.cuisine) chips.push({ key: 'cuisine', label: `Cuisine: ${f.cuisine}` })
  if (f.concept) chips.push({ key: 'concept', label: `Concept: ${f.concept}` })
  if (f.veg !== 'All') chips.push({ key: 'veg', label: f.veg === 'veg-focus' ? 'Vegetarian-focused' : f.veg === 'veg-friendly' ? 'Vegetarian-friendly' : 'Veg not verified' })
  if (f.vegan !== 'All') chips.push({ key: 'vegan', label: f.vegan === 'vegan-focus' ? 'Vegan-focused' : f.vegan === 'vegan-friendly' ? 'Vegan-friendly' : 'Vegan not verified' })
  if (f.south) chips.push({ key: 'south', label: 'South Indian' })
  if (f.dosa !== 'All') chips.push({ key: 'dosa', label: `Dosa: ${f.dosa}` })
  if (f.idli) chips.push({ key: 'idli', label: 'Idli mentioned in notes' })
  if (f.lunch !== 'All') chips.push({ key: 'lunch', label: `Lunch: ${f.lunch}` })
  if (f.buffet !== 'All') chips.push({ key: 'buffet', label: `Buffet: ${f.buffet}` })
  if (f.price !== 'All') chips.push({ key: 'price', label: `Price: ${f.price}` })
  if (f.ratingMin != null) chips.push({ key: 'ratingMin', label: `Rating ≥ ${f.ratingMin}` })
  if (f.reviewsMin != null) chips.push({ key: 'reviewsMin', label: `Reviews ≥ ${f.reviewsMin}` })
  if (f.status !== 'All') chips.push({ key: 'status', label: `Status: ${f.status}` })
  return chips
}

export function clearChip(f: CompFilters, key: keyof CompFilters): CompFilters {
  if (key === 'south' || key === 'idli') return { ...f, [key]: false }
  if (key === 'ratingMin' || key === 'reviewsMin') return { ...f, [key]: null }
  if (key === 'q' || key === 'district' || key === 'cuisine' || key === 'concept') return { ...f, [key]: '' }
  if (key === 'city') return { ...f, city: 'All' }
  return { ...f, [key]: 'All' } as CompFilters
}

export function uniqueDistricts(list: Venue[]) {
  return [...new Set(list.map((v) => v.district).filter((d) => d && d !== 'Not verified'))].sort()
}

export function uniqueCuisines(list: Venue[]) {
  return [...new Set(list.flatMap((v) => v.cuisine))].sort()
}

export function uniqueFormats(list: Venue[]): Format[] {
  return [...new Set(list.map((v) => v.format))].sort()
}

export function filterSummary(list: Venue[]) {
  return {
    total: list.length,
    south: list.filter(isSouth).length,
    veg: list.filter(isVegFocused).length,
    vegan: list.filter(isVeganFocused).length,
  }
}
