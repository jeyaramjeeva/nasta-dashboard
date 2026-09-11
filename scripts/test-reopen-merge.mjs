/**
 * “Back to pending” must not be overwritten by a stale completed cloud copy.
 */
import assert from 'node:assert/strict'

function orderRevisionMs(o) {
  const candidates = [o.updatedAt, o.voidedAt, o.claimedAt, o.completedAt, o.createdAt]
  let max = 0
  for (const raw of candidates) {
    const t = Date.parse(String(raw || ''))
    if (Number.isFinite(t) && t > max) max = t
  }
  return max
}

function preferOrder(a, b) {
  if (a.voided && !b.voided) return a
  if (b.voided && !a.voided) return b
  const aT = orderRevisionMs(a)
  const bT = orderRevisionMs(b)
  if (aT !== bT) return aT > bT ? a : b
  const rank = (s) => (s === 'completed' ? 3 : s === 'pending' ? 2 : 1)
  return rank(a.status) >= rank(b.status) ? a : b
}

const remoteCompleted = {
  id: 'ord-1',
  status: 'completed',
  createdAt: '2026-07-22T14:00:00.000Z',
  completedAt: '2026-07-22T14:30:00.000Z',
  voided: false,
}

const localReopened = {
  id: 'ord-1',
  status: 'pending',
  createdAt: '2026-07-22T14:00:00.000Z',
  updatedAt: '2026-07-22T15:00:00.000Z',
  voided: false,
}

const merged = preferOrder(localReopened, remoteCompleted)
assert.equal(merged.status, 'pending', 'reopen must win over stale completed')

const completedAgain = preferOrder(
  {
    ...localReopened,
    status: 'completed',
    completedAt: '2026-07-22T15:10:00.000Z',
    updatedAt: '2026-07-22T15:10:00.000Z',
  },
  localReopened,
)
assert.equal(completedAgain.status, 'completed', 'newer complete must win')

console.log('ok — reopen merge')
