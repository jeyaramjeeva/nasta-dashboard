import type { PartnerRow, Transaction } from '../types'

export function recomputePartners(transactions: Transaction[]): PartnerRow[] {
  const names = new Set<string>()
  for (const t of transactions) {
    if (t.person && !['Box', 'Paypal', 'PayPal'].includes(t.person)) {
      names.add(t.person)
    }
  }
  for (const n of ['Jeeva', 'Sriram', 'Sneha']) names.add(n)

  return [...names]
    .sort()
    .map((name) => {
      const paid = transactions
        .filter((t) => t.person === name && t.type === 'Expense')
        .reduce((s, t) => s + Math.abs(t.amount), 0)
      const returned = transactions
        .filter((t) => t.person === name && t.type === 'Settlement')
        .reduce((s, t) => s + Math.abs(t.amount), 0)
      return {
        name,
        paid: round2(paid),
        returned: round2(returned),
        balance: round2(paid - returned),
      }
    })
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
