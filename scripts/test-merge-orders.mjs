/**
 * Smoke test: deleted / voided / event-scoped merge must not resurrect tickets.
 * Run: node scripts/test-merge-orders.mjs
 */
import assert from 'node:assert/strict'

// Inline mirror of merge rules (compiled TS not imported from Vite src).
function normalizeOrder(o) {
  return {
    id: o.id,
    label: o.label || '',
    status: o.status || 'pending',
    lines: o.lines || [],
    createdAt: o.createdAt || new Date().toISOString(),
    eventId: o.eventId,
    voided: Boolean(o.voided),
    claimedAt: o.claimedAt,
    completedAt: o.completedAt,
  }
}

function mergeStallOrderBags(remote, local) {
  const deleted = new Set([
    ...(remote.deletedOrderIds || []),
    ...(local.deletedOrderIds || []),
  ])
  const rank = (s) => (s === 'completed' ? 3 : s === 'pending' ? 2 : 1)
  const prefer = (a, b) => {
    if (a.voided && !b.voided) return a
    if (b.voided && !a.voided) return b
    if (rank(a.status) !== rank(b.status)) {
      return rank(a.status) >= rank(b.status) ? a : b
    }
    return a
  }
  const map = new Map()
  for (const o of remote.orders || []) {
    const n = normalizeOrder(o)
    if (deleted.has(n.id)) continue
    map.set(n.id, n)
  }
  for (const o of local.orders || []) {
    const n = normalizeOrder(o)
    if (deleted.has(n.id)) continue
    const prev = map.get(n.id)
    map.set(n.id, prev ? prefer(n, prev) : n)
  }
  return {
    orders: [...map.values()],
    deletedOrderIds: [...deleted],
  }
}

const remote = {
  orders: [
    { id: 'a', status: 'pending', label: 'Customer 1', createdAt: '2026-07-22T10:00:00Z', eventId: 'E1' },
    { id: 'b', status: 'pending', label: 'Customer 2', createdAt: '2026-07-22T10:01:00Z', eventId: 'E2' },
    { id: 'c', status: 'pending', label: 'Old', createdAt: '2026-07-21T10:00:00Z', eventId: 'E1' },
  ],
  deletedOrderIds: [],
}

const localAfterDelete = {
  orders: [
    { id: 'a', status: 'pending', label: 'Customer 1', createdAt: '2026-07-22T10:00:00Z', eventId: 'E1' },
    { id: 'b', status: 'pending', label: 'Customer 2', createdAt: '2026-07-22T10:01:00Z', eventId: 'E2' },
  ],
  deletedOrderIds: ['c'],
}

const merged = mergeStallOrderBags(remote, localAfterDelete)
assert.equal(merged.orders.some((o) => o.id === 'c'), false, 'deleted order must stay gone')
assert.ok(merged.deletedOrderIds.includes('c'))
assert.equal(merged.orders.length, 2)

const voidRemote = {
  orders: [{ id: 'a', status: 'pending', label: 'Customer 1', createdAt: '2026-07-22T10:00:00Z', voided: false }],
  deletedOrderIds: [],
}
const voidLocal = {
  orders: [{ id: 'a', status: 'pending', label: 'Customer 1', createdAt: '2026-07-22T10:00:00Z', voided: true }],
  deletedOrderIds: [],
}
const voided = mergeStallOrderBags(voidRemote, voidLocal)
assert.equal(voided.orders[0].voided, true, 'voided must win over stale non-voided')

// saveStallOpsCloud path: local delete + remote still has ticket
const afterCloudSave = mergeStallOrderBags(remote, {
  orders: remote.orders.filter((o) => o.id !== 'c'),
  deletedOrderIds: ['c'],
})
assert.equal(afterCloudSave.orders.some((o) => o.id === 'c'), false)

console.log('ok — merge tombstones + void prefer')
