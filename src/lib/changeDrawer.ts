/** Suggest EUR notes & coins to return as change (greedy). */

export interface ChangePiece {
  value: number
  label: string
  count: number
}

const EUR_DENOMS = [
  { value: 50, label: '50 €' },
  { value: 20, label: '20 €' },
  { value: 10, label: '10 €' },
  { value: 5, label: '5 €' },
  { value: 2, label: '2 €' },
  { value: 1, label: '1 €' },
  { value: 0.5, label: '50 ¢' },
  { value: 0.2, label: '20 ¢' },
  { value: 0.1, label: '10 ¢' },
  { value: 0.05, label: '5 ¢' },
  { value: 0.02, label: '2 ¢' },
  { value: 0.01, label: '1 ¢' },
] as const

export function suggestChange(amountEuro: number): ChangePiece[] {
  let cents = Math.round(Math.max(0, amountEuro) * 100)
  if (cents <= 0) return []
  const out: ChangePiece[] = []
  for (const d of EUR_DENOMS) {
    const piece = Math.round(d.value * 100)
    const count = Math.floor(cents / piece)
    if (count > 0) {
      out.push({ value: d.value, label: d.label, count })
      cents -= count * piece
    }
  }
  return out
}

export function formatChangeSuggestion(pieces: ChangePiece[]): string {
  return pieces.map((p) => `${p.count}× ${p.label}`).join(' · ')
}
