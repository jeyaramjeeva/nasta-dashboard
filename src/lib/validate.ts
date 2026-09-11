import {
  buildDuplicateReport,
  formatDuplicateAlert,
  formatExactDuplicate,
  hasDuplicates,
  type DuplicateReport,
} from './duplicateCheck'
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
  duplicates: DuplicateReport
  summary: {
    events: number
    transactions: number
    cashRows: number
    unpaid: number
    unknownEvents: number
    cashMismatch: number
    duplicateGroups: number
  }
  merge?: Pick<
    MergeResult,
    | 'addedTransactions'
    | 'addedEvents'
    | 'updatedEvents'
    | 'addedCashRows'
    | 'skippedDuplicateTransactions'
    | 'incomingExactDuplicateRows'
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

  // Always scan for duplicates (exact rows, soft expenses, event ids, merge skips)
  const duplicates = buildDuplicateReport(snapshot, {
    alreadyInLive: opts?.merge?.skippedDuplicateTransactions ?? 0,
  })

  if (duplicates.duplicateEventIds.length) {
    issues.push({
      level: 'warn',
      code: 'duplicate_events',
      count: duplicates.duplicateEventIds.length,
      message: `Duplicate event ID(s) in sheet: ${duplicates.duplicateEventIds.slice(0, 8).join(', ')}`,
    })
  }

  if (duplicates.exactTx.length) {
    const rows = duplicates.exactTx.reduce((s, g) => s + g.count, 0)
    issues.push({
      level: 'warn',
      code: 'duplicate_exact',
      count: duplicates.exactTx.length,
      message: `${duplicates.exactTx.length} exact duplicate group(s) (${rows} rows) — same date/event/person/amount/description`,
    })
    for (const g of duplicates.exactTx.slice(0, 8)) {
      issues.push({
        level: 'warn',
        code: 'duplicate_exact_row',
        count: g.count,
        message: formatExactDuplicate(g),
      })
    }
    if (duplicates.exactTx.length > 8) {
      issues.push({
        level: 'info',
        code: 'duplicate_exact_more',
        message: `…and ${duplicates.exactTx.length - 8} more exact duplicate group(s)`,
      })
    }
  }

  if (duplicates.softExpenses.length) {
    issues.push({
      level: 'warn',
      code: 'duplicate_expense',
      count: duplicates.softExpenses.length,
      message: `${duplicates.softExpenses.length} possible duplicate expense group(s) (same day + person + amount)`,
    })
    for (const g of duplicates.softExpenses.slice(0, 8)) {
      issues.push({
        level: 'warn',
        code: 'duplicate_expense_row',
        count: g.count,
        message: formatDuplicateAlert(g),
      })
    }
    if (duplicates.softExpenses.length > 8) {
      issues.push({
        level: 'info',
        code: 'duplicate_expense_more',
        message: `…and ${duplicates.softExpenses.length - 8} more expense duplicate group(s)`,
      })
    }
  }

  if (opts?.merge?.skippedDuplicateTransactions) {
    issues.push({
      level: 'warn',
      code: 'duplicate_already_live',
      count: opts.merge.skippedDuplicateTransactions,
      message: `${opts.merge.skippedDuplicateTransactions} row(s) in this file already exist in live data (merge will skip them)`,
    })
  }

  if (opts?.merge?.incomingExactDuplicateRows) {
    issues.push({
      level: 'warn',
      code: 'duplicate_in_file',
      count: opts.merge.incomingExactDuplicateRows,
      message: `${opts.merge.incomingExactDuplicateRows} extra duplicate row(s) inside the Excel file itself`,
    })
  }

  if (!hasDuplicates(duplicates) && !(opts?.merge?.skippedDuplicateTransactions)) {
    issues.push({
      level: 'info',
      code: 'duplicates_ok',
      message: 'No duplicate transactions or event IDs detected',
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
  const dupGroups =
    duplicates.exactTx.length +
    duplicates.softExpenses.length +
    duplicates.duplicateEventIds.length

  return {
    ok: !hasError,
    issues,
    duplicates,
    summary: {
      events: snapshot.events.length,
      transactions: snapshot.transactions.length,
      cashRows: snapshot.cashBox.length,
      unpaid: unpaid.length,
      unknownEvents: unknown.length,
      cashMismatch: metrics.cashMismatch,
      duplicateGroups: dupGroups,
    },
    merge: opts?.merge
      ? {
          addedTransactions: opts.merge.addedTransactions,
          addedEvents: opts.merge.addedEvents,
          updatedEvents: opts.merge.updatedEvents,
          addedCashRows: opts.merge.addedCashRows,
          skippedDuplicateTransactions: opts.merge.skippedDuplicateTransactions,
          incomingExactDuplicateRows: opts.merge.incomingExactDuplicateRows,
        }
      : undefined,
  }
}
