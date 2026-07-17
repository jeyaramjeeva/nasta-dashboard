/** Live weather via Open-Meteo (no API key). Europe/Berlin daily codes. */

import type { WeatherTag } from './extrasStore'

export type WeatherIconKind = 'sun' | 'partly' | 'cloud' | 'rain' | 'storm' | 'snow' | 'fog'

export interface LiveDayWeather {
  date: string
  code: number
  tempMax: number | null
  precipMm: number | null
  tag: WeatherTag
  icon: WeatherIconKind
  label: string
}

export interface GeoPoint {
  name: string
  lat: number
  lon: number
}

const GEO_CACHE = 'nasta-geo-cache-v1'
const WX_CACHE = 'nasta-wx-cache-v1'
const WX_TTL_MS = 60 * 60 * 1000

/** Common DE stall cities when Excel location text is messy. */
const CITY_FALLBACK: Record<string, GeoPoint> = {
  münchen: { name: 'München', lat: 48.137, lon: 11.575 },
  munich: { name: 'München', lat: 48.137, lon: 11.575 },
  berlin: { name: 'Berlin', lat: 52.52, lon: 13.405 },
  hamburg: { name: 'Hamburg', lat: 53.551, lon: 9.994 },
  köln: { name: 'Köln', lat: 50.938, lon: 6.96 },
  koln: { name: 'Köln', lat: 50.938, lon: 6.96 },
  cologne: { name: 'Köln', lat: 50.938, lon: 6.96 },
  wilhelmplatz: { name: 'Köln', lat: 50.938, lon: 6.96 },
  krefeld: { name: 'Krefeld', lat: 51.339, lon: 6.585 },
  frankfurt: { name: 'Frankfurt', lat: 50.11, lon: 8.682 },
  stuttgart: { name: 'Stuttgart', lat: 48.776, lon: 9.177 },
  düsseldorf: { name: 'Düsseldorf', lat: 51.227, lon: 6.774 },
  dusseldorf: { name: 'Düsseldorf', lat: 51.227, lon: 6.774 },
  nürnberg: { name: 'Nürnberg', lat: 49.452, lon: 11.077 },
  nuremberg: { name: 'Nürnberg', lat: 49.452, lon: 11.077 },
  leipzig: { name: 'Leipzig', lat: 51.34, lon: 12.375 },
  dresden: { name: 'Dresden', lat: 51.05, lon: 13.738 },
  hannover: { name: 'Hannover', lat: 52.375, lon: 9.732 },
  bremen: { name: 'Bremen', lat: 53.079, lon: 8.802 },
  freiburg: { name: 'Freiburg', lat: 47.999, lon: 7.842 },
  augsburg: { name: 'Augsburg', lat: 48.371, lon: 10.898 },
  regensburg: { name: 'Regensburg', lat: 49.013, lon: 12.101 },
  würzburg: { name: 'Würzburg', lat: 49.792, lon: 9.931 },
  ulm: { name: 'Ulm', lat: 48.401, lon: 9.987 },
}

function readCache<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') as Record<string, T>
  } catch {
    return {}
  }
}

function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota */
  }
}

export function weatherCodeToIcon(code: number): WeatherIconKind {
  if (code === 0) return 'sun'
  if (code === 1 || code === 2) return 'partly'
  if (code === 3) return 'cloud'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 95) return 'storm'
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 85 && code <= 86)
  ) {
    return 'rain'
  }
  return 'cloud'
}

export function weatherCodeToTag(code: number): WeatherTag {
  if (code === 0 || code === 1) return 'sunny'
  if (code === 2) return 'good'
  if (code === 3 || code === 45 || code === 48) return 'mixed'
  if (code >= 71 && code <= 77) return 'rainy'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) {
    return 'rainy'
  }
  return 'mixed'
}

export function weatherCodeLabel(code: number): string {
  if (code === 0) return 'Clear'
  if (code === 1) return 'Mainly clear'
  if (code === 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code === 45 || code === 48) return 'Fog'
  if (code >= 51 && code <= 55) return 'Drizzle'
  if (code >= 61 && code <= 65) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Showers'
  if (code >= 95) return 'Thunderstorm'
  return 'Cloudy'
}

function normalizeLocKey(location: string): string {
  return location.trim().toLowerCase().replace(/\s+/g, ' ')
}

function guessCityFallback(location: string): GeoPoint | null {
  const key = normalizeLocKey(location)
  for (const [city, point] of Object.entries(CITY_FALLBACK)) {
    if (key.includes(city)) return point
  }
  return null
}

export async function geocodeLocation(location: string): Promise<GeoPoint | null> {
  const trimmed = location.trim()
  if (!trimmed) return null
  const cacheKey = normalizeLocKey(trimmed)
  const cache = readCache<GeoPoint>(GEO_CACHE)
  if (cache[cacheKey]) return cache[cacheKey]!

  const fallback = guessCityFallback(trimmed)
  // Prefer city after comma ("Wilhelmplatz, Köln" → Köln) so stall squares resolve.
  const parts = trimmed.split(/[,·|]/).map((p) => p.trim()).filter(Boolean)
  const queries = [...new Set([parts[parts.length - 1], parts[0], trimmed].filter(Boolean))]

  for (const query of queries) {
    try {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
      url.searchParams.set('name', query!)
      url.searchParams.set('count', '1')
      url.searchParams.set('language', 'de')
      url.searchParams.set('format', 'json')
      url.searchParams.set('countryCode', 'DE')
      const res = await fetch(url.toString())
      if (!res.ok) continue
      const json = (await res.json()) as {
        results?: { name: string; latitude: number; longitude: number }[]
      }
      const hit = json.results?.[0]
      if (hit) {
        const point = { name: hit.name, lat: hit.latitude, lon: hit.longitude }
        cache[cacheKey] = point
        writeCache(GEO_CACHE, cache)
        return point
      }
    } catch {
      /* try next query / fallback */
    }
  }

  if (fallback) {
    cache[cacheKey] = fallback
    writeCache(GEO_CACHE, cache)
    return fallback
  }
  return null
}

