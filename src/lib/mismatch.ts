import type { CashBoxRow, Snapshot } from '../types'
import { countCash, ledgerBalance } from './cash'

export interface MismatchExplain {
  diff: number
  direction: 'short' | 'over' | 'ok'
  headline: string
  likelyCauses: string[]
  recentHints: string[]
}

export function explainCashMismatch(snapshot: Snapshot): MismatchExplain {
  const expected = ledgerBalance(snapshot.cashBox)
  const counted = countCash(snapshot.denominations)
  const paypal = snapshot.paypalBalance || 0
  const withPaypal = counted + paypal
  const diff = Math.round((withPaypal - expected) * 100) / 100

  if (Math.abs(diff) <= 5) {
    return {
      diff,
      direction: 'ok',
      headline: 'Cash + PayPal matches the ledger',
      likelyCauses: [],
      recentHints: [],
    }
  }

  const direction = diff < 0 ? 'short' : 'over'
  const recent = [...snapshot.cashBox].slice(-8).reverse()
  const recentHints = recent.map(
    (r) =>
      `${r.eventId}: ${r.transactionType} ${r.description} (${r.inAmount ? `+${r.inAmount}` : `−${r.outAmount}`})`,
  )

  const likelyCauses =
    direction === 'short'
      ? [
          'Likely unsettled sales not yet counted into the box',
          'Missing withdrawal / settlement logged in ledger but cash already removed',
          'PayPal balance outdated vs actual PayPal app',
          'Denomination count missed a high note (50€ / 20€)',
        ]
      : [
          'Sales income counted in cash but not yet logged in the ledger',
          'Float / change coins added physically but not recorded',
          'Settlement recorded as paid in Excel but cash still in the box',
          'Coin reserve transfer into main box not reflected in one of the totals',
        ]

  // Tailor with actual recent activity
  const lastSales = recent.find((r) => /sales/i.test(r.transactionType))
  const lastSettle = recent.find((r) => /settlement/i.test(r.transactionType))
  const lastWithdraw = recent.find((r) => /withdraw/i.test(r.transactionType))
  if (direction === 'short' && lastSettle) {
    likelyCauses.unshift(
      `Recent settlement “${lastSettle.description}” may explain cash leaving the box`,
    )
  }
  if (direction === 'over' && lastSales) {
    likelyCauses.unshift(
      `Recent sales “${lastSales.description}” may be in the count before the ledger caught up`,
    )
  }
  if (lastWithdraw) {
    likelyCauses.push(`Check withdrawal: ${lastWithdraw.description}`)
  }

  return {
    diff,
    direction,
    headline:
      direction === 'short'
        ? `Short by €${Math.abs(diff).toFixed(2)} (count lower than ledger)`
        : `Over by €${diff.toFixed(2)} (count higher than ledger)`,
    likelyCauses: likelyCauses.slice(0, 4),
    recentHints,
  }
}

export function sumRecentOut(cashBox: CashBoxRow[], n = 5): number {
  return cashBox
    .slice(-n)
    .reduce((s, r) => s + (r.outAmount || 0), 0)
}
