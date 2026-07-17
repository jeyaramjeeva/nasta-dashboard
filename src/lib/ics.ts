import type { EventRow } from '../types'
import { germanyWallTime } from './germanyTime'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Format as UTC ICS datetime. */
function toIcsUtc(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Build a .ics calendar for stall events (09:00–18:00 Europe/Berlin windows). */
export function buildStallCalendarIcs(events: EventRow[], calName = 'Nasta Stalls'): string {
  const now = toIcsUtc(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nasta Zentrum//Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
  ]

  for (const e of events) {
    if (!e.startDate) continue
    const start = germanyWallTime(e.startDate, 9, 0)
    if (!start) continue
    const endDate = e.endDate || e.startDate
    const end = germanyWallTime(endDate, 18, 0) || new Date(start.getTime() + 9 * 3600000)
    const uid = `${e.id.replace(/[^a-zA-Z0-9-]/g, '-')}@nastazentrum.de`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${toIcsUtc(start)}`,
      `DTEND:${toIcsUtc(end)}`,
      `SUMMARY:${escapeText(`Nasta · ${e.id} · ${e.name}`)}`,
      `LOCATION:${escapeText(e.location || '')}`,
      `DESCRIPTION:${escapeText(`Status: ${e.status} · Fee €${e.fee}`)}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(ics: string, filename = 'nasta-stalls.ics') {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
