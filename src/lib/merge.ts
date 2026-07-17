import { recomputePartners } from './partners'
import type { CashBoxRow, EventRow, Snapshot, Transaction } from '../types'

export type UploadMode = 'replace' | 'merge'

export function transactionKey(t: Transaction): string {
  return [
    t.date ?? '',
    t.eventId,
    t.type,
    t.category,
    t.description,
    String(Math.round(t.amount * 100) / 100),
    t.person,
    t.status,
  ].join('|')
}

export function cashKey(r: CashBoxRow): string {
  return [
    r.eventId,
    r.date ?? '',
    r.transactionType,
    r.description,
    String(r.inAmount),
    String(r.outAmount),
  ].join('|')
}

export interface MergeResult {
  snapshot: Snapshot
  addedTransactions: number
  updatedEvents: number
  addedEvents: number
  addedCashRows: number
}

export function mergeSnapshots(current: Snapshot | null, incoming: Snapshot): MergeResult {
  if (!current) {
    return {
      snapshot: {
        ...incoming,
        partners: recomputePartners(incoming.transactions),
      },
      addedTransactions: incoming.transactions.length,
      updatedEvents: 0,
      addedEvents: incoming.events.length,
      addedCashRows: incoming.cashBox.length,
    }
  }

  const eventMap = new Map<string, EventRow>()
  for (const e of current.events) eventMap.set(e.id, e)
  let addedEvents = 0
  let updatedEvents = 0
  for (const e of incoming.events) {
    if (eventMap.has(e.id)) {
      eventMap.set(e.id, e)
      updatedEvents += 1
    } else {
      eventMap.set(e.id, e)
      addedEvents += 1
    }
  }

  const txMap = new Map<string, Transaction>()
  for (const t of current.transactions) txMap.set(transactionKey(t), t)
  let addedTransactions = 0
  for (const t of incoming.transactions) {
    const key = transactionKey(t)
    if (!txMap.has(key)) {
      txMap.set(key, t)
      addedTransactions += 1
    }
  }

  // Cash movements: keep history, append truly new rows; take latest counts from incoming
  const cashMap = new Map<string, CashBoxRow>()
  for (const r of current.cashBox) cashMap.set(cashKey(r), r)
  let addedCashRows = 0
  for (const r of incoming.cashBox) {
    const key = cashKey(r)
    if (!cashMap.has(key)) {
      cashMap.set(key, r)
      addedCashRows += 1
    }
  }

  const transactions = [...txMap.values()].sort((a, b) =>
    (a.date || '').localeCompare(b.date || ''),
  )

  const snapshot: Snapshot = {
    uploadedAt: new Date().toISOString(),
    sourceFile: incoming.sourceFile,
    events: [...eventMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
    transactions,
    cashBox: [...cashMap.values()],
    denominations: incoming.denominations.length
      ? incoming.denominations
      : current.denominations,
    paypalBalance: incoming.paypalBalance || current.paypalBalance,
    partners: recomputePartners(transactions),
  }

  return { snapshot, addedTransactions, updatedEvents, addedEvents, addedCashRows }
}

export function applyUploadMode(
  current: Snapshot | null,
  incoming: Snapshot,
  mode: UploadMode,
): MergeResult {
  if (mode === 'replace') {
    const snapshot: Snapshot = {
      ...incoming,
      partners: recomputePartners(incoming.transactions),
    }
    return {
      snapshot,
      addedTransactions: incoming.transactions.length,
      updatedEvents: 0,
      addedEvents: incoming.events.length,
      addedCashRows: incoming.cashBox.length,
    }
  }
  return mergeSnapshots(current, incoming)
}
