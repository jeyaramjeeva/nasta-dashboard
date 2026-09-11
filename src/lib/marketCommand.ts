import { CONCEPTS, DECISION, OBSERVED_PRICES, VENUES, isCoreIndian } from './marketAnalysis'
import { isSouth, isVeganFocused, isVegFocused } from './marketKpis'
import type { CompFilters } from './marketFilters'
import { EMPTY_FILTERS } from './marketFilters'

export type MarketHit = {
  id: string
  kind: 'page' | 'business' | 'filter' | 'insight'
  label: string
  hint: string
  to: string
  filters?: Partial<CompFilters>
  venueId?: string
}

const PAGES: MarketHit[] = [
  { id: 'p-ov', kind: 'page', label: 'Overview', hint: 'Market verdict and opportunity score', to: '/market-analysis?tab=overview' },
  { id: 'p-comp', kind: 'page', label: 'Competitors', hint: 'Research database', to: '/market-analysis?tab=competitors' },
  { id: 'p-map', kind: 'page', label: 'Map', hint: 'Pins, rings, underserved mode', to: '/market-analysis?tab=map' },
  { id: 'p-cust', kind: 'page', label: 'Customers', hint: 'Who to serve', to: '/market-analysis?tab=customers' },
  { id: 'p-opp', kind: 'page', label: 'Opportunities', hint: 'Concept scores', to: '/market-analysis?tab=opportunities' },
  { id: 'p-case', kind: 'page', label: 'Business case', hint: 'Assumptions and break-even', to: '/market-analysis?tab=case' },
]

function parseReviews(q: string) {
  const m = q.match(/(?:reviews?\s*(?:>|>=|over|above|more than)\s*(\d+))|(?:>\s*(\d+)\s*reviews?)/i)
  return m ? Number(m[1] || m[2]) : null
}

function parsePrice(q: string) {
  const m = q.match(/under\s*€?\s*(\d+(?:[.,]\d+)?)|<\s*€?\s*(\d+(?:[.,]\d+)?)/i)
  return m ? Number((m[1] || m[2]).replace(',', '.')) : null
}

