import { createDecipheriv, createHash, pbkdf2Sync, timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { emailFromBearer, json, readCaller } from './_lib/nastaAuth.js'

const PIN_DIGITS = 4
const PBKDF2_ITERS = 40_000
const META_KEY = 'nastaLoginPin'

type PinVault = {
  salt: string
  pinHash: string
  iv: string
  encPassword: string
  updatedAt: string
}

function supabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return { url, anon, service, key: service || anon }
}

async function sbFetch(
  path: string,
  key: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data: unknown; error?: string; status: number }> {
  const { url } = supabaseEnv()
  if (!url || !key) return { ok: false, data: null, error: 'Supabase not configured', status: 500 }
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init?.headers || {}),
    },
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const err =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message: string }).message)
        : text || res.statusText
    return { ok: false, data, error: err, status: res.status }
  }
  return { ok: true, data, status: res.status }
}

function isVault(v: unknown): v is PinVault {
  if (!v || typeof v !== 'object') return false
  const o = v as PinVault
  return Boolean(o.salt && o.pinHash && o.iv && o.encPassword)
}

function hashPin(pin: string, saltB64: string): string {
  return createHash('sha256').update(`${saltB64}:${pin}`).digest('base64')
}

function hashesMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

function decryptPassword(pin: string, vault: PinVault): string {
  const salt = Buffer.from(vault.salt, 'base64')
  const iv = Buffer.from(vault.iv, 'base64')
  const key = pbkdf2Sync(pin, salt, PBKDF2_ITERS, 32, 'sha256')
  const buf = Buffer.from(vault.encPassword, 'base64')
  if (buf.length < 17) throw new Error('Bad PIN vault')
  const tag = buf.subarray(buf.length - 16)
  const data = buf.subarray(0, buf.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

const failBucket = new Map<string, { n: number; until: number }>()

function rateLimited(id: string): boolean {
  const now = Date.now()
  const row = failBucket.get(id)
  if (!row) return false
  if (row.until && now < row.until) return true
  if (row.until && now >= row.until) {
    failBucket.delete(id)
    return false
  }
  return false
}

function noteFail(id: string) {
  const now = Date.now()
  const row = failBucket.get(id) || { n: 0, until: 0 }
  row.n += 1
  if (row.n >= 5) row.until = now + 15 * 60_000
  failBucket.set(id, row)
}

function noteOk(id: string) {
  failBucket.delete(id)
}

function teamGatePasswordOk(email: string, password: string): boolean {
  const em = email.trim().toLowerCase()
  const guestPw =
    process.env.GUEST_PASSWORD || process.env.VITE_GUEST_PASSWORD || 'Guest9987'
  const teamPw =
    process.env.UPLOAD_PASSWORD || process.env.VITE_UPLOAD_PASSWORD || 'Nasta998#'
  if (em === 'guest@nastazentrum.de') return password === guestPw
  if (em === 'developer@nastazentrum.de') return password === teamPw
  return false
}

const TEAM_PIN_KEYS = [
  'jeeva@nastazentrum.de',
  'sriram@nastazentrum.de',
  'sneha@nastazentrum.de',
  'guest@nastazentrum.de',
  'developer@nastazentrum.de',
]

async function passwordGrant(
  email: string,
  password: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
  const { url, anon } = supabaseEnv()
  if (!url || !anon || !email || !password) return null
  const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { access_token?: string; refresh_token?: string }
  if (!data.access_token || !data.refresh_token) return null
  return { access_token: data.access_token, refresh_token: data.refresh_token }
}

async function verifyAccountPassword(email: string, password: string): Promise<boolean> {
  if (teamGatePasswordOk(email, password)) return true
  return Boolean(await passwordGrant(email, password))
}

type AuthUser = { id: string; email: string; user_metadata?: Record<string, unknown> }

async function listAuthUsers(): Promise<AuthUser[]> {
  const { url, service } = supabaseEnv()
  if (!url || !service) return []
  const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  })
  if (!res.ok) return []
  const data = (await res.json()) as { users?: AuthUser[] } | AuthUser[]
  return Array.isArray(data) ? data : data.users || []
}

async function findAuthUser(email: string): Promise<AuthUser | null> {
  const want = email.trim().toLowerCase()
  const users = await listAuthUsers()
  return users.find((u) => (u.email || '').trim().toLowerCase() === want) || null
}

function pinRowSlug(accountKey: string): string {
  return accountKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

function pinRowPrefix(accountKey: string): string {
  return `__nasta_login_pin__${pinRowSlug(accountKey)}`
}

async function readReviewsVault(accountKey: string): Promise<PinVault | null> {
  const { key } = supabaseEnv()
  const prefix = pinRowPrefix(accountKey)
  const exact = await sbFetch(
    `customer_reviews?id=eq.${encodeURIComponent(prefix)}&select=payload,created_at`,
    key,
  )
  const like = await sbFetch(
    `customer_reviews?id=like.${encodeURIComponent(prefix)}*&select=id,payload,created_at&order=created_at.desc&limit=8`,
    key,
  )
  const rows: { payload?: { vault?: unknown; deleted?: boolean } }[] = []
  if (exact.ok && Array.isArray(exact.data)) rows.push(...(exact.data as typeof rows))
  if (like.ok && Array.isArray(like.data)) rows.push(...(like.data as typeof rows))
  for (const row of rows) {
    const payload = row.payload
    if (payload?.deleted) return null
    if (isVault(payload?.vault)) return payload.vault
    if (isVault(payload)) return payload
  }
  return null
}

async function writeReviewsVault(accountKey: string, vault: PinVault | null): Promise<boolean> {
  const { key } = supabaseEnv()
  const prefix = pinRowPrefix(accountKey)
  const payload = vault ? { vault } : { deleted: true }
  const upsert = await sbFetch('customer_reviews?on_conflict=id', key, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: prefix,
      created_at: new Date().toISOString(),
      payload,
    }),
  })
  if (upsert.ok) return true
  const inserted = await sbFetch('customer_reviews', key, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: `${prefix}__${Date.now()}`,
      created_at: new Date().toISOString(),
      payload,
    }),
  })
  return inserted.ok
}

