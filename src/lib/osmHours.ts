/** Small OSM opening_hours reader — common restaurant tags only, not the full spec. */

const DAY = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'] as const

export type OpenNow = 'open' | 'closed' | 'unknown'

function padTime(n: number) {
  return String(n).padStart(2, '0')
}

function minutesOf(hhmm: string): number | null {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 24 || min > 59) return null
  return Math.min(h, 23) * 60 + (h === 24 ? 0 : min)
}

function expandDays(token: string): number[] {
  const t = token.trim().toLowerCase()
  if (!t || t === 'ph') return []
  if (t === 'week' || t === 'mo-su') return [0, 1, 2, 3, 4, 5, 6]
  if (t === 'off') return []
  const range = t.split('-')
  if (range.length === 2) {
    const a = DAY.indexOf(range[0] as (typeof DAY)[number])
    const b = DAY.indexOf(range[1] as (typeof DAY)[number])
    if (a < 0 || b < 0) return []
    const out: number[] = []
    let i = a
    for (let n = 0; n < 7; n++) {
      out.push(i)
      if (i === b) break
      i = (i + 1) % 7
    }
    return out
  }
  const one = DAY.indexOf(t as (typeof DAY)[number])
  return one >= 0 ? [one] : []
}

type Rule = { days: number[]; ranges: [number, number][]; off: boolean }

function parseRule(chunk: string): Rule | null {
  const raw = chunk.trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower === '24/7') {
    return { days: [0, 1, 2, 3, 4, 5, 6], ranges: [[0, 24 * 60]], off: false }
  }
  const off = /\boff\b/.test(lower)
  const dayPart = raw.split(/\s+/)[0] || ''
  const days: number[] = []
  for (const tok of dayPart.split(',')) days.push(...expandDays(tok))
  if (!days.length && !off) return null
  if (off) return { days: days.length ? days : [0, 1, 2, 3, 4, 5, 6], ranges: [], off: true }
  const times = raw.slice(dayPart.length)
  const ranges: [number, number][] = []
  for (const span of times.split(',')) {
    const bits = span.trim().split('-')
    if (bits.length !== 2) continue
    const a = minutesOf(bits[0])
    const b = minutesOf(bits[1])
    if (a == null || b == null) continue
    ranges.push([a, b === 0 && bits[1].trim() === '24:00' ? 24 * 60 : b])
  }
  if (!ranges.length) return null
  return { days, ranges, off: false }
}

export function parseOpeningHours(tag: string): Rule[] {
  if (!tag.trim()) return []
  return tag
    .split(';')
    .map(parseRule)
    .filter((r): r is Rule => r != null)
}

export function openingStatus(tag: string, at = new Date()): OpenNow {
  const rules = parseOpeningHours(tag)
  if (!rules.length) return 'unknown'
  const day = at.getDay()
  const mins = at.getHours() * 60 + at.getMinutes()
  let matched: Rule | undefined
  for (const r of rules) {
    if (r.days.includes(day)) matched = r
  }
  if (!matched) return 'closed'
  if (matched.off) return 'closed'
  for (const [a, b] of matched.ranges) {
    if (b < a) {
      if (mins >= a || mins < b) return 'open'
    } else if (mins >= a && mins < b) return 'open'
  }
  return 'closed'
}

export function formatOpenNow(tag: string, at = new Date()): string {
  const s = openingStatus(tag, at)
  if (s === 'unknown') return 'Hours not parsed'
  const hh = `${padTime(at.getHours())}:${padTime(at.getMinutes())}`
  return s === 'open' ? `Open now (${hh})` : `Closed now (${hh})`
}
