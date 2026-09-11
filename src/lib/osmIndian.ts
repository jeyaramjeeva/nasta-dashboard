import { OSM_SNAPSHOT_CHECKED_AT, OSM_SNAPSHOT_NOTE, OSM_SNAPSHOT_PLACES } from './osmIndianSnapshot'

export type OsmPlace = {
  id: string
  name: string
  lat: number
  lon: number
  city: 'Köln' | 'Bonn' | 'Unknown'
  cuisine: string
  vegetarian: string
  vegan: string
  hours: string
  website: string
  phone: string
  address: string
  osmUrl: string
}

export type OsmAmenity = {
  id: string
  name: string
  lat: number
  lon: number
  city: 'Köln' | 'Bonn' | 'Unknown'
  kind: 'transit' | 'university' | 'hospital'
  extra: string
  osmUrl: string
}

export type OsmPayload = {
  source: string
  license?: string
  note: string
  live?: boolean
  checkedAt: string
  count: number
  places: OsmPlace[]
}

export type OsmContextPayload = {
  source: string
  note: string
  checkedAt: string
  count: number
  amenities: OsmAmenity[]
}

export function snapshotPayload(city: 'koeln' | 'bonn' | 'both' = 'both'): OsmPayload {
  const places =
    city === 'koeln'
      ? OSM_SNAPSHOT_PLACES.filter((p) => p.city === 'Köln')
      : city === 'bonn'
        ? OSM_SNAPSHOT_PLACES.filter((p) => p.city === 'Bonn')
        : [...OSM_SNAPSHOT_PLACES]
  return {
    source: 'Saved OpenStreetMap extract',
    license: 'ODbL — https://www.openstreetmap.org/copyright',
    note: OSM_SNAPSHOT_NOTE,
    live: false,
    checkedAt: OSM_SNAPSHOT_CHECKED_AT,
    count: places.length,
    places: places as unknown as OsmPlace[],
  }
}

export async function fetchOsmIndian(city: 'koeln' | 'bonn' | 'both' = 'both') {
  try {
    const res = await fetch(`/api/market-osm?city=${city}`)
    if (!res.ok) return snapshotPayload(city)
    const data = (await res.json()) as OsmPayload
    if (!data.places?.length) return snapshotPayload(city)
    return data
  } catch {
    return snapshotPayload(city)
  }
}

export async function fetchOsmContext(city: 'koeln' | 'bonn' | 'both' = 'both') {
  const res = await fetch(`/api/market-osm?city=${city}&layer=context`)
  if (!res.ok) throw new Error(`OSM context ${res.status}`)
  return (await res.json()) as OsmContextPayload
}

export function nameKey(s: string) {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function fuzzyMatch(a: string, b: string) {
  const x = nameKey(a)
  const y = nameKey(b)
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}
