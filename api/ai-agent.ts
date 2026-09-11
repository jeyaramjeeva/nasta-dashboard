import type { VercelRequest, VercelResponse } from '@vercel/node'
import { json, readCaller } from './_lib/nastaAuth.js'

/**
 * Jeeva-only: launch a Cursor Cloud Agent against the nasta-dashboard repo.
 * Requires CURSOR_API_KEY (+ optional CURSOR_REPO_URL) in Vercel env.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    json(res, 405, { error: 'POST only' })
    return
  }

  const caller = await readCaller(req)
  if (!caller || caller.role !== 'Jeeva') {
    json(res, 403, { error: 'AI Code Agent is Jeeva-only.' })
    return
  }

  const apiKey = process.env.CURSOR_API_KEY
  if (!apiKey) {
    json(res, 503, {
      error:
        'CURSOR_API_KEY is not set on the server. Add it in Vercel → Settings → Environment Variables.',
    })
    return
  }

  const body = (req.body || {}) as { prompt?: string; agentId?: string }
  const prompt = String(body.prompt || '').trim()
  if (!prompt) {
    json(res, 400, { error: 'Missing prompt' })
    return
  }

  const repo =
    process.env.CURSOR_REPO_URL || 'https://github.com/jeyaramjeeva/nasta-dashboard'
  const startingRef = process.env.CURSOR_REPO_REF || 'main'
  const modelId = process.env.CURSOR_MODEL_ID || 'composer-2.5'

  const auth = Buffer.from(`${apiKey}:`).toString('base64')

  try {
    // Follow-up on existing cloud agent
    if (body.agentId && String(body.agentId).startsWith('bc-')) {
      const follow = await fetch(
        `https://api.cursor.com/v1/agents/${encodeURIComponent(body.agentId)}/runs`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: { text: prompt },
          }),
        },
      )
      const data = await follow.json().catch(() => ({}))
      if (!follow.ok) {
        json(res, follow.status, {
          error: (data as { message?: string; error?: string }).message ||
            (data as { error?: string }).error ||
            'Follow-up run failed',
          details: data,
        })
        return
      }
      json(res, 200, data)
      return
    }

    const create = await fetch('https://api.cursor.com/v1/agents', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: {
          text: [
            'You are editing the Nasta Zentrum Tracker (Vite + React + TypeScript) repo.',
            'Make focused changes. Prefer small PRs. Do not commit secrets.',
            'After changes, summarize files touched and how to test.',
            '',
            `Requested by Jeeva via the live site AI Code Agent.`,
            '',
            prompt,
          ].join('\n'),
        },
        name: `Nasta: ${prompt.slice(0, 60)}`,
        model: { id: modelId },
        repos: [{ url: repo, startingRef }],
        autoCreatePR: true,
      }),
    })

    const data = await create.json().catch(() => ({}))
    if (!create.ok) {
      json(res, create.status, {
        error:
          (data as { message?: string }).message ||
          (data as { error?: string }).error ||
          'Could not start Cursor agent',
        details: data,
      })
      return
    }

    json(res, 200, data)
  } catch (err) {
    json(res, 500, {
      error: err instanceof Error ? err.message : 'Agent request failed',
    })
  }
}
