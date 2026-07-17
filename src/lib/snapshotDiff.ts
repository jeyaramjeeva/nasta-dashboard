import type { Snapshot, Transaction } from '../types'

export interface DiffLine {
  kind: 'added' | 'removed' | 'changed'
  scope: 'event' | 'transaction' | 'meta'
  label: string
  detail?: string
}

function txKey(t: Transaction): string {
  return [
    t.date || '',
    t.eventId,
    t.type,
    t.category,
    t.description,
    t.amount.toFixed(2),
    t.person,
  ].join('|')
}

/** Compare previous snapshot → current (or candidate) and list human-readable changes. */
export function diffSnapshots(before: Snapshot | null, after: Snapshot | null): DiffLine[] {
  if (!before && !after) return []
  if (!before && after) {
    return [
      {
        kind: 'added',
        scope: 'meta',
        label: 'New snapshot',
        detail: `${after.events.length} events · ${after.transactions.length} txs`,
      },
    ]
  }
  if (before && !after) {
    return [{ kind: 'removed', scope: 'meta', label: 'Snapshot cleared' }]
  }
  const a = before!
  const b = after!
  const lines: DiffLine[] = []

  if (a.sourceFile !== b.sourceFile) {
    lines.push({
      kind: 'changed',
      scope: 'meta',
      label: 'Source file',
      detail: `${a.sourceFile || '—'} → ${b.sourceFile || '—'}`,
    })
  }

  const prevEvents = new Map(a.events.map((e) => [e.id, e]))
  const nextEvents = new Map(b.events.map((e) => [e.id, e]))

  for (const [id, e] of nextEvents) {
    const prev = prevEvents.get(id)
    if (!prev) {
      lines.push({
        kind: 'added',
        scope: 'event',
        label: id,
        detail: `${e.name} · ${e.location}`,
      })
    } else if (
      prev.status !== e.status ||
      prev.fee !== e.fee ||
      prev.startDate !== e.startDate ||
      prev.endDate !== e.endDate
    ) {
      lines.push({
        kind: 'changed',
        scope: 'event',
        label: id,
        detail: [
          prev.status !== e.status ? `status ${prev.status}→${e.status}` : '',
          prev.fee !== e.fee ? `fee €${prev.fee}→€${e.fee}` : '',
          prev.startDate !== e.startDate ? `start ${prev.startDate}→${e.startDate}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      })
    }
  }
  for (const [id] of prevEvents) {
    if (!nextEvents.has(id)) {
      lines.push({ kind: 'removed', scope: 'event', label: id })
    }
  }

  const prevTx = new Map(a.transactions.map((t) => [txKey(t), t]))
  const nextTx = new Map(b.transactions.map((t) => [txKey(t), t]))
  let addedTx = 0
  let removedTx = 0
  for (const [k, t] of nextTx) {
    if (!prevTx.has(k)) {
      addedTx += 1
      if (addedTx <= 40) {
        lines.push({
          kind: 'added',
          scope: 'transaction',
          label: `${t.type} €${t.amount.toFixed(2)}`,
          detail: `${t.eventId} · ${t.category || t.description} · ${t.person}`,
        })
      }
    }
  }
  for (const [k, t] of prevTx) {
    if (!nextTx.has(k)) {
      removedTx += 1
      if (removedTx <= 20) {
        lines.push({
          kind: 'removed',
          scope: 'transaction',
          label: `${t.type} €${t.amount.toFixed(2)}`,
          detail: `${t.eventId} · ${t.category || t.description}`,
        })
      }
    }
  }
  if (addedTx > 40) {
    lines.push({
      kind: 'added',
      scope: 'transaction',
      label: `…and ${addedTx - 40} more new transactions`,
    })
  }
  if (removedTx > 20) {
    lines.push({
      kind: 'removed',
      scope: 'transaction',
      label: `…and ${removedTx - 20} more removed transactions`,
    })
  }

  return lines
}

export function summarizeDiff(lines: DiffLine[]): string {
  const added = lines.filter((l) => l.kind === 'added').length
  const removed = lines.filter((l) => l.kind === 'removed').length
  const changed = lines.filter((l) => l.kind === 'changed').length
  if (!added && !removed && !changed) return 'No changes detected'
  return `+${added} · ~${changed} · −${removed}`
}
