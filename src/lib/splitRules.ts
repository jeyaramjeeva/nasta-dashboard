import type { PartnerRow, SettlementPlan } from '../types'
import type { SplitRules } from './extrasStore'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

const EXCLUDED = new Set(['Box', 'Paypal', 'PayPal'])

function realPartners(partners: PartnerRow[]): PartnerRow[] {
  return partners.filter((p) => !EXCLUDED.has(p.name))
}

/**
 * Settlement modes:
 * - owed: pay each person their remaining expense balance
 * - custom_pct: split a pot by custom %
 * - expenses_first (recommended):
 *     1) repay what each partner put in (still owed)
 *     2) split leftover profit equally (or by %)
 *
 * For expenses_first, pass `pot` = money available to distribute
 * (usually total sales / cash). If omitted, pot = sum of balances
 * (reimbursement only — no profit left).
 */
export function applySplitRules(
  partners: PartnerRow[],
  rules: SplitRules,
  pot?: number,
): SettlementPlan[] {
  const people = realPartners(partners)
  if (!people.length) return []

  if (rules.mode === 'owed') {
    const owedPeople = people.filter((p) => p.balance > 0.5)
    const total = owedPeople.reduce((s, p) => s + p.balance, 0) || 1
    return owedPeople
      .map((p) => ({
        name: p.name,
        owed: round2(Math.max(0, p.balance)),
        shareOfTotal: round2(p.balance / total),
        suggestedPay: round2(Math.max(0, p.balance)),
        reimbursement: round2(Math.max(0, p.balance)),
        profitShare: 0,
      }))
      .sort((a, b) => b.suggestedPay - a.suggestedPay)
  }

  const pool =
    pot != null
      ? Math.max(0, pot)
      : people.reduce((s, p) => s + Math.max(0, p.balance), 0)

  const shareSum =
    people.reduce((s, p) => s + (rules.shares[p.name] ?? 0), 0) || people.length

  if (rules.mode === 'custom_pct') {
    return people
      .map((p) => {
        const share = (rules.shares[p.name] ?? 0) / shareSum
        return {
          name: p.name,
          owed: round2(Math.max(0, p.balance)),
          shareOfTotal: round2(share),
          suggestedPay: round2(pool * share),
          reimbursement: 0,
          profitShare: round2(pool * share),
        }
      })
      .filter((p) => p.suggestedPay > 0.009 || p.owed > 0.5)
      .sort((a, b) => b.suggestedPay - a.suggestedPay)
  }

  // ——— expenses_first ———
  // Step 1: repay what they put in (outstanding balances)
  let remaining = pool
  const reimbursement: Record<string, number> = {}
  for (const p of people) reimbursement[p.name] = 0

  const totalOwed = round2(
    people.reduce((s, p) => s + Math.max(0, p.balance), 0),
  )

  if (totalOwed > 0 && remaining > 0) {
    if (remaining >= totalOwed - 0.001) {
      for (const p of people) {
        const due = Math.max(0, p.balance)
        reimbursement[p.name] = round2(due)
        remaining = round2(remaining - due)
      }
    } else {
      // Not enough cash — pro-rata by what each is still owed
      for (const p of people) {
        const due = Math.max(0, p.balance)
        const pay = round2((due / totalOwed) * remaining)
        reimbursement[p.name] = pay
      }
      remaining = 0
    }
  }

  // Step 2: leftover = profit → equal (or custom %) share for everyone
  const profitShare: Record<string, number> = {}
  for (const p of people) profitShare[p.name] = 0

  if (remaining > 0.01) {
    for (const p of people) {
      const share = (rules.shares[p.name] ?? 1 / people.length) / shareSum
      profitShare[p.name] = round2(remaining * share)
    }
  }

  return people
    .map((p) => {
      const reimb = reimbursement[p.name] || 0
      const profit = profitShare[p.name] || 0
      const suggested = round2(reimb + profit)
      return {
        name: p.name,
        owed: round2(Math.max(0, p.balance)),
        shareOfTotal: round2(1 / people.length),
        suggestedPay: suggested,
        reimbursement: reimb,
        profitShare: profit,
      }
    })
    .filter((p) => p.suggestedPay > 0.009 || p.owed > 0.5)
    .sort((a, b) => b.suggestedPay - a.suggestedPay)
}

/** Short explanation of the waterfall for the UI. */
export function explainExpensesFirst(
  partners: PartnerRow[],
  pot: number,
): { totalOwed: number; profit: number; canFullyRepay: boolean } {
  const people = realPartners(partners)
  const totalOwed = round2(
    people.reduce((s, p) => s + Math.max(0, p.balance), 0),
  )
  const profit = round2(Math.max(0, pot - totalOwed))
  return {
    totalOwed,
    profit,
    canFullyRepay: pot + 0.001 >= totalOwed,
  }
}
