/** All calendar dates & display times use Germany (Europe/Berlin). */

export const GERMANY_TZ = 'Europe/Berlin'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** yyyy-mm-dd for an instant as seen on a German clock. */
export function germanyYmd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: GERMANY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function germanyTodayYmd(now = new Date()): string {
  return germanyYmd(now)
}

export function germanyParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: GERMANY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '0'
  let hour = Number(get('hour'))
  if (hour === 24) hour = 0
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour,
    minute: Number(get('minute')),
    second: Number(get('second')),
  }
}

/** Offset of Europe/Berlin vs UTC at this instant (ms to add to UTC to get Berlin wall). */
function berlinOffsetMs(at: Date): number {
  const p = germanyParts(at)
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asIfUtc - at.getTime()
}

/**
 * Instant when the German clock shows yyyy-mm-dd at hour:minute.
 * Used for stall countdown (default open 09:00 Berlin).
 */
export function germanyWallTime(
  ymd: string,
  hour = 9,
  minute = 0,
): Date | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  // First guess: treat wall time as UTC, then correct by Berlin offset
  let utc = Date.UTC(y, mo - 1, d, hour, minute, 0)
  for (let i = 0; i < 3; i++) {
    const offset = berlinOffsetMs(new Date(utc))
    utc = Date.UTC(y, mo - 1, d, hour, minute, 0) - offset
  }
  return new Date(utc)
}

export function formatGermanyDate(
  input: Date | string | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (input == null || input === '') return '—'
  const d = typeof input === 'string' ? parseFlexible(input) : input
  if (!d || Number.isNaN(d.getTime())) return String(input)
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: GERMANY_TZ,
    dateStyle: 'medium',
    ...opts,
  }).format(d)
}

export function formatGermanyDateTime(
  input: Date | string | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (input == null || input === '') return '—'
  const d = typeof input === 'string' ? new Date(input) : input
  if (!d || Number.isNaN(d.getTime())) return String(input)
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: GERMANY_TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...opts,
  }).format(d)
}

/** Format a calendar yyyy-mm-dd (no TZ shift) for German display. */
export function formatGermanyCalendarDay(ymd: string | null | undefined): string {
  if (!ymd) return '—'
  const d = germanyWallTime(ymd, 12, 0)
  if (!d) return ymd
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: GERMANY_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d)
}

function parseFlexible(s: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return germanyWallTime(s, 12, 0)
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function germanyMonthLabel(year: number, month: number): string {
  const d = germanyWallTime(`${year}-${pad(month)}-01`, 12, 0)
  if (!d) return `${month}/${year}`
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: GERMANY_TZ,
    month: 'long',
    year: 'numeric',
  }).format(d)
}
