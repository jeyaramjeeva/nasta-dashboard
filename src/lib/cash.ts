import type { CashBoxRow, Denomination } from '../types'

/** Real ledger rows only — Setup / E001… (ignore Excel summary blocks). */
export function isLedgerEventId(eventId: string): boolean {
  const id = eventId.trim()
  if (id === 'Setup') return true
  return /^E\d+$/i.test(id)
}

/** True for labels like "2 Euro", "50 Cents" (not "Central …"). */
export function isDenomLabel(label: string): boolean {
  return /\b(\d+(?:[.,]\d+)?)\s*(euro|cents?)\b/i.test(label.trim())
}

export function denomValue(label: string): number {
  const s = label.toLowerCase()
  if (s.includes('paypal') || s === 'cash' || /\bcount\b|\btotal\b/i.test(s)) {
    return 0
  }
  if (!isDenomLabel(label)) return 0
  const m = s.match(/(\d+(?:[.,]\d+)?)/)
  if (!m) return 0
  const n = Number(m[1].replace(',', '.'))
  if (/\bcents?\b/.test(s)) return n / 100
  return n
}

export function countCash(denominations: Denomination[]): number {
  return round2(
    denominations.reduce((sum, d) => sum + denomValue(d.label) * d.count, 0),
  )
}

export function ledgerBalance(cashBox: CashBoxRow[]): number {
  let bal = 0
  for (const r of cashBox) {
    if (!isLedgerEventId(r.eventId)) continue
    bal += r.inAmount - r.outAmount
  }
  return round2(bal)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