export function searchMarket(query: string): MarketHit[] {
  const q = query.trim()
  if (!q) return PAGES
  const n = q.toLowerCase()
  const hits: MarketHit[] = []

  for (const p of PAGES) {
    if (p.label.toLowerCase().includes(n) || p.hint.toLowerCase().includes(n)) hits.push(p)
  }

  const reviewsMin = parseReviews(n)
  if (reviewsMin != null) {
    hits.push({
      id: 'f-reviews',
      kind: 'filter',
      label: `Businesses with ≥ ${reviewsMin} reviews`,
      hint: 'Applies snapshot review count — not live Google',
      to: `/market-analysis?tab=competitors&reviewsMin=${reviewsMin}`,
      filters: { ...EMPTY_FILTERS, reviewsMin },
    })
  }
  const under = parsePrice(n)
  if (under != null) {
    const cheap = OBSERVED_PRICES.filter((p) => p.eur < under)
    hits.push({
      id: 'f-price',
      kind: 'insight',
      label: `${cheap.length} observed dishes under €${under}`,
      hint: 'Menu euros only. Venue Maps bands are not converted to a number.',
      to: '/market-analysis?tab=case&sub=pricing',
    })
  }
  if (/vegan/.test(n) && !/friendly/.test(n)) {
    hits.push({
      id: 'f-vegan',
      kind: 'filter',
      label: 'Vegan-focused businesses',
      hint: '100% vegan or vegan-focused — not vegan-friendly',
      to: '/market-analysis?tab=competitors&vegan=vegan-focus',
      filters: { vegan: 'vegan-focus' },
    })
  }
  if (/vegetarian|veg-focused|veg focused/.test(n)) {
    hits.push({
      id: 'f-veg',
      kind: 'filter',
      label: 'Vegetarian-focused businesses',
      hint: '100% or mostly vegetarian',
      to: '/market-analysis?tab=competitors&veg=veg-focus',
      filters: { veg: 'veg-focus' },
    })
  }
  if (/south indian|dosa|idli|sambar/.test(n)) {
    const city = /köln|koeln|cologne/.test(n) ? 'Köln' : /bonn/.test(n) ? 'Bonn' : 'All'
    hits.push({
      id: 'f-south',
      kind: 'filter',
      label: city === 'All' ? 'South Indian / dosa' : `South Indian · ${city}`,
      hint: 'Cuisine tag or dosa = yes',
      to: `/market-analysis?tab=competitors&south=1${city === 'All' ? '' : `&city=${encodeURIComponent(city)}`}`,
      filters: { south: true, city },
    })
  }
  if (/university|uni |campus|student/.test(n)) {
    hits.push({
      id: 'f-uni',
      kind: 'page',
      label: 'Competitors near university',
      hint: 'Map landmarks + walking rings — not a proven catchment model',
      to: '/market-analysis?tab=map&underserved=1',
    })
  }
  if (/closed/.test(n)) {
    hits.push({
      id: 'f-closed',
      kind: 'filter',
      label: 'Permanently closed',
      hint: 'Status field',
      to: '/market-analysis?tab=competitors&status=Permanently%20closed',
      filters: { status: 'Permanently closed' },
    })
  }

  for (const v of VENUES.filter(isCoreIndian)) {
    if (v.name.toLowerCase().includes(n) || v.district.toLowerCase().includes(n)) {
      hits.push({
        id: `v-${v.id}`,
        kind: 'business',
        label: v.name,
        hint: `${v.city} · ${v.district} · ${v.status}`,
        to: `/market-analysis?tab=competitors&venue=${v.id}`,
        venueId: v.id,
      })
    }
  }

  for (const d of DECISION) {
    if (d.q.toLowerCase().includes(n) || d.a.toLowerCase().includes(n)) {
      hits.push({
        id: `d-${d.q.slice(0, 24)}`,
        kind: 'insight',
        label: d.q,
        hint: `${d.evidence} evidence`,
        to: '/market-analysis?tab=overview',
      })
    }
  }

  for (const c of CONCEPTS) {
    if (c.name.toLowerCase().includes(n)) {
      hits.push({
        id: `c-${c.id}`,
        kind: 'page',
        label: c.name,
        hint: `Stored concept score ${c.score.toFixed(1)}/10`,
        to: `/market-analysis?tab=opportunities&concept=${c.id}`,
      })
    }
  }

  if (/vegan/.test(n)) {
    const nV = VENUES.filter((v) => isCoreIndian(v) && isVeganFocused(v)).length
    hits.push({
      id: 'i-vegan-n',
      kind: 'insight',
      label: `${nV} vegan-focused records in the core sample`,
      hint: 'Same filter as the KPI card',
      to: '/market-analysis?tab=competitors&vegan=vegan-focus',
    })
  }
  if (/south/.test(n)) {
    hits.push({
      id: 'i-south-n',
      kind: 'insight',
      label: `${VENUES.filter((v) => isCoreIndian(v) && isSouth(v)).length} South Indian / dosa records`,
      hint: 'Classification field, not a keyword guess on dishes',
      to: '/market-analysis?tab=competitors&south=1',
    })
  }
  if (/vegetarian/.test(n)) {
    hits.push({
      id: 'i-veg-n',
      kind: 'insight',
      label: `${VENUES.filter((v) => isCoreIndian(v) && isVegFocused(v)).length} vegetarian-focused records`,
      hint: '100% or mostly vegetarian',
      to: '/market-analysis?tab=competitors&veg=veg-focus',
    })
  }

  const seen = new Set<string>()
  return hits.filter((h) => {
    if (seen.has(h.id)) return false
    seen.add(h.id)
    return true
  }).slice(0, 20)
}
