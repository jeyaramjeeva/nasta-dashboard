import type { VercelRequest, VercelResponse } from '@vercel/node'
import { json, readCaller } from './_lib/nastaAuth.js'

/** Jeeva-only: poll Cursor Cloud Agent status. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    json(res, 405, { error: 'GET or POST' })
    return
  }

  // Allow query identity on GET (headers + body also work)
  if (req.method === 'GET' && !req.body) {
    req.body = {
      userName: req.query.userName,
      userEmail: req.query.userEmail,
    }
  }
  const caller = await readCaller(req)
  if (!caller || caller.role !== 'Jeeva') {
    json(res, 403, { error: 'Jeeva-only' })
    return
  }

  const apiKey = process.env.CURSOR_API_KEY
  if (!apiKey) {
    json(res, 503, { error: 'CURSOR_API_KEY not configured' })
    return
  }

  const agentId = String(
    req.query.agentId || (req.body as { agentId?: string })?.agentId || '',
  ).trim()
  if (!agentId.startsWith('bc-')) {
    json(res, 400, { error: 'Invalid agentId' })
    return
  }

  const auth = Buffer.from(`${apiKey}:`).toString('base64')
  try {
    const r = await fetch(`https://api.cursor.com/v1/agents/${encodeURIComponent(agentId)}`, {
      headers: { Authorization: `Basic ${auth}` },
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      json(res, r.status, {
        error: (data as { message?: string }).message || 'Status fetch failed',
        details: data,
      })
      return
    }
    json(res, 200, data)
  } catch (err) {
    json(res, 500, {
      error: err instanceof Error ? err.message : 'Status failed',
    })
  }
}