interface WxCacheEntry {
  at: number
  days: LiveDayWeather[]
}

function parseDailyPayload(json: {
  daily?: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: (number | null)[]
    precipitation_sum: (number | null)[]
  }
}): LiveDayWeather[] {
  const daily = json.daily
  if (!daily?.time?.length) return []
  return daily.time.map((date, i) => {
    const code = Number(daily.weather_code[i] ?? 3)
    return {
      date,
      code,
      tempMax: daily.temperature_2m_max[i] ?? null,
      precipMm: daily.precipitation_sum[i] ?? null,
      tag: weatherCodeToTag(code),
      icon: weatherCodeToIcon(code),
      label: weatherCodeLabel(code),
    }
  })
}

async function fetchDailyFromUrl(url: URL): Promise<LiveDayWeather[]> {
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`weather ${res.status}`)
  return parseDailyPayload((await res.json()) as Parameters<typeof parseDailyPayload>[0])
}

function weatherQueryUrl(
  base: string,
  lat: number,
  lon: number,
  start: string,
  end: string,
): URL {
  const url = new URL(base)
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,precipitation_sum')
  url.searchParams.set('timezone', 'Europe/Berlin')
  url.searchParams.set('start_date', start)
  url.searchParams.set('end_date', end)
  return url
}

async function fetchDailyRange(
  lat: number,
  lon: number,
  start: string,
  end: string,
): Promise<LiveDayWeather[]> {
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}:${start}:${end}`
  const cache = readCache<WxCacheEntry>(WX_CACHE)
  const hit = cache[cacheKey]
  if (hit && Date.now() - hit.at < WX_TTL_MS) return hit.days

  const today = new Date()
  const startD = new Date(start + 'T12:00:00Z')
  // Forecast covers ~last 92 days + upcoming; archive lags and 400s on recent dates.
  const useArchiveFirst = startD.getTime() < today.getTime() - 80 * 86400000

  const forecastUrl = weatherQueryUrl(
    'https://api.open-meteo.com/v1/forecast',
    lat,
    lon,
    start,
    end,
  )
  const archiveUrl = weatherQueryUrl(
    'https://archive-api.open-meteo.com/v1/archive',
    lat,
    lon,
    start,
    end,
  )

  let days: LiveDayWeather[] = []
  const primary = useArchiveFirst ? archiveUrl : forecastUrl
  const secondary = useArchiveFirst ? forecastUrl : archiveUrl
  try {
    days = await fetchDailyFromUrl(primary)
  } catch {
    days = await fetchDailyFromUrl(secondary)
  }

  cache[cacheKey] = { at: Date.now(), days }
  writeCache(WX_CACHE, cache)
  return days
}

export type LiveWeatherByDate = Record<string, LiveDayWeather>

/**
 * Fetch live weather for unique locations × date spans.
 * Returns map keyed by `yyyy-mm-dd` (one forecast per day; last location wins if clash).
 * Also returns per-event map `eventId|date`.
 */
export async function fetchLiveWeatherForStalls(
  stalls: { eventId: string; location: string; dates: string[] }[],
): Promise<{
  byDate: LiveWeatherByDate
  byEventDate: Record<string, LiveDayWeather>
  errors: string[]
}> {
  const byDate: LiveWeatherByDate = {}
  const byEventDate: Record<string, LiveDayWeather> = {}
  const errors: string[] = []

  const byLoc = new Map<string, { location: string; dates: Set<string>; eventIds: string[] }>()
  for (const s of stalls) {
    if (!s.location || !s.dates.length) continue
    const key = normalizeLocKey(s.location)
    const cur = byLoc.get(key) || {
      location: s.location,
      dates: new Set<string>(),
      eventIds: [],
    }
    for (const d of s.dates) cur.dates.add(d)
    cur.eventIds.push(s.eventId)
    byLoc.set(key, cur)
  }

  for (const group of byLoc.values()) {
    const geo = await geocodeLocation(group.location)
    if (!geo) {
      errors.push(`No map pin for “${group.location}”`)
      continue
    }
    const dates = [...group.dates].sort()
    const start = dates[0]!
    const end = dates[dates.length - 1]!
    try {
      const days = await fetchDailyRange(geo.lat, geo.lon, start, end)
      const want = new Set(dates)
      for (const day of days) {
        if (!want.has(day.date)) continue
        byDate[day.date] = day
        for (const eventId of group.eventIds) {
          byEventDate[`${eventId}|${day.date}`] = day
        }
      }
    } catch (e) {
      errors.push(
        e instanceof Error
          ? `Weather failed for ${group.location}: ${e.message}`
          : `Weather failed for ${group.location}`,
      )
    }
  }

  return { byDate, byEventDate, errors }
}

/** Manual tag → icon when live weather missing. */
export function tagToIcon(tag: WeatherTag | '' | undefined): WeatherIconKind | null {
  if (!tag) return null
  if (tag === 'sunny' || tag === 'good') return 'sun'
  if (tag === 'mixed') return 'partly'
  if (tag === 'rainy') return 'rain'
  if (tag === 'windy') return 'cloud'
  return null
}
