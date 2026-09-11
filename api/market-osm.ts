import { createRequire } from 'node:module'
import type { VercelRequest, VercelResponse } from '@vercel/node'

/** OpenStreetMap Overpass + Nominatim proxy. Public OSM data only — no Google ratings. */

const UA = 'NastaZentrumMarketAnalysis/1.0 (https://nastazentrum.vercel.app; market research)'
const OVERPASS_URLS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
]
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const PHOTON = 'https://photon.komoot.io/api/'

type OsmPlace = {
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

const loadJson = createRequire(import.meta.url)
const OSM_SNAPSHOT_CHECKED_AT = '2026-09-08T12:48:54.111Z'
const OSM_SNAPSHOT_PLACES = loadJson('./osm-snapshot.json') as OsmPlace[]

type OsmAmenity = {
  id: string
  name: string
  lat: number
  lon: number
  city: 'Köln' | 'Bonn' | 'Unknown'
  kind: 'transit' | 'university' | 'hospital'
  extra: string
  osmUrl: string
}

const cache = new Map<string, { at: number; places: OsmPlace[] }>()
const TTL_MS = 30 * 60 * 1000
const FETCH_MS = 3500
const DEADLINE_MS = 7000

const BBOX = {
  both: '50.65,6.84,51.05,7.22',
  koeln: '50.87,6.84,51.05,7.15',
  bonn: '50.65,7.02,50.78,7.22',
}

function json(res: VercelResponse, status: number, data: unknown) {
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800')
  res.status(status).json(data)
}

function snapshotPlaces(city: string): OsmPlace[] {
  const list = OSM_SNAPSHOT_PLACES as unknown as OsmPlace[]
  if (city === 'koeln') return list.filter((p) => p.city === 'Köln')
  if (city === 'bonn') return list.filter((p) => p.city === 'Bonn')
  return [...list]
}

function inBonn(lat: number, lon: number) {
  return lat >= 50.65 && lat <= 50.78 && lon >= 7.02 && lon <= 7.22
}

function isNoise(name: string, cuisine: string) {
  return /currywurst|weltmeister|pommes/i.test(`${name} ${cuisine}`)
}

function queryFor(bbox: string) {
  return `[out:json][timeout:12];
(
  nwr["amenity"~"restaurant|fast_food|cafe"]["cuisine"~"indian|south_indian|north_indian|pakistani",i](${bbox});
  nwr["amenity"~"restaurant|fast_food|cafe"]["name"~"indisch|indian|tandoori|punjab|masala|dosa|thali|biryani",i](${bbox});
);
out center tags;`
}

function parseEl(el: {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}): OsmPlace | null {
  const tags = el.tags || {}
  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  if (lat == null || lon == null) return null
  const name = tags.name || tags['name:en'] || tags['name:de']
  if (!name || isNoise(name, tags.cuisine || '')) return null
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ')
  const cityTag = tags['addr:city'] || ''
  const city: OsmPlace['city'] =
    /bonn/i.test(cityTag) || inBonn(lat, lon) ? 'Bonn' : /köln|koeln|cologne/i.test(cityTag) ? 'Köln' : inBonn(lat, lon) ? 'Bonn' : 'Köln'
  return {
    id: `${el.type}/${el.id}`,
    name,
    lat,
    lon,
    city,
    cuisine: tags.cuisine || '',
    vegetarian: tags['diet:vegetarian'] || '',
    vegan: tags['diet:vegan'] || '',
    hours: tags.opening_hours || '',
    website: tags.website || tags['contact:website'] || '',
    phone: tags.phone || tags['contact:phone'] || '',
    address: [street, tags['addr:postcode'], cityTag].filter(Boolean).join(', '),
    osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  }
}

function contextQuery(bbox: string) {
  return `[out:json][timeout:12];
(
  node["railway"="station"]["name"](${bbox});
  node["railway"="halt"]["name"](${bbox});
  node["railway"="tram_stop"]["name"](${bbox});
  node["amenity"="university"]["name"](${bbox});
  node["amenity"="hospital"]["name"](${bbox});
);
out center tags;`
}

function kindOf(tags: Record<string, string>): OsmAmenity['kind'] {
  if (tags.amenity === 'university') return 'university'
  if (tags.amenity === 'hospital') return 'hospital'
  return 'transit'
}

function parseAmenity(el: {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}): OsmAmenity | null {
  const tags = el.tags || {}
  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  if (lat == null || lon == null) return null
  const name = tags.name || tags['name:de'] || tags['name:en']
  if (!name) return null
  const cityTag = tags['addr:city'] || ''
  const city: OsmAmenity['city'] = /bonn/i.test(cityTag) || inBonn(lat, lon) ? 'Bonn' : 'Köln'
  const extra = [tags.railway, tags.station, tags.amenity, tags['public_transport']].filter(Boolean).join(' · ')
  return {
    id: `${el.type}/${el.id}`,
    name,
    lat,
    lon,
    city,
    kind: kindOf(tags),
    extra,
    osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  }
}

async function overpassJson(query: string): Promise<unknown> {
  let last = 'Overpass failed'
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': UA,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(FETCH_MS),
      })
      if (!res.ok) {
        last = `Overpass ${res.status} at ${url}`
        continue
      }
      return await res.json()
    } catch (e) {
      last = e instanceof Error ? e.message : 'Overpass timeout'
    }
  }
  throw new Error(last)
}

