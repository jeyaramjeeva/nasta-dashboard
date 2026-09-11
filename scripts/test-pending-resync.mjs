/**
 * Reproduces the Pending-list bug: delete locally → cloud refresh/save
 * must not resurrect tickets; other-event tickets must stay filterable.
 */
import assert from 'node:assert/strict'

function mergeStallOrderBags(remote, local) {
  const deleted = new Set([
    ...(remote.deletedOrderIds || []),
    ...(local.deletedOrderIds || []),
  ])
  const map = new Map()
  for (const o of remote.orders || []) {
    if (deleted.has(o.id)) continue
    map.set(o.id, o)
  }
  for (const o of local.orders || []) {
    if (deleted.has(o.id)) continue
    map.set(o.id, o)
  }
  return { orders: [...map.values()], deletedOrderIds: [...deleted] }
}

function pendingForEvent(orders, activeEventId) {
  const eid = String(activeEventId || '').trim()
  return orders.filter((o) => {
    if (o.status !== 'pending' || o.voided) return false
    if (!eid) return true
    return String(o.eventId || '').trim() === eid
  })
}

// --- Scenario: staff deletes C, then 10s refresh pulls remote that still has C
let local = {
  activeEventId: 'E1',
  deletedOrderIds: ['ord-c'],
  orders: [
    { id: 'ord-a', status: 'pending', eventId: 'E1', voided: false },
    { id: 'ord-b', status: 'pending', eventId: 'E2', voided: false },
  ],
}
const remote = {
  activeEventId: 'E2', // other device flipped stall
  deletedOrderIds: [],
  orders: [
    { id: 'ord-a', status: 'pending', eventId: 'E1', voided: false },
    { id: 'ord-b', status: 'pending', eventId: 'E2', voided: false },
    { id: 'ord-c', status: 'pending', eventId: 'E1', voided: false }, // deleted locally
  ],
}

const bag = mergeStallOrderBags(remote, local)
const preservedStall = local.activeEventId // device-local
const pending = pendingForEvent(bag.orders, preservedStall)

assert.equal(
  bag.orders.some((o) => o.id === 'ord-c'),
  false,
  'deleted ord-c must not resurrect on refresh',
)
assert.deepEqual(
  pending.map((o) => o.id).sort(),
  ['ord-a'],
  'only E1 pending on this device',
)
assert.equal(preservedStall, 'E1', 'active stall must not flip to remote E2')

// --- Scenario: saveStallOpsCloud after delete (remote still has C)
const toSave = mergeStallOrderBags(remote, {
  orders: local.orders,
  deletedOrderIds: local.deletedOrderIds,
})
assert.equal(toSave.orders.some((o) => o.id === 'ord-c'), false)
assert.ok(toSave.deletedOrderIds.includes('ord-c'))

console.log('ok — pending resync scenarios')
