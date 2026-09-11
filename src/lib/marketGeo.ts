import type { Venue } from './marketAnalysis'

export type GeoPoint = { lat: number; lon: number; label?: string }

export type LandmarkKind = 'transit' | 'university' | 'office' | 'market' | 'candidate'

export const LANDMARKS: { id: string; name: string; city: 'Köln' | 'Bonn'; lat: number; lon: number; kind: LandmarkKind }[] = [
  { id: 'neumarkt', name: 'Neumarkt', city: 'Köln', lat: 50.9364, lon: 6.9489, kind: 'market' },
  { id: 'rudolfplatz', name: 'Rudolfplatz', city: 'Köln', lat: 50.9363, lon: 6.9395, kind: 'transit' },
  { id: 'koeln-hbf', name: 'Köln Hauptbahnhof', city: 'Köln', lat: 50.943, lon: 6.9589, kind: 'transit' },
  { id: 'ehrenfeld-bf', name: 'Köln-Ehrenfeld Bf', city: 'Köln', lat: 50.9516, lon: 6.9184, kind: 'transit' },
  { id: 'deutz-bf', name: 'Köln Messe/Deutz', city: 'Köln', lat: 50.9406, lon: 6.975, kind: 'transit' },
  { id: 'uni-koeln', name: 'Universität zu Köln', city: 'Köln', lat: 50.928, lon: 6.9286, kind: 'university' },
  { id: 'th-deutz', name: 'TH Köln Deutz', city: 'Köln', lat: 50.9348, lon: 6.9876, kind: 'university' },
  { id: 'zuelpicher', name: 'Zülpicher Platz', city: 'Köln', lat: 50.9302, lon: 6.9382, kind: 'candidate' },
  { id: 'mediapark', name: 'Mediapark', city: 'Köln', lat: 50.9485, lon: 6.9435, kind: 'office' },
  { id: 'bonn-markt', name: 'Bonn Markt', city: 'Bonn', lat: 50.7352, lon: 7.0997, kind: 'market' },
  { id: 'bonn-hbf', name: 'Bonn Hauptbahnhof', city: 'Bonn', lat: 50.732, lon: 7.097, kind: 'transit' },
  { id: 'uni-bonn', name: 'Universität Bonn', city: 'Bonn', lat: 50.7264, lon: 7.1113, kind: 'university' },
  { id: 'poppelsdorf', name: 'Poppelsdorf', city: 'Bonn', lat: 50.7258, lon: 7.0864, kind: 'candidate' },
  { id: 'bundesviertel', name: 'Bundesviertel', city: 'Bonn', lat: 50.7182, lon: 7.1275, kind: 'office' },
]

const PIN_CACHE = 'nasta-market-pins-v1'

export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

export function walkMin(meters: number) {
  return Math.round(meters / 80)
}

export function formatDistance(meters: number) {
  if (meters < 950) return `${Math.round(meters)} m · ~${walkMin(meters)} min walk`
  return `${(meters / 1000).toFixed(1)} km · ~${walkMin(meters)} min walk`
}

export function osmBrowseUrl(lat: number, lon: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`
}

export function streetViewUrl(lat: number, lon: number) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`
}

export function mapsSearchUrl(query: string) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`
}

export function venueQuery(v: Venue) {
  return [v.address, v.postal, v.city].filter(Boolean).join(', ')
}

export function loadPinCache(): Record<string, GeoPoint> {
  try {
    const raw = localStorage.getItem(PIN_CACHE)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, GeoPoint>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function savePinCache(next: Record<string, GeoPoint>) {
  localStorage.setItem(PIN_CACHE, JSON.stringify(next))
}

export async function geocodeAddress(q: string): Promise<GeoPoint | null> {
  const res = await fetch(`/api/market-osm?geocode=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const data = (await res.json()) as { result?: { lat: number; lon: number; label: string } | null }
  if (!data.result) return null
  return { lat: data.result.lat, lon: data.result.lon, label: data.result.label }
}

export function nearestLandmarks(point: GeoPoint, city?: 'Köln' | 'Bonn') {
  return LANDMARKS.filter((l) => !city || l.city === city)
    .map((l) => ({ ...l, meters: haversineM(point, l) }))
    .sort((a, b) => a.meters - b.meters)
}

export type SiteCompetitor = GeoPoint & { south?: boolean }

export function underservedScore(
  point: GeoPoint,
  city: 'Köln' | 'Bonn',
  competitors: SiteCompetitor[],
) {
  const nearby = competitors.filter((c) => haversineM(point, c) <= 1000)
  const south = nearby.filter((c) => c.south).length
  const demand = LANDMARKS.filter(
    (l) => l.city === city && (l.kind === 'university' || l.kind === 'office' || l.kind === 'transit') && haversineM(point, l) <= 1200,
  )
  const pinsKnown = competitors.length
  if (pinsKnown < 8) {
    return {
      label: 'Insufficient evidence' as const,
      why: `Only ${pinsKnown} competitor pins are geocoded. Low density on the map is not a proven gap.`,
      nearby: nearby.length,
      south,
      demand: demand.map((d) => d.name),
    }
  }
  const demandOk = demand.length >= 1
  const sparse = nearby.length <= 2
  const fewSouth = south === 0
  if (demandOk && sparse && fewSouth) {
    return {
      label: 'Evidence of a possible gap' as const,
      why: `${nearby.length} Indian pins within 1 km, ${south} South Indian, demand landmarks: ${demand.map((d) => d.name).join(', ')}. Still walk the street — rent and footfall are not in this file.`,
      nearby: nearby.length,
      south,
      demand: demand.map((d) => d.name),
    }
  }
  return {
    label: 'Not marked underserved' as const,
    why: demandOk
      ? `${nearby.length} Indian pins within 1 km (${south} South Indian). Demand landmarks exist, but competitor density is not low enough on current pins.`
      : 'No university / office / transit landmark within 1.2 km in this file, or competitor pins are already stacked.',
    nearby: nearby.length,
    south,
    demand: demand.map((d) => d.name),
  }
}