async function fetchContext(key: 'koeln' | 'bonn' | 'both'): Promise<OsmAmenity[]> {
  const cacheKey = `ctx-${key}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.places as unknown as OsmAmenity[]
  const raw = (await overpassJson(contextQuery(BBOX[key]))) as { elements?: Parameters<typeof parseAmenity>[0][] }
  const list = (raw.elements || []).map(parseAmenity).filter((p): p is OsmAmenity => !!p)
  const uniq = new Map<string, OsmAmenity>()
  for (const p of list) uniq.set(p.id, p)
  const places = [...uniq.values()]
  cache.set(cacheKey, { at: Date.now(), places: places as unknown as OsmPlace[] })
  return places
}

async function fetchBbox(key: 'koeln' | 'bonn' | 'both'): Promise<OsmPlace[]> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.places
  const raw = (await overpassJson(queryFor(BBOX[key]))) as { elements?: Parameters<typeof parseEl>[0][] }
  const places = (raw.elements || []).map(parseEl).filter((p): p is OsmPlace => !!p)
  const uniq = new Map<string, OsmPlace>()
  for (const p of places) uniq.set(p.id, p)
  const list = [...uniq.values()]
  cache.set(key, { at: Date.now(), places: list })
  return list
}

function fallbackIndian(city: string, reason: string) {
  const places = snapshotPlaces(city)
  return {
    source: 'Saved OpenStreetMap extract (Overpass unavailable)',
    license: 'ODbL — https://www.openstreetmap.org/copyright',
    note: `Live Overpass failed (${reason}). Showing the last saved OSM extract from ${OSM_SNAPSHOT_CHECKED_AT}. Not Google ratings.`,
    live: false,
    checkedAt: OSM_SNAPSHOT_CHECKED_AT,
    count: places.length,
    places,
  }
}

async function geocode(q: string) {
  const nom = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(q)}`
  try {
    const r = await fetch(nom, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_MS),
    })
    if (r.ok) {
      const rows = (await r.json()) as { lat: string; lon: string; display_name: string }[]
      if (rows[0]) {
        return { lat: Number(rows[0].lat), lon: Number(rows[0].lon), label: rows[0].display_name, via: 'Nominatim' }
      }
    }
  } catch {
    /* try Photon */
  }
  const pr = await fetch(`${PHOTON}?q=${encodeURIComponent(q)}&limit=1`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_MS),
  })
  if (!pr.ok) throw new Error(`Geocode ${pr.status}`)
  const pj = (await pr.json()) as {
    features?: { geometry?: { coordinates?: number[] }; properties?: { name?: string } }[]
  }
  const f = pj.features?.[0]
  const c = f?.geometry?.coordinates
  if (!c || c.length < 2) return null
  return { lat: c[1], lon: c[0], label: f?.properties?.name || q, via: 'Photon' }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return json(res, 405, { error: 'GET only' })

  const geocodeQ = String(req.query.geocode || '').trim()
  if (geocodeQ) {
    try {
      const result = await geocode(geocodeQ)
      return json(res, 200, {
        source: result?.via === 'Photon' ? 'Photon / OpenStreetMap' : 'Nominatim / OpenStreetMap',
        note: 'Geocoding only. Not a Google rating.',
        result,
        checkedAt: new Date().toISOString(),
      })
    } catch {
      return json(res, 200, {
        source: 'Geocoder unavailable',
        note: 'Nominatim and Photon both failed.',
        result: null,
        checkedAt: new Date().toISOString(),
      })
    }
  }

  const cityRaw = String(req.query.city || 'both').toLowerCase()
  const city = cityRaw === 'koeln' || cityRaw === 'bonn' ? cityRaw : 'both'
  const layer = String(req.query.layer || 'indian').toLowerCase()
  try {
    if (layer === 'context') {
      const amenities = await Promise.race([
        fetchContext(city),
        new Promise<OsmAmenity[]>((_, reject) => {
          setTimeout(() => reject(new Error('Overpass deadline')), DEADLINE_MS)
        }),
      ])
      return json(res, 200, {
        source: 'OpenStreetMap via Overpass API',
        license: 'ODbL — https://www.openstreetmap.org/copyright',
        note: 'Transit stops, universities and hospitals. Public OSM tags only.',
        live: true,
        checkedAt: new Date().toISOString(),
        count: amenities.length,
        amenities,
      })
    }
    const parts = await Promise.race([
      fetchBbox(city),
      new Promise<OsmPlace[]>((_, reject) => {
        setTimeout(() => reject(new Error('Overpass deadline')), DEADLINE_MS)
      }),
    ])
    return json(res, 200, {
      source: 'OpenStreetMap via Overpass API',
      license: 'ODbL — https://www.openstreetmap.org/copyright',
      note: 'OSM has names, coordinates, cuisine tags and hours when mappers added them. It does not include Google ratings or review counts.',
      live: true,
      checkedAt: new Date().toISOString(),
      count: parts.length,
      places: parts,
    })
  } catch (e) {
    if (layer === 'context') {
      return json(res, 200, {
        source: 'OpenStreetMap context unavailable',
        note: e instanceof Error ? e.message : 'Overpass failed',
        live: false,
        checkedAt: new Date().toISOString(),
        count: 0,
        amenities: [],
      })
    }
    return json(res, 200, fallbackIndian(city, e instanceof Error ? e.message : 'Overpass failed'))
  }
}
