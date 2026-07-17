import type { Transaction } from '../types'

export interface DuplicateExpenseGroup {
  date: string
  person: string
  amount: number
  count: number
  descriptions: string[]
  eventIds: string[]
}

/**
 * Flag expenses that share the same calendar day + person + amount.
 * Likely double-entries when logging grocery / stall costs.
 */
export function findDuplicateExpenses(
  transactions: Transaction[],
): DuplicateExpenseGroup[] {
  const map = new Map<
    string,
    {
      date: string
      person: string
      amount: number
      descriptions: string[]
      eventIds: string[]
    }
  >()

  for (const t of transactions) {
    if (t.type !== 'Expense') continue
    const date = (t.date || '').slice(0, 10)
    const person = (t.person || '').trim()
    const amount = Math.round(Math.abs(t.amount) * 100) / 100
    if (!date || !person || amount < 0.01) continue

    const key = `${date}|${person.toLowerCase()}|${amount.toFixed(2)}`
    const row = map.get(key)
    if (!row) {
      map.set(key, {
        date,
        person,
        amount,
        descriptions: [t.description || t.category || 'Expense'].filter(Boolean),
        eventIds: [t.eventId].filter(Boolean),
      })
    } else {
      row.descriptions.push(t.description || t.category || 'Expense')
      if (t.eventId && !row.eventIds.includes(t.eventId)) {
        row.eventIds.push(t.eventId)
      }
    }
  }

  return [...map.values()]
    .filter((g) => g.descriptions.length >= 2)
    .map((g) => ({
      ...g,
      count: g.descriptions.length,
      descriptions: uniqueKeepOrder(g.descriptions),
    }))
    .sort((a, b) => b.count - a.count || b.amount - a.amount || b.date.localeCompare(a.date))
}

function uniqueKeepOrder(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const k = item.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

export function formatDuplicateAlert(group: DuplicateExpenseGroup): string {
  const descs = group.descriptions.slice(0, 3).join('; ')
  const more =
    group.descriptions.length > 3
      ? ` +${group.descriptions.length - 3} more`
      : ''
  return `Possible duplicate: ${group.person} €${group.amount.toFixed(2)} on ${group.date} (${group.count}×) — ${descs}${more}`
}
