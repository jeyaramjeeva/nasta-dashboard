import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { VENUES, type Venue } from '../lib/marketAnalysis'
import { isSouth } from '../lib/marketKpis'
import {
  formatDistance,
  geocodeAddress,
  haversineM,
  LANDMARKS,
  loadPinCache,
  mapsSearchUrl,
  nearestLandmarks,
  osmBrowseUrl,
  savePinCache,
  streetViewUrl,
  underservedScore,
  venueQuery,
  type GeoPoint,
} from '../lib/marketGeo'
import { formatOpenNow, openingStatus } from '../lib/osmHours'
import {
  fetchOsmContext,
  fetchOsmIndian,
  fuzzyMatch,
  snapshotPayload,
  type OsmAmenity,
  type OsmPayload,
  type OsmPlace,
} from '../lib/osmIndian'

type Site = GeoPoint & { label: string }

const RINGS = [500, 1000, 2000] as const

function matchedVenue(name: string) {
  return VENUES.find((v) => fuzzyMatch(v.name, name))
}

export function LiveOsmMap({
  onOpenVenue,
  focusVenueId,
  city = 'All',
}: {
  onOpenVenue: (v: Venue) => void
  focusVenueId?: string | null
  city?: 'Köln' | 'Bonn' | 'All'
}) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const layersRef = useRef<import('leaflet').LayerGroup | null>(null)
  const [data, setData] = useState<OsmPayload | null>(() => snapshotPayload('both'))
  const [amenities, setAmenities] = useState<OsmAmenity[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<OsmPlace | null>(null)
  const [q, setQ] = useState('')
  const [pins, setPins] = useState<Record<string, GeoPoint>>(() =>
    typeof window === 'undefined' ? {} : loadPinCache(),
  )
  const [site, setSite] = useState<Site | null>(null)
  const [addressQ, setAddressQ] = useState('')
  const [showOsm, setShowOsm] = useState(true)
  const [showResearch, setShowResearch] = useState(true)
  const [showHeat, setShowHeat] = useState(false)
  const [showTransit, setShowTransit] = useState(false)
  const [showCampus, setShowCampus] = useState(false)
  const [showRings, setShowRings] = useState(true)
  const [showMarks, setShowMarks] = useState(true)
  const [underserved, setUnderserved] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)

  const filtered = useMemo(() => {
    const list = (data?.places ?? []).filter((p) => city === 'All' || p.city === city)
    if (!q.trim()) return list
    const n = q.toLowerCase()
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(n) ||
        p.city.toLowerCase().includes(n) ||
        p.cuisine.toLowerCase().includes(n),
    )
  }, [data, q, city])

  const researchCoords = useMemo(() => {
    const out: { v: Venue; lat: number; lon: number; source: 'osm' | 'nominatim' }[] = []
    for (const v of VENUES.filter((x) => city === 'All' || x.city === city)) {
      const cached = pins[v.id]
      if (cached) {
        out.push({ v, lat: cached.lat, lon: cached.lon, source: 'nominatim' })
        continue
      }
      const osm = (data?.places ?? []).find((p) => fuzzyMatch(v.name, p.name))
      if (osm) out.push({ v, lat: osm.lat, lon: osm.lon, source: 'osm' })
    }
    return out
  }, [data, pins, city])

  const nearby = useMemo(() => {
    if (!site) return []
    return (data?.places ?? [])
      .map((p) => ({ p, meters: haversineM(site, p) }))
      .filter((x) => x.meters <= 2000)
      .sort((a, b) => a.meters - b.meters)
  }, [site, data])

  async function load() {
    setBusy(true)
    setErr(null)
    if (!data?.places.length) setData(snapshotPayload('both'))
    try {
      const next = await fetchOsmIndian('both')
      setData(next)
    } catch {
      setData(snapshotPayload('both'))
    } finally {
      setBusy(false)
    }
  }

  async function loadContext() {
    try {
      const ctx = await fetchOsmContext('both')
      setAmenities(ctx.amenities)
    } catch {
      setAmenities([])
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if ((showTransit || showCampus) && amenities.length === 0) void loadContext()
  }, [showTransit, showCampus, amenities.length])

  useEffect(() => {
    const v = focusVenueId ? VENUES.find((x) => x.id === focusVenueId) : null
    if (!v) return
    const hit = researchCoords.find((r) => r.v.id === v.id)
    if (hit) setSite({ lat: hit.lat, lon: hit.lon, label: v.name })
  }, [focusVenueId, researchCoords])

  useEffect(() => {
    const el = box.current
    if (!el) return
    let cancelled = false
    let map = mapRef.current

    void import('leaflet').then((L) => {
      if (cancelled || !box.current) return
      if (!map) {
        el.innerHTML = ''
        map = L.map(el).setView([50.88, 7.04], 10)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map)
        map.on('click', (e: { latlng: { lat: number; lng: number }; originalEvent?: Event }) => {
          const t = e.originalEvent?.target as HTMLElement | undefined
          if (t?.closest?.('.leaflet-interactive')) return
          setSite({
            lat: e.latlng.lat,
            lon: e.latlng.lng,
            label: 'Dropped pin',
          })
        })
        mapRef.current = map
        layersRef.current = L.layerGroup().addTo(map)
      }
      const group = layersRef.current
      if (!group || !map) return
      group.clearLayers()

      if (showHeat) {
        for (const p of data?.places ?? []) {
          L.circle([p.lat, p.lon], {
            radius: 450,
            color: '#b8923a',
            weight: 0,
            fillColor: '#b8923a',
            fillOpacity: 0.12,
          }).addTo(group)
        }
      }

      if (showOsm && data) {
        for (const p of filtered) {
          const researched = matchedVenue(p.name)
          const open = openingStatus(p.hours)
          const color =
            researched?.status === 'Permanently closed'
              ? '#9f1239'
              : open === 'open'
                ? '#1f3d2b'
                : open === 'closed'
                  ? '#7a8494'
                  : researched
                    ? '#b8923a'
                    : '#2f5d44'
          const m = L.circleMarker([p.lat, p.lon], {
            radius: 7,
            color,
            fillColor: color,
            fillOpacity: 0.9,
            weight: 1,
          }).addTo(group)
          m.bindTooltip(`${p.name}${open === 'unknown' ? '' : ` · ${formatOpenNow(p.hours)}`}`)
          m.on('click', () => {
            setPicked(p)
            setSite({ lat: p.lat, lon: p.lon, label: p.name })
            if (researched) onOpenVenue(researched)
          })
        }
      }

      if (showResearch) {
        for (const r of researchCoords) {
          const color =
            r.v.status === 'Permanently closed' ? '#9f1239' : r.v.dosa === true ? '#b8923a' : '#0f1115'
          const m = L.circleMarker([r.lat, r.lon], {
            radius: 5,
            color: '#fff',
            fillColor: color,
            fillOpacity: 1,
            weight: 2,
          }).addTo(group)
          m.bindTooltip(`Research · ${r.v.name}`)
          m.on('click', () => {
            setSite({ lat: r.lat, lon: r.lon, label: r.v.name })
            onOpenVenue(r.v)
          })
        }
      }

      const context = amenities.filter((a) => {
        if (a.kind === 'transit') return showTransit
        return showCampus
      })
      if (showMarks) {
        for (const l of LANDMARKS.filter((x) => city === 'All' || x.city === city)) {
          const color =
            l.kind === 'university' ? '#7c3aed' : l.kind === 'office' ? '#0f766e' : l.kind === 'market' ? '#b8923a' : l.kind === 'candidate' ? '#1f3d2b' : '#2563eb'
          L.circleMarker([l.lat, l.lon], {
            radius: 6,
            color,
            fillColor: color,
            fillOpacity: 0.85,
            weight: 1,
          })
            .bindTooltip(`${l.kind} · ${l.name}`)
            .on('click', () => setSite({ lat: l.lat, lon: l.lon, label: l.name }))
            .addTo(group)
        }
      }

      for (const a of context) {
        const color = a.kind === 'transit' ? '#2563eb' : a.kind === 'university' ? '#7c3aed' : '#dc2626'
        L.circleMarker([a.lat, a.lon], {
          radius: 4,
          color,
          fillColor: color,
          fillOpacity: 0.75,
          weight: 1,
        })
          .bindTooltip(`${a.kind} · ${a.name}`)
          .addTo(group)
      }

      if (site && showRings) {
        for (const r of RINGS) {
          L.circle([site.lat, site.lon], {
            radius: r,
            color: '#1f3d2b',
            weight: 1,
            dashArray: '4 6',
            fillOpacity: r === 500 ? 0.08 : 0.03,
          }).addTo(group)
        }
        L.circleMarker([site.lat, site.lon], {
          radius: 8,
          color: '#fff',
          fillColor: '#9f1239',
          fillOpacity: 1,
          weight: 2,
        })
          .bindTooltip(site.label)
          .addTo(group)
        map.setView([site.lat, site.lon], Math.max(map.getZoom(), 14))
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    data,
    filtered,
    amenities,
    showOsm,
    showResearch,
    showHeat,
    showTransit,
    showCampus,
    showRings,
    showMarks,
    site,
    city,
    researchCoords,
    onOpenVenue,
  ])

  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  async function pinAddress(label: string, query: string, venueId?: string) {
    setGeoBusy(true)
    setErr(null)
    try {
      const hit = await geocodeAddress(query)
      if (!hit) {
        setErr(`Nominatim found no pin for “${query}”`)
        return
      }
      if (venueId) {
        const next = { ...pins, [venueId]: hit }
        setPins(next)
        savePinCache(next)
      }
      setSite({ lat: hit.lat, lon: hit.lon, label: label || hit.label || query })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Nominatim failed')
    } finally {
      setGeoBusy(false)
    }
  }

  const researchedHits = (data?.places ?? []).filter((p) => matchedVenue(p.name)).length
  const unpinned = VENUES.filter((v) => v.address && !researchCoords.some((r) => r.v.id === v.id))

  return (
    <div className="ma-live">
      <p>Research pins and OSM Indian-tagged places. Click a pin for 500 m / 1 km / 2 km walking rings.</p>
      <div className="ma-filters">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter OSM names" />
        <input
          value={addressQ}
          onChange={(e) => setAddressQ(e.target.value)}
          placeholder="Pin this address (Nominatim)"
        />
        <button
          type="button"
          className="ma-btn"
          disabled={geoBusy || !addressQ.trim()}
          onClick={() => void pinAddress(addressQ, addressQ)}
        >
          {geoBusy ? 'Pinning…' : 'Pin address'}
        </button>
        <button type="button" className="ma-btn ma-btn--ghost" onClick={() => void load()} disabled={busy}>
          {busy ? 'Fetching…' : 'Refresh OSM'}
        </button>
      </div>
      <div className="ma-layers">
        <label>
          <input type="checkbox" checked={showOsm} onChange={(e) => setShowOsm(e.target.checked)} /> OSM Indian
        </label>
        <label>
          <input type="checkbox" checked={showResearch} onChange={(e) => setShowResearch(e.target.checked)} /> Research
        </label>
        <label>
          <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} /> Density
        </label>
        <label>
          <input type="checkbox" checked={showRings} onChange={(e) => setShowRings(e.target.checked)} /> Walking rings
        </label>
        <label>
          <input type="checkbox" checked={showTransit} onChange={(e) => setShowTransit(e.target.checked)} /> Tram / S-Bahn
        </label>
        <label>
          <input type="checkbox" checked={showCampus} onChange={(e) => setShowCampus(e.target.checked)} /> Uni / hospital
        </label>
        <label>
          <input type="checkbox" checked={showMarks} onChange={(e) => setShowMarks(e.target.checked)} /> Landmarks
        </label>
        <button type="button" className={`ma-btn ${underserved ? '' : 'ma-btn--ghost'}`} onClick={() => setUnderserved((v) => !v)}>
          Find underserved areas
        </button>
      </div>
      {underserved && (
        <article className="ma-card">
          <h3>Find underserved areas</h3>
          <p className="ma-ev">
            An area is only marked as a possible gap when a university / office / transit landmark is nearby, Indian pins
            within 1 km are few, and South Indian pins are absent. Low pin count is often missing geocodes — not a gap.
          </p>
          <ul>
            {LANDMARKS.filter((l) => (city === 'All' || l.city === city) && (l.kind === 'candidate' || l.kind === 'university' || l.kind === 'office'))
              .map((l) => {
                const pins = [
                  ...researchCoords.map((r) => ({ lat: r.lat, lon: r.lon, south: isSouth(r.v) })),
                  ...(data?.places ?? []).map((p) => ({
                    lat: p.lat,
                    lon: p.lon,
                    south: /south|tamil|dosa|kerala/i.test(p.cuisine),
                  })),
                ]
                const s = underservedScore(l, l.city, pins)
                return (
                  <li key={l.id}>
                    <button type="button" className="ma-linkbtn" onClick={() => setSite({ lat: l.lat, lon: l.lon, label: l.name })}>
                      {l.name}
                    </button>
                    {' · '}
                    <strong>{s.label}</strong>
                    <div className="ma-ev">{s.why}</div>
                  </li>
                )
              })}
          </ul>
        </article>
      )}
      {data && (
        <p className="ma-ev">
          {data.count} OSM places · {data.live === false ? 'saved extract' : 'live Overpass'} · {researchedHits}{' '}
          name-matched · {researchCoords.length} research pins · {new Date(data.checkedAt).toLocaleString('de-DE')}
        </p>
      )}
      {err && <div className="ma-callout ma-callout--warn">{err}</div>}
      <div ref={box} className="ma-leaflet ma-leaflet--tall" />
      <div className="ma-mapleg">
        <span>
          <i style={{ background: '#1f3d2b' }} /> OSM open now
        </span>
        <span>
          <i style={{ background: '#7a8494' }} /> OSM closed now
        </span>
        <span>
          <i style={{ background: '#0f1115' }} /> Research pin
        </span>
        <span>
          <i style={{ background: '#b8923a' }} /> South Indian / dosa
        </span>
        <span>
          <i style={{ background: '#9f1239' }} /> Closed / site
        </span>
        <span>
          <i style={{ background: '#2563eb' }} /> Transit
        </span>
      </div>

      {unpinned.length > 0 && (
        <p className="ma-ev">
          <button
            type="button"
            className="ma-linkbtn"
            disabled={geoBusy}
            onClick={() => {
              const first = unpinned[0]
              void pinAddress(first.name, venueQuery(first), first.id)
            }}
          >
            Pin next of {unpinned.length} missing addresses
          </button>
        </p>
      )}

      {site && (
        <article className="ma-card">
          <h3>{site.label}</h3>
          <p>
            {site.lat.toFixed(5)}, {site.lon.toFixed(5)} · click another street to move the rings
          </p>
          <p>
            {nearestLandmarks(site)
              .slice(0, 3)
              .map((l) => `${l.name} ${formatDistance(l.meters)}`)
              .join(' · ')}
          </p>
          <p>
            <a href={osmBrowseUrl(site.lat, site.lon)} target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>
            {' · '}
            <a href={streetViewUrl(site.lat, site.lon)} target="_blank" rel="noreferrer">
              Street view
            </a>
          </p>
          <p className="ma-ev">
            {nearby.length} Indian-tagged OSM places within 2 km. Walking-distance list uses OSM pins, not
            Google.
          </p>
          {nearby.length > 0 && (
            <div className="ma-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Place</th>
                    <th>Walk</th>
                    <th>Hours</th>
                    <th>In study</th>
                  </tr>
                </thead>
                <tbody>
                  {nearby.slice(0, 12).map(({ p, meters }) => {
                    const v = matchedVenue(p.name)
                    return (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{formatDistance(meters)}</td>
                        <td>{p.hours ? formatOpenNow(p.hours) : 'Not tagged'}</td>
                        <td>{v ? v.status : 'No'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}

      {picked && (
        <article className="ma-card">
          <h3>{picked.name}</h3>
          <p>
            {picked.address || 'Address not tagged'} · {picked.city}
          </p>
          <p>
            Cuisine tag: {picked.cuisine || 'none'} · veg {picked.vegetarian || '—'} · vegan {picked.vegan || '—'}
          </p>
          <p>
            Hours: {picked.hours || 'Not on OSM'}
            {picked.hours ? ` · ${formatOpenNow(picked.hours)}` : ''}
          </p>
          <p>
            {nearestLandmarks({ lat: picked.lat, lon: picked.lon }, picked.city === 'Unknown' ? undefined : picked.city)
              .map((l) => `${l.name} ${formatDistance(l.meters)}`)
              .join(' · ')}
          </p>
          <p>
            <a href={picked.osmUrl} target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>
            {' · '}
            <a href={streetViewUrl(picked.lat, picked.lon)} target="_blank" rel="noreferrer">
              Street view
            </a>
            {' · '}
            <a href={mapsSearchUrl(picked.name)} target="_blank" rel="noreferrer">
              Search OSM
            </a>
            {picked.website ? (
              <>
                {' · '}
                <a href={picked.website} target="_blank" rel="noreferrer">
                  Website
                </a>
              </>
            ) : null}
          </p>
        </article>
      )}
    </div>
  )
}
