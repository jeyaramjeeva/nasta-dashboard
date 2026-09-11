/**
 * Setup helper: ensure the Guest auth user can sign in (create if missing).
 * Uses project-specific Supabase URL + anon key below — do not treat as a template.
 * See scripts/README.md. Run: node scripts/ensure-guest-user.mjs
 */
const url = 'https://skstqrnyvkxfslrohmoc.supabase.co'
const key =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrc3Rxcm55dmt4ZnNscm9obW9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODM5NzUsImV4cCI6MjA5OTg1OTk3NX0.8G9SMuC-hW-kdRj4PgIDWJ24AmwyKLWE1x_FfJM9yrk'
const email = 'guest@nastazentrum.de'
const password = 'Guest9987'

async function signIn() {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const j = await r.json()
  return { ok: r.ok, status: r.status, j }
}

console.log('project', url)
let first = await signIn()
console.log('signin', first.status, first.j.error_code || first.j.error_description || first.j.msg || 'ok')

if (!first.ok) {
  const r = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, data: { name: 'Guest' } }),
  })
  const j = await r.json()
  console.log('signup', r.status, JSON.stringify(j).slice(0, 600))
  const second = await signIn()
  console.log(
    'signin2',
    second.status,
    second.j.error_code || second.j.error_description || second.j.msg || 'ok',
    second.j.access_token ? 'HAS_TOKEN' : '',
  )
} else {
  console.log('Guest already works')
}
