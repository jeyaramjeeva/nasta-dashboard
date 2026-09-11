import type { VercelRequest, VercelResponse } from '@vercel/node'
import { json, readCaller, TEAM_API_CORS_HEADERS } from './_lib/nastaAuth.js'

const CONFIG_ID = '__site_config__'

function supabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return { url, anon, service }
}

async function sbFetch(
  path: string,
  key: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data: unknown; error?: string }> {
  const { url } = supabaseEnv()
  if (!url || !key) return { ok: false, data: null, error: 'Supabase not configured' }
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
    return { ok: false, data, error: err }
  }
  return { ok: true, data }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', TEAM_API_CORS_HEADERS)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const { url, anon, service } = supabaseEnv()
  const key = service || anon

  if (req.method === 'GET') {
    if (!url || !key) return json(res, 200, { config: null })
    const got = await sbFetch(
      `customer_reviews?id=eq.${encodeURIComponent(CONFIG_ID)}&select=payload`,
      key,
    )
    if (!got.ok || !Array.isArray(got.data) || !got.data.length) {
      return json(res, 200, { config: null })
    }
    const payload = (got.data[0] as { payload?: unknown }).payload
    return json(res, 200, { config: payload || null })
  }

  if (req.method === 'POST') {
    const caller = await readCaller(req)
    if (!caller || caller.role !== 'Developer') {
      return json(res, 403, { error: 'Only the Developer account can edit the site.' })
    }
    const body = (req.body || {}) as { config?: unknown }
    if (!body.config || typeof body.config !== 'object') {
      return json(res, 400, { error: 'Missing config' })
    }
    if (!url || !key) return json(res, 200, { ok: true, config: body.config, stored: 'client-only' })
    const row = {
      id: CONFIG_ID,
      created_at: new Date().toISOString(),
      payload: body.config,
    }
    const upsert = await sbFetch('customer_reviews?on_conflict=id', key, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(row),
    })
    if (!upsert.ok) {
      return json(res, 200, {
        ok: true,
        config: body.config,
        stored: 'client-only',
        warning: upsert.error,
      })
    }
    return json(res, 200, { ok: true, config: body.config, stored: 'cloud' })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
