/** Canonical Excel upload / history name: "Nasta Zentrum Tracker 20July.xlsx" */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** Format like 20July (day + English month, no space). */
export function formatUploadDateLabel(date: Date = new Date()): string {
  const day = date.getDate()
  const month = MONTHS[date.getMonth()] || 'Month'
  return `${day}${month}`
}

/** Always use the team naming convention for publishes / history. */
export function standardUploadFileName(date: Date = new Date()): string {
  return `Nasta Zentrum Tracker ${formatUploadDateLabel(date)}.xlsx`
}

/** Parse a date hint from a filename like "...20July.xlsx" or fall back to today. */
export function dateFromUploadName(name: string | undefined): Date {
  const m = String(name || '').match(/(\d{1,2})\s*(January|February|March|April|May|June|July|August|September|October|November|December)/i)
  if (!m) return new Date()
  const day = Number(m[1])
  const monthIdx = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase())
  if (!day || monthIdx < 0) return new Date()
  const year = new Date().getFullYear()
  const d = new Date(year, monthIdx, day)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

/** Prefer date encoded in the file name when present. */
export function standardUploadFileNameFrom(source: string | undefined): string {
  return standardUploadFileName(dateFromUploadName(source))
}
