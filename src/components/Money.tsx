export function money(n: number, opts?: { signed?: boolean }): string {
  const abs = Math.abs(n)
  const formatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(abs)
  if (opts?.signed) {
    if (n > 0) return `+${formatted}`
    if (n < 0) return `−${formatted}`
  }
  if (n < 0) return `−${formatted}`
  return formatted
}

export function Money({
  value,
  signed = false,
  colored = false,
}: {
  value: number
  signed?: boolean
  colored?: boolean
}) {
  const cls = colored ? (value >= 0 ? 'pos' : 'neg') : undefined
  return <span className={cls}>{money(value, { signed })}</span>
}
