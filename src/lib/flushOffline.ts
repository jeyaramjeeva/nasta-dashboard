/**
 * Single coordinated offline-queue flush.
 * Avoids DataContext + ExtrasContext racing replaceOfflineQueue and
 * re-queuing stall_ops (menu photos) forever.
 */

import {
  saveStallOpsCloud,
  saveTeamExtras,
  upsertPlateCount,
  type TeamExtrasPayload,
} from './cloudExtras'
import {
  offlineQueueCount,
  peekOfflineQueue,
  replaceOfflineQueue,
  type OfflineOp,
} from './offlineQueue'
import { loadStallOps, type StallOpsState } from './stallOps'

export type FlushOfflineResult = {
  remaining: number
  stallOpsPushed: boolean
  errors: string[]
}

type QuickAddHandler = (op: OfflineOp) => Promise<void>

let flushLock: Promise<void> | null = null

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  while (flushLock) {
    try {
      await flushLock
    } catch {
      /* previous flush failed — continue */
    }
  }
  let release!: () => void
  flushLock = new Promise<void>((r) => {
    release = r
  })
  try {
    return await fn()
  } finally {
    release()
    flushLock = null
  }
}

/** Keep only the newest stall_ops payload in a list. */
function collapseStallOps(ops: OfflineOp[]): OfflineOp[] {
  let latest: OfflineOp | null = null
  const rest: OfflineOp[] = []
  for (const op of ops) {
    if (op.kind === 'stall_ops') latest = op
    else rest.push(op)
  }
  return latest ? [...rest, latest] : rest
}

/**
 * Push current local warehouse/menu (incl. photos) to cloud, then drain the queue.
 * `onQuickAdd` is optional — DataContext supplies it for Excel quick-add ops.
 */
export async function flushAllOfflineOps(
  onQuickAdd?: QuickAddHandler,
): Promise<FlushOfflineResult> {
  return withLock(async () => {
    const errors: string[] = []
    let stallOpsPushed = false

    // Always push the live local stall_ops — queue payloads can be stale/huge.
    try {
      const local = loadStallOps()
      await saveStallOpsCloud(local)
      stallOpsPushed = true
    } catch (e) {
      errors.push(
        e instanceof Error
          ? `Menu/photos sync failed: ${e.message}`
          : 'Menu/photos sync failed',
      )
    }

    const ops = collapseStallOps(peekOfflineQueue())
    const still: OfflineOp[] = []

    for (const op of ops) {
      try {
        if (op.kind === 'stall_ops') {
          // Already pushed local above — drop queued copies
          continue
        }
        if (op.kind === 'team_extras') {
          await saveTeamExtras(op.payload as TeamExtrasPayload)
          continue
        }
        if (op.kind === 'plate_count') {
          await upsertPlateCount(op.payload)
          continue
        }
        if (op.kind === 'quick_add') {
          if (onQuickAdd) {
            await onQuickAdd(op)
            continue
          }
          still.push(op)
          continue
        }
        still.push(op)
      } catch (e) {
        still.push(op)
        if (errors.length < 3) {
          errors.push(e instanceof Error ? e.message : 'Sync failed')
        }
      }
    }

    replaceOfflineQueue(still)
    return {
      remaining: offlineQueueCount(),
      stallOpsPushed,
      errors,
    }
  })
}

/** Force-push local menu photos without draining the whole queue. */
export async function pushLocalStallOpsNow(): Promise<void> {
  return withLock(async () => {
    const local = loadStallOps() as StallOpsState
    await saveStallOpsCloud(local)
    // Drop queued stall_ops — local is the source of truth
    replaceOfflineQueue(peekOfflineQueue().filter((o) => o.kind !== 'stall_ops'))
  })
}
