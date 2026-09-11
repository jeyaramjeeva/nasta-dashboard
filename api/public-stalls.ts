import type { VercelRequest, VercelResponse } from '@vercel/node'

type EventRow = {
  id: string
  name: string
  location: string
  mapsQuery?: string
  startDate: string | null
  endDate: string | null
  days?: number
  status: string
  fee?: number
}

type EventBook = {
  extras?: EventRow[]
  patches?: Record<string, Partial<EventRow>>
}

function json(res: VercelResponse, status: number, data: unknown) {
  res.status(status).json(data)
}

function supabaseKeys() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return { url: url.replace(/\/$/, ''), key: service || anon }
}

async function sbGet(path: string): Promise<unknown> {
  const { url, key } = supabaseKeys()
  if (!url || !key) return null
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) return null
  return res.json()
}

function normStatus(s: string): string {
  const x = (s || '').trim().toLowerCase()
  if (x === 'completed' || x === 'complete') return 'Completed'
  if (x === 'confirmed' || x === 'confirm') return 'Confirmed'
  if (x === 'rejected') return 'Rejected'
  if (x === 'applied' || x === 'upcoming') return x === 'upcoming' ? 'Upcoming' : 'Applied'
  return s || 'Applied'
}

function impacts(status: string): boolean {
  const n = normStatus(status)
  return n === 'Confirmed' || n === 'Completed'
}

function eventDays(e: EventRow): string[] {
  if (!e.startDate) return []
  const start = new Date(e.startDate + 'T12:00:00Z')
  let total = Math.max(1, e.days || 1)
  if (e.endDate) {
    const end = new Date(e.endDate + 'T12:00:00Z')
    const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    if (diff > 0) total = diff
  }
  const out: string[] = []
  for (let i = 0; i < total; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function berlinToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function berlinHour(): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date())
  return Number(h) || 0
}

function mergeEvents(excel: EventRow[], book: EventBook | null): EventRow[] {
  const map = new Map<string, EventRow>()
  for (const e of excel || []) {
    if (!e?.id) continue
    map.set(e.id, { ...e, status: normStatus(e.status) })
  }
  for (const e of book?.extras || []) {
    if (!e?.id) continue
    map.set(e.id, { ...e, status: normStatus(e.status) })
  }
  for (const [id, patch] of Object.entries(book?.patches || {})) {
    const prev = map.get(id)
    if (!prev) continue
    const next = {
      ...prev,
      ...patch,
      status: normStatus(String(patch.status || prev.status)),
    }
    if (patch.mapsQuery !== undefined && !String(patch.mapsQuery || '').trim()) {
      delete next.mapsQuery
    }
    map.set(id, next)
  }
  return [...map.values()]
}

function cityOf(location: string): string {
  return (location || '').split(',')[0]?.trim() || location || '—'
}

function pinQuery(e: EventRow): string {
  const pin = (e.mapsQuery || '').trim()
  if (pin) {
    // lat,lng — don't append Germany
    if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(pin)) return pin
    return /germany/i.test(pin) ? pin : `${pin}, Germany`
  }
  const loc = (e.location || '').trim()
  return loc ? `${loc}, Germany` : 'Germany'
}

function mapsUrl(e: EventRow): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pinQuery(e))}`
}

function mapsEmbed(e: EventRow): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(pinQuery(e))}&z=17&output=embed`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    json(res, 405, { error: 'GET only' })
    return
  }

  try {
    const snapRows = (await sbGet(
      'snapshots?id=eq.latest&select=payload',
    )) as { payload?: { events?: EventRow[] } }[] | null
    const excel = snapRows?.[0]?.payload?.events || []

    const extrasRows = (await sbGet(
      'team_extras?id=eq.latest&select=stall_ops',
    )) as { stall_ops?: { eventBook?: EventBook } }[] | null
    const book = extrasRows?.[0]?.stall_ops?.eventBook || null

    const events = mergeEvents(excel, book)
    const today = berlinToday()
    const hour = berlinHour()

    const stalls = events
      .filter((e) => e.location && e.startDate)
      .filter((e) => {
        const n = normStatus(e.status)
        return n !== 'Rejected'
      })
      .map((e) => {
        const days = eventDays(e)
        const onToday = days.includes(today)
        const future = (e.startDate || '') >= today
        const past = (e.endDate || e.startDate || '') < today
        const liveOpen = onToday && impacts(e.status) && hour >= 10 && hour < 21
        let phase: 'open' | 'closed_today' | 'upcoming' | 'past' = 'upcoming'
        if (liveOpen) phase = 'open'
        else if (onToday) phase = 'closed_today'
        else if (past) phase = 'past'
        else if (future || days.some((d) => d >= today)) phase = 'upcoming'
        else phase = 'past'
        return {
          id: e.id,
          name: e.name,
          location: e.location,
          mapsQuery: (e.mapsQuery || '').trim() || null,
          city: cityOf(e.location),
          startDate: e.startDate,
          endDate: e.endDate || e.startDate,
          days: days.length,
          status: normStatus(e.status),
          phase,
          open: liveOpen,
          mapsUrl: mapsUrl(e),
          mapsEmbed: mapsEmbed(e),
          dateSpan: days,
        }
      })
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))

    const upcoming = stalls.filter((s) => s.phase === 'open' || s.phase === 'upcoming' || s.phase === 'closed_today')
    const cities = [
      ...new Set(
        stalls
          .filter((s) => s.status === 'Completed' || s.status === 'Confirmed')
          .map((s) => s.city)
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b))

    json(res, 200, {
      today,
      hour,
      stalls: upcoming.slice(0, 40),
      allStalls: stalls.slice(-80),
      cities,
      openNow: stalls.filter((s) => s.open),
    })
  } catch (err) {
    json(res, 200, {
      today: berlinToday(),
      stalls: [],
      allStalls: [],
      cities: [],
      openNow: [],
      warning: err instanceof Error ? err.message : 'Unavailable',
    })
  }
}
