/** Euro amount helpers — keep decimals like 3.50 while typing and on save. */

export function roundEuro(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

/** Parse "3,5" / "3.5" → 3.5 (empty/invalid → 0). */
export function parseEuroField(raw: string | number): number {
  if (typeof raw === 'number') return roundEuro(raw)
  const t = String(raw || '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.')
  if (t === '' || t === '.' || t === '-') return 0
  const n = Number(t)
  return roundEuro(n)
}

/** Allow intermediate keystrokes: "", "3", "3.", "3.5", "3," */
export function isEuroFieldTyping(raw: string): boolean {
  return raw === '' || /^\d*[.,]?\d{0,2}$/.test(String(raw).trim())
}

/** Value for controlled text/number-ish fields (keeps .5). */
export function formatEuroField(n: number): string {
  if (!Number.isFinite(n)) return ''
  const r = roundEuro(n)
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')
}

/** Menu / cart label: €3.50 or €6 */
export function formatEuroLabel(n: number): string {
  const r = roundEuro(n)
  return r % 1 === 0 ? r.toFixed(0) : r.toFixed(2)
}
