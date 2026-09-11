import type { VercelRequest, VercelResponse } from '@vercel/node'
import { json, readCaller } from './_lib/nastaAuth.js'

const SYSTEM = `You are Nasta Zentrum's background stall coach for Sriram and Sneha.
Given rule-based tips and a sales snapshot, write a short briefing (2–4 sentences) then up to 4 bullet action items.
Be concrete, euro-aware, and stall-practical (prep, queue, combos, stock, weather). No code or deploy talk.
Match the user's language if the context is clearly DE; otherwise English.`

async function llmCoach(context: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY || process.env.AI_HELPER_OPENAI_KEY
  if (!key) return null
  const model = process.env.AI_HELPER_MODEL || 'gpt-4o-mini'
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `Refresh the stall coach briefing.\n\n${context.slice(0, 7000)}`,
        },
      ],
    }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return data.choices?.[0]?.message?.content?.trim() || null
}

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
  if (!caller || (caller.role !== 'Sriram' && caller.role !== 'Sneha' && caller.role !== 'Jeeva')) {
    json(res, 403, { error: 'AI coach is for Sriram, Sneha, and Jeeva only.' })
    return
  }

  const context = String((req.body as { context?: string })?.context || '').trim()
  const fallbackBriefing = String(
    (req.body as { fallbackBriefing?: string })?.fallbackBriefing || '',
  ).trim()

  if (!context && !fallbackBriefing) {
    json(res, 400, { error: 'Missing context' })
    return
  }

  try {
    const llm = await llmCoach(context || fallbackBriefing)
    if (llm) {
      json(res, 200, { briefing: llm, source: 'llm' })
      return
    }
    json(res, 200, {
      briefing: fallbackBriefing || 'Coach standing by — add OPENAI_API_KEY for richer briefings.',
      source: 'rules',
    })
  } catch (err) {
    json(res, 200, {
      briefing: fallbackBriefing || 'Coach unavailable right now.',
      source: 'rules',
      warning: err instanceof Error ? err.message : 'LLM unavailable',
    })
  }
}
