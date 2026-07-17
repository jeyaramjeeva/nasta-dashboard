import { jsPDF } from 'jspdf'
import type { CalendarEventCard } from './calendar'
import type { WeatherAdvice } from './weatherAdvice'
import { formatGermanyCalendarDay } from './germanyTime'

/** One-pager PDF briefing for the next stall. */
export function downloadStallBriefingPdf(opts: {
  card: CalendarEventCard
  mission: string
  weatherAdvice: WeatherAdvice
  platesNeeded: number
  platePrice?: number
}) {
  const { card, mission, weatherAdvice, platesNeeded } = opts
  const platePrice = opts.platePrice ?? 8
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const margin = 48
  let y = margin

  const line = (text: string, size = 11, gap = 16) => {
    pdf.setFontSize(size)
    const wrapped = pdf.splitTextToSize(text, 500)
    pdf.text(wrapped, margin, y)
    y += wrapped.length * (size * 0.45 + 4) + gap * 0.35
  }

  pdf.setFont('helvetica', 'bold')
  line('Nasta Zentrum — Next stall briefing', 18, 10)
  pdf.setFont('helvetica', 'normal')
  line(`${card.event.id} · ${card.event.name}`, 14, 8)
  line(`${card.event.location}`, 12, 6)
  line(
    formatGermanyCalendarDay(card.event.startDate) +
      (card.totalDays > 1 ? ` · ${card.totalDays}-day stall` : ''),
    11,
    14,
  )

  pdf.setDrawColor(180)
  pdf.line(margin, y, 547, y)
  y += 18

  pdf.setFont('helvetica', 'bold')
  line(`Weather call: ${weatherAdvice.title}`, 12, 6)
  pdf.setFont('helvetica', 'normal')
  line(weatherAdvice.line, 11, 14)

  pdf.setFont('helvetica', 'bold')
  line('Today’s mission', 12, 6)
  pdf.setFont('helvetica', 'normal')
  line(mission || 'Protect the float. Sell plates. Log every expense.', 11, 14)

  pdf.setFont('helvetica', 'bold')
  line('Money snapshot', 12, 6)
  pdf.setFont('helvetica', 'normal')
  line(`Stall fee: €${card.event.fee.toFixed(2)}`, 11, 4)
  line(`Spend (incl. inventory): €${card.spend.toFixed(2)}`, 11, 4)
  line(
    `Expected net: ${card.net != null ? `€${card.net.toFixed(2)}` : '—'}`,
    11,
    4,
  )
  line(
    `Break-even hunt: ~${platesNeeded} plates at €${platePrice}`,
    11,
    14,
  )

  pdf.setFont('helvetica', 'bold')
  line('Prep checklist', 12, 6)
  pdf.setFont('helvetica', 'normal')
  const notes =
    card.prepNotes.length > 0
      ? card.prepNotes
      : ['Fee logged', 'Grocery ready', 'Start-of-day cash counted']
  for (const n of notes) line(`☐  ${n}`, 11, 4)

  y += 12
  pdf.setFont('helvetica', 'italic')
  line('Frisch · Gesund · Authentisch', 10, 4)
  line(`Generated ${new Date().toLocaleString('de-DE')}`, 9, 4)

  const safeId = card.event.id.replace(/[^\w-]+/g, '_')
  pdf.save(`nasta-briefing-${safeId}.pdf`)
}
