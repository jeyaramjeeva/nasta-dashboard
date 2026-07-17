import { computeMetrics } from './metrics'
import type { MergeResult, UploadMode } from './merge'
import type { Snapshot } from '../types'

export type IssueLevel = 'error' | 'warn' | 'info'

export interface ValidationIssue {
  level: IssueLevel
  code: string
  message: string
  count?: number
}

export interface ValidationReport {
  ok: boolean
  issues: ValidationIssue[]
  summary: {
    events: number
    transactions: number
    cashRows: number
    unpaid: number
    unknownEvents: number
    cashMismatch: number
  }
  merge?: Pick<
    MergeResult,
    'addedTransactions' | 'addedEvents' | 'updatedEvents' | 'addedCashRows'
  >
}

const UNPAID = new Set(['unpaid', 'pending', 'open', 'owing', 'due'])

export function validateSnapshot(
  snapshot: Snapshot,
  opts?: { mode?: UploadMode; merge?: MergeResult },
): ValidationReport {
  const eventIds = new Set(snapshot.events.map((e) => e.id))
  eventIds.add('Setup')

  const unknown = snapshot.transactions.filter(
    (t) => t.eventId && !eventIds.has(t.eventId),
  )
  const unpaid = snapshot.transactions.filter((t) =>
    UNPAID.has((t.status || '').trim().toLowerCase()),
  )
  const metrics = computeMetrics(snapshot)
  const issues: ValidationIssue[] = []

  if (unknown.length) {
    const samples = [...new Set(unknown.map((t) => t.eventId))].slice(0, 6)
    issues.push({
      level: 'error',
      code: 'missing_event',
      count: unknown.length,
      message: `${unknown.length} transaction(s) reference unknown event IDs: ${samples.join(', ')}`,
    })
  }

  if (unpaid.length) {
    issues.push({
      level: 'warn',
      code: 'unpaid_status',
      count: unpaid.length,
      message: `${unpaid.length} transaction(s) still marked unpaid / pending / open`,
    })
  }

  if (Math.abs(metrics.cashMismatch) > 5) {
    issues.push({
      level: 'warn',
      code: 'cash_mismatch',
      message: `Cash + PayPal differs from ledger by €${metrics.cashMismatch.toFixed(2)} (mit PayPal €${metrics.cashWithPaypal.toFixed(2)} vs ledger €${metrics.cashExpected.toFixed(2)})`,
    })
  } else {
    issues.push({
      level: 'info',
      code: 'cash_ok',
      message: `Cash reconciliation looks good (diff €${metrics.cashMismatch.toFixed(2)})`,
    })
  }

  const upcomingBare = snapshot.events.filter(
    (e) =>
      e.status === 'Upcoming' &&
      !snapshot.transactions.some((t) => t.eventId === e.id),
  )
  if (upcomingBare.length) {
    issues.push({
      level: 'warn',
      code: 'upcoming_empty',
      count: upcomingBare.length,
      message: `${upcomingBare.length} upcoming event(s) have no costs logged yet (${upcomingBare
        .map((e) => e.id)
        .slice(0, 5)
        .join(', ')})`,
    })
  }

  if (opts?.mode === 'merge' && opts.merge) {
    issues.push({
      level: 'info',
      code: 'merge_stats',
      message: `Merge will add ${opts.merge.addedTransactions} new transaction(s), ${opts.merge.addedEvents} new event(s), update ${opts.merge.updatedEvents} event(s), add ${opts.merge.addedCashRows} cash row(s)`,
    })
  }

  if (!snapshot.transactions.length) {
    issues.push({
      level: 'error',
      code: 'empty_tx',
      message: 'No transactions found in this workbook',
    })
  }

  const hasError = issues.some((i) => i.level === 'error')

  return {
    ok: !hasError,
    issues,
    summary: {
      events: snapshot.events.length,
      transactions: snapshot.transactions.length,
      cashRows: snapshot.cashBox.length,
      unpaid: unpaid.length,
      unknownEvents: unknown.length,
      cashMismatch: metrics.cashMismatch,
    },
    merge: opts?.merge
      ? {
          addedTransactions: opts.merge.addedTransactions,
          addedEvents: opts.merge.addedEvents,
          updatedEvents: opts.merge.updatedEvents,
          addedCashRows: opts.merge.addedCashRows,
        }
      : undefined,
  }
}
