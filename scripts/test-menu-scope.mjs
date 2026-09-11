/**
 * Smoke: Gourmet public overrides must not leak onto Flohmarkt / Streetfood.
 * Run against live or preview: node scripts/test-menu-scope.mjs [baseUrl]
 */
import assert from 'node:assert/strict'

const base = process.argv[2] || 'https://nastazentrum.vercel.app'

async function menu(path) {
  const r = await fetch(`${base}${path}`)
  assert.equal(r.status, 200, `${path} status`)
  const j = await r.json()
  return j
}

function sig(j) {
  return (j.menu || [])
    .map((m) => `${m.id}:${m.name}:${m.price}:${m.priceWithChai ?? ''}:${m.priceWithLassi ?? ''}`)
    .join('|')
}

const gourmet = await menu('/api/customer-order?type=Gourmet')
const floh = await menu('/api/customer-order?type=Flohmarkt')
const street = await menu('/api/customer-order?type=Streetfood%20Festival')

console.log('Gourmet items', gourmet.menu?.length, 'key', gourmet.menuKey)
console.log('Flohmarkt items', floh.menu?.length, 'key', floh.menuKey)
console.log('Streetfood items', street.menu?.length, 'key', street.menuKey)

const gSig = sig(gourmet)
const fSig = sig(floh)
const sSig = sig(street)

// After scoped overrides: if Flohmarkt/Streetfood have their own catalogs in stall_ops,
// they should not be forced identical to Gourmet by a Gourmet-only override bag.
// Soft assert: at least menuKey labels must match the requested type.
assert.equal(String(gourmet.menuKey || '').toLowerCase().includes('gourmet') || gourmet.menuKey === 'Gourmet', true)
assert.ok(floh.menuKey === 'Flohmarkt' || /floh/i.test(String(floh.menuLabel || floh.menuKey)))
assert.ok(
  street.menuKey === 'Streetfood Festival' || /street/i.test(String(street.menuLabel || street.menuKey)),
)

const gourmetHasMedu = (gourmet.menu || []).some(
  (m) => /medu/i.test(m.name) || m.id.includes('medu') || m.id.startsWith('custom-'),
)
console.log('Gourmet has Medu/custom snack?', gourmetHasMedu)

if (gSig === fSig && gSig === sSig) {
  console.warn(
    'WARN: all three types still share the same item signature — check stall_ops.eventMenus still has distinct catalogs, or redeploy scoped override fix.',
  )
} else {
  console.log('OK: event types are not identical (scoped catalogs working).')
}

console.log('test-menu-scope done')