async function readVault(accountKey: string): Promise<PinVault | null> {
  const { key, service } = supabaseEnv()
  const got = await sbFetch(
    `login_pins?account_key=eq.${encodeURIComponent(accountKey)}&select=vault`,
    key,
  )
  if (got.ok && Array.isArray(got.data) && got.data.length) {
    const vault = (got.data[0] as { vault?: unknown }).vault
    if (isVault(vault)) return vault
  }
  const fromReviews = await readReviewsVault(accountKey)
  if (fromReviews) return fromReviews
  if (!service) return null
  const user = await findAuthUser(accountKey)
  const meta = user?.user_metadata?.[META_KEY]
  return isVault(meta) ? meta : null
}

async function writeVault(accountKey: string, vault: PinVault | null): Promise<boolean> {
  const { key, service, url } = supabaseEnv()
  if (vault) {
    const upsert = await sbFetch('login_pins?on_conflict=account_key', key, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        account_key: accountKey,
        vault,
        updated_at: new Date().toISOString(),
      }),
    })
    if (upsert.ok) return true
  } else {
    const del = await sbFetch(
      `login_pins?account_key=eq.${encodeURIComponent(accountKey)}`,
      key,
      { method: 'DELETE' },
    )
    if (del.ok) {
      /* continue to other stores */
    }
  }

  if (await writeReviewsVault(accountKey, vault)) return true

  if (!service || !url) return false
  const user = await findAuthUser(accountKey)
  if (!user) return false
  const meta = { ...(user.user_metadata || {}) }
  if (vault) meta[META_KEY] = vault
  else delete meta[META_KEY]
  const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_metadata: meta }),
  })
  return res.ok
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const { url, key } = supabaseEnv()
  if (!url || !key) return json(res, 503, { error: 'Cloud login is not configured.' })

  if (req.method === 'GET') {
    if (String(req.query.all || '') === '1') {
      const caller = await readCaller(req)
      if (!caller) {
        return json(res, 401, { error: 'Sign in to see who has a PIN.' })
      }
      const pins: Record<string, boolean> = {}
      for (const keyName of TEAM_PIN_KEYS) {
        pins[keyName] = Boolean(await readVault(keyName))
      }
      return json(res, 200, { pins })
    }
    const accountKey = String(req.query.key || '').trim().toLowerCase()
    if (!accountKey.includes('@')) return json(res, 200, { hasPin: false })
    const vault = await readVault(accountKey)
    return json(res, 200, { hasPin: Boolean(vault) })
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  const body = (req.body || {}) as {
    action?: string
    accountKey?: string
    pin?: string
    password?: string
    record?: PinVault
  }
  const action = String(body.action || '')
  const accountKey = String(body.accountKey || '').trim().toLowerCase()
  if (!accountKey.includes('@')) return json(res, 400, { error: 'Missing account.' })

  if (action === 'save') {
    const password = String(body.password || '')
    const record = body.record
    if (!isVault(record)) return json(res, 400, { error: 'Missing PIN data.' })
    const sessionEmail = await emailFromBearer(req)
    const ok =
      sessionEmail === accountKey || (await verifyAccountPassword(accountKey, password))
    if (!ok) return json(res, 401, { error: 'Wrong password. PIN was not saved.' })
    const stored = await writeVault(accountKey, record)
    if (!stored) {
      return json(res, 503, {
        error: 'Could not save PIN to your account. Check your connection and try again.',
      })
    }
    return json(res, 200, { ok: true })
  }

  if (action === 'delete') {
    const password = String(body.password || '')
    const sessionEmail = await emailFromBearer(req)
    const ok =
      sessionEmail === accountKey || (await verifyAccountPassword(accountKey, password))
    if (!ok) return json(res, 401, { error: 'Wrong password.' })
    await writeVault(accountKey, null)
    return json(res, 200, { ok: true })
  }

  if (action === 'unlock') {
    const pin = String(body.pin || '').replace(/\D/g, '')
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    const bucket = `${accountKey}:${ip}`
    if (rateLimited(bucket)) {
      return json(res, 429, { error: 'Too many PIN tries. Use your password or wait 15 minutes.' })
    }
    if (pin.length !== PIN_DIGITS) {
      noteFail(bucket)
      return json(res, 401, { error: 'Wrong PIN.' })
    }
    const vault = await readVault(accountKey)
    if (!vault) return json(res, 404, { error: 'No PIN set for this account.' })
    if (!hashesMatch(hashPin(pin, vault.salt), vault.pinHash)) {
      noteFail(bucket)
      return json(res, 401, { error: 'Wrong PIN.' })
    }
    try {
      const password = decryptPassword(pin, vault)
      if (!password) throw new Error('empty')
      noteOk(bucket)
      const session = await passwordGrant(accountKey, password)
      if (session) return json(res, 200, session)
      return json(res, 200, { password })
    } catch {
      noteFail(bucket)
      return json(res, 401, { error: 'Wrong PIN.' })
    }
  }

  return json(res, 400, { error: 'Unknown action' })
}
