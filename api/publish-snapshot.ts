import type { VercelRequest, VercelResponse } from '@vercel/node'
import { json, readCaller, TEAM_API_CORS_HEADERS } from './_lib/nastaAuth.js'

/**
 * Publish Excel snapshot + version history using the service role.
 * Fixes RLS failures when the Developer UI session is local (anon key).
 */

function supabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return { url, anon, service }
}

function checkUploadPassword(password: string | undefined): boolean {
  const expected =
    (process.env.UPLOAD_PASSWORD || process.env.VITE_UPLOAD_PASSWORD || 'Nasta998#').trim()
  return String(password || '') === expected
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    TEAM_API_CORS_HEADERS,
  )
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' })

  const caller = await readCaller(req)
  if (!caller || caller.role !== 'Developer') {
    return json(res, 403, { error: 'Only the Developer account can publish Excel.' })
  }

  const body = (req.body || {}) as {
    password?: string
    trustedSession?: boolean
    snapshot?: {
      uploadedAt?: string
      sourceFile?: string
      events?: unknown[]
      transactions?: unknown[]
      [key: string]: unknown
    }
    version?: {
      createdAt?: string
      sourceFile?: string
      mode?: string
      note?: string
      summary?: { events?: number; transactions?: number }
      payload?: unknown
    }
    archive?: {
      createdAt?: string
      sourceFile?: string
      mode?: string
      note?: string
      summary?: { events?: number; transactions?: number }
      payload?: unknown
    }
  }

  const trusted = Boolean(body.trustedSession)
  if (!trusted && !checkUploadPassword(body.password)) {
    return json(res, 401, { error: 'Wrong upload password' })
  }

  const snapshot = body.snapshot
  if (!snapshot || typeof snapshot !== 'object') {
    return json(res, 400, { error: 'Missing snapshot' })
  }

  const { url, anon, service } = supabaseEnv()
  const key = service || anon
  if (!url || !key) {
    return json(res, 500, {
      error:
        'Cloud not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel.',
    })
  }
  if (!service) {
    return json(res, 500, {
      error:
        'Add SUPABASE_SERVICE_ROLE_KEY in Vercel env (Project Settings → Environment Variables), then redeploy. Needed to publish past RLS.',
    })
  }

  const uploadedAt = String(snapshot.uploadedAt || new Date().toISOString())

  // Optional: archive previous latest into history before overwrite
  if (body.archive && typeof body.archive === 'object' && body.archive.payload) {
    const arch = body.archive
    await sbFetch('snapshot_versions', key, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        created_at: arch.createdAt || new Date().toISOString(),
        source_file: String(arch.sourceFile || 'archive').slice(0, 240),
        mode: String(arch.mode || 'restore').slice(0, 40),
        note: arch.note ? String(arch.note).slice(0, 400) : null,
        summary: arch.summary || {},
        payload: arch.payload,
      }),
    })
  }

  const upsert = await sbFetch('snapshots?on_conflict=id', key, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: 'latest',
      payload: snapshot,
      uploaded_at: uploadedAt,
    }),
  })
  if (!upsert.ok) {
    return json(res, 500, {
      error: upsert.error || 'Could not save snapshot',
    })
  }

  let versionId: string | null = null
  if (body.version && body.version.payload) {
    const v = body.version
    const inserted = await sbFetch('snapshot_versions', key, {
      method: 'POST',
      body: JSON.stringify({
        created_at: v.createdAt || new Date().toISOString(),
        source_file: String(v.sourceFile || snapshot.sourceFile || 'upload').slice(0, 240),
        mode: String(v.mode || 'replace').slice(0, 40),
        note: v.note ? String(v.note).slice(0, 400) : null,
        summary: v.summary || {
          events: Array.isArray(snapshot.events) ? snapshot.events.length : 0,
          transactions: Array.isArray(snapshot.transactions)
            ? snapshot.transactions.length
            : 0,
        },
        payload: v.payload,
      }),
    })
    if (!inserted.ok) {
      return json(res, 500, {
        error: inserted.error || 'Snapshot saved but history insert failed',
      })
    }
    const row = Array.isArray(inserted.data) ? inserted.data[0] : inserted.data
    versionId =
      row && typeof row === 'object' && 'id' in row
        ? String((row as { id: string }).id)
        : null
  }

  return json(res, 200, {
    ok: true,
    uploadedAt,
    sourceFile: snapshot.sourceFile || null,
    versionId,
    via: 'service-role',
  })
}
