/** Client-side offline write queue — flushed when the browser is back online. */

import { demoStorageKey } from './demoMode'

export type OfflineOp =
  | {
      id: string
      kind: 'team_extras'
      payload: unknown
      ts: string
    }
  | {
      id: string
      kind: 'plate_count'
      payload: {
        eventId: string
        countedAt: string
        plates: number
        platePrice: number
        note?: string
      }
      ts: string
    }
  | {
      id: string
      kind: 'quick_add'
      payload: Record<string, unknown>
      ts: string
    }
  | {
      id: string
      kind: 'stall_ops'
      payload: unknown
      ts: string
    }

const KEY = 'nasta-offline-queue-v1'

function read(): OfflineOp[] {
  try {
    const raw = localStorage.getItem(demoStorageKey(KEY))
    if (!raw) return []
    return JSON.parse(raw) as OfflineOp[]
  } catch {
    return []
  }
}

function write(ops: OfflineOp[]) {
  localStorage.setItem(demoStorageKey(KEY), JSON.stringify(ops.slice(-80)))
}

export function enqueueOffline(op: Omit<OfflineOp, 'id' | 'ts'> & { id?: string }): void {
  const next: OfflineOp = {
    ...(op as OfflineOp),
    id: op.id || `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: new Date().toISOString(),
  }
  write([...read(), next])
}

export function peekOfflineQueue(): OfflineOp[] {
  return read()
}

export function clearOfflineQueue(): void {
  write([])
}

export function replaceOfflineQueue(ops: OfflineOp[]): void {
  write(ops)
}

export function offlineQueueCount(): number {
  return read().length
}
