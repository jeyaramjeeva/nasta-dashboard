import { transactionKey } from './merge'
import {
  findDuplicateExpenses,
  formatDuplicateAlert,
  type DuplicateExpenseGroup,
} from './duplicateExpenses'
import type { EventRow, Snapshot, Transaction } from '../types'

export interface ExactDuplicateGroup {
  key: string
  count: number
  sample: string
}

export interface DuplicateReport {
  exactTx: ExactDuplicateGroup[]
  softExpenses: DuplicateExpenseGroup[]
  duplicateEventIds: string[]
  /** Incoming rows that already exist in live (merge skip). */
  alreadyInLive: number
}

/** Exact same row signature appearing 2+ times in the workbook/snapshot. */
export function findExactDuplicateTransactions(
  transactions: Transaction[],
): ExactDuplicateGroup[] {
  const counts = new Map<string, { count: number; sample: string }>()
  for (const t of transactions) {
    const key = transactionKey(t)
    const sample = [
      t.date?.slice(0, 10) || '—',
      t.eventId || '',
      t.person || '',
      t.type,
      `€${Math.abs(t.amount).toFixed(2)}`,
      (t.description || t.category || '').slice(0, 40),
    ]
      .filter(Boolean)
      .join(' · ')
    const prev = counts.get(key)
    if (!prev) counts.set(key, { count: 1, sample })
    else prev.count += 1
  }
  return [...counts.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([key, v]) => ({ key, count: v.count, sample: v.sample }))
    .sort((a, b) => b.count - a.count)
}

export function findDuplicateEventIds(events: EventRow[]): string[] {
  const seen = new Set<string>()
  const dups = new Set<string>()
  for (const e of events) {
    const id = (e.id || '').trim()
    if (!id) continue
    if (seen.has(id)) dups.add(id)
    else seen.add(id)
  }
  return [...dups].sort()
}

export function buildDuplicateReport(
  snapshot: Snapshot,
  opts?: { alreadyInLive?: number },
): DuplicateReport {
  return {
    exactTx: findExactDuplicateTransactions(snapshot.transactions),
    softExpenses: findDuplicateExpenses(snapshot.transactions),
    duplicateEventIds: findDuplicateEventIds(snapshot.events),
    alreadyInLive: opts?.alreadyInLive ?? 0,
  }
}

export function hasDuplicates(report: DuplicateReport): boolean {
  return (
    report.exactTx.length > 0 ||
    report.softExpenses.length > 0 ||
    report.duplicateEventIds.length > 0 ||
    report.alreadyInLive > 0
  )
}

export function formatExactDuplicate(g: ExactDuplicateGroup): string {
  return `Exact duplicate row (${g.count}×): ${g.sample}`
}

export { formatDuplicateAlert }
