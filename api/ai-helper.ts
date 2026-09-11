import type { VercelRequest, VercelResponse } from '@vercel/node'
import { json, readCaller } from './_lib/nastaAuth.js'

const SYSTEM = `You are the Nasta Zentrum stall helper for Sriram and Sneha.
Answer briefly in clear English (or match the user's language if they write DE/TA/KA).
You help with: Orders/POS, Menu prices by event type (Flohmarkt / Streetfood / Gourmet),
Stock, To-dos, Calendar specials, PayPal/Cash delivery, Guest/Stall mode, Upload Excel (Jeeva only).
Never claim you can edit code or deploy. Code changes are Jeeva-only via AI Code Agent.
If unsure, say so and suggest who to ask (Jeeva for Upload / code).`

const FAQS: { keys: string[]; answer: string }[] = [
  {
    keys: ['order', 'new order', 'pos', 'ticket', 'pending'],
    answer:
      'Orders → New order: pick stall. Menu/prices follow event type. Submit → Pending → Delivered (Cash or PayPal).',
  },
  {
    keys: ['menu', 'price', 'flohmarkt', 'gourmet', 'streetfood'],
    answer:
      'Orders → Menu prices: pick Event type and edit that catalog. Gourmet = Gourmet Festival; Streetfood = Street Festival.',
  },
  {
    keys: ['excel', 'upload', 'download'],
    answer:
      'Only Jeeva uploads Excel. History has Excel download + Restore. Upload does not erase POS orders.',
  },
  {
    keys: ['todo', 'reminder', 'email'],
    answer: 'To-dos with assignee + due date send funny email reminders. Jeeva sets emails in Account.',
  },
  {
    keys: ['paypal', 'cash', 'qr'],
    answer: 'On Delivered choose Cash or PayPal (QR). Jeeva can upload QR in Account.',
  },
  {
    keys: ['calendar', 'diwali', 'karneval'],
    answer: 'Calendar shows stalls + IN/DE seasonal specials (Diwali, Karneval, etc.) with tips.',
  },
  {
    keys: ['saturday', 'slow', 'sales', 'why', 'crash', 'quiet'],
    answer:
      'Open AI helper → tap “Why was Saturday slow?” to analyse live POS averages by weekday. Also check weather, location, and Food prep leftovers for that event.',
  },
]

function kbAnswer(question: string): string {
  const q = question.trim().toLowerCase()
  let best: { score: number; answer: string } | null = null
  for (const faq of FAQS) {
    let score = 0
    for (const key of faq.keys) if (q.includes(key)) score += key.length
    if (score > 0 && (!best || score > best.score)) best = { score, answer: faq.answer }
  }
  return (
    best?.answer ||
    'Try asking about New order, Menu prices, Stock, To-dos, PayPal, Calendar specials, or Upload. For code changes ask Jeeva.'
  )
}

async function llmAnswer(question: string, context?: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY || process.env.AI_HELPER_OPENAI_KEY
  if (!key) return null
  const model = process.env.AI_HELPER_MODEL || 'gpt-4o-mini'
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const userContent = context
    ? `${question}\n\n---\nData context:\n${context.slice(0, 6000)}`
    : question
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            SYSTEM +
            '\nWhen sales context is provided, use those numbers to explain slow/fast days. Prefer short bullet answers.',
        },
        { role: 'user', content: userContent },
      ],
    }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = data.choices?.[0]?.message?.content?.trim()
  return text || null
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
    json(res, 403, { error: 'AI helper is for Sriram, Sneha, and Jeeva only.' })
    return
  }

  const question = String((req.body as { question?: string })?.question || '').trim()
  const context = String((req.body as { context?: string })?.context || '').trim()
  if (!question) {
    json(res, 400, { error: 'Missing question' })
    return
  }

  try {
    const llm = await llmAnswer(question, context || undefined)
    if (llm) {
      json(res, 200, { answer: llm, source: 'llm' })
      return
    }
    const kb = kbAnswer(question)
    json(res, 200, {
      answer: context ? `${kb}\n\n(Sales snapshot)\n${context.slice(0, 900)}` : kb,
      source: 'kb',
    })
  } catch (err) {
    json(res, 200, {
      answer: kbAnswer(question),
      source: 'kb',
      warning: err instanceof Error ? err.message : 'LLM unavailable',
    })
  }
}
