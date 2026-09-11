import type { VercelRequest, VercelResponse } from '@vercel/node'
import { json, readCaller, TEAM_API_CORS_HEADERS } from './_lib/nastaAuth.js'

const CONFIG_ID = '__review_form__'
const CONFIG_PREFIX = '__rform_'

interface ReviewChip {
  id: string
  en: string
  de: string
}

type ReviewQuestionKey =
  | 'name'
  | 'ate'
  | 'spicy'
  | 'food'
  | 'favorite'
  | 'improve'
  | 'service'
  | 'recommend'
  | 'visit'
  | 'want'
  | 'smile'

const DEFAULT_QUESTION_ORDER: ReviewQuestionKey[] = [
  'name',
  'ate',
  'spicy',
  'food',
  'favorite',
  'improve',
  'service',
  'recommend',
  'visit',
  'want',
  'smile',
]

interface CustomReviewQuestion {
  id: string
  en: string
  de: string
  type: 'chips' | 'text'
  options: ReviewChip[]
}

interface ReviewFormConfig {
  spicy: ReviewChip[]
  improve: ReviewChip[]
  wantTry: ReviewChip[]
  favorites: ReviewChip[]
  visitReasons: ReviewChip[]
  recommend: ReviewChip[]
  eatExtras: ReviewChip[]
  questionOrder?: ReviewQuestionKey[]
  customQuestions?: CustomReviewQuestion[]
}

function supabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return { url, anon, service }
}

function slugChipId(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  return base || `chip_${Date.now().toString(36)}`
}

function normalizeChips(raw: unknown): ReviewChip[] {
  if (!Array.isArray(raw)) return []
  const out: ReviewChip[] = []
  const seen = new Set<string>()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const en = String((row as ReviewChip).en || '').trim().slice(0, 80)
    const de = String((row as ReviewChip).de || en).trim().slice(0, 80)
    if (!en && !de) continue
    let id = String((row as ReviewChip).id || '').trim() || slugChipId(en || de)
    id = id.slice(0, 48)
    if (seen.has(id)) id = `${id}_${out.length}`
    seen.add(id)
    out.push({ id, en: en || de, de: de || en })
  }
  return out
}

function normalizeQuestionOrder(raw: unknown): ReviewQuestionKey[] {
  const allowed = new Set<string>(DEFAULT_QUESTION_ORDER)
  const out: ReviewQuestionKey[] = []
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const k = String(row || '').trim() as ReviewQuestionKey
      if (!allowed.has(k) || out.includes(k)) continue
      out.push(k)
    }
  }
  for (const k of DEFAULT_QUESTION_ORDER) {
    if (!out.includes(k)) out.push(k)
  }
  return out
}

function normalizeCustomQuestions(raw: unknown): CustomReviewQuestion[] {
  if (!Array.isArray(raw)) return []
  const out: CustomReviewQuestion[] = []
  const seen = new Set<string>()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as CustomReviewQuestion
    const en = String(r.en || '').trim().slice(0, 120)
    const de = String(r.de || en).trim().slice(0, 120)
    if (!en && !de) continue
    let id = String(r.id || '').trim() || slugChipId(en || de)
    id = id.slice(0, 48)
    if (seen.has(id)) id = `${id}_${out.length}`
    seen.add(id)
    const type = r.type === 'text' ? 'text' : 'chips'
    out.push({
      id,
      en: en || de,
      de: de || en,
      type,
      options: type === 'chips' ? normalizeChips(r.options) : [],
    })
  }
  return out.slice(0, 20)
}

function normalizeConfig(raw: Partial<ReviewFormConfig> | null | undefined): ReviewFormConfig {
  return {
    spicy: normalizeChips(raw?.spicy),
    improve: normalizeChips(raw?.improve),
    wantTry: normalizeChips(raw?.wantTry),
    favorites: normalizeChips(raw?.favorites),
    visitReasons: normalizeChips(raw?.visitReasons),
    recommend: normalizeChips(raw?.recommend),
    eatExtras: normalizeChips(raw?.eatExtras),
    questionOrder: normalizeQuestionOrder(raw?.questionOrder),
    customQuestions: normalizeCustomQuestions(raw?.customQuestions),
  }
}

async function sbFetch(
  path: string,
  key: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const { url } = supabaseEnv()
  if (!url || !key) return { ok: false, status: 500, data: null, error: 'Supabase not configured' }
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
    return { ok: false, status: res.status, data, error: err }
  }
  return { ok: true, status: res.status, data }
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
    const latest = await sbFetch(
      `customer_reviews?id=like.${CONFIG_PREFIX}*&select=payload,created_at&order=created_at.desc&limit=1`,
      key,
    )
    if (latest.ok && Array.isArray(latest.data) && latest.data.length) {
      const payload = (latest.data[0] as { payload?: ReviewFormConfig }).payload
      return json(res, 200, { config: normalizeConfig(payload) })
    }
    const got = await sbFetch(
      `customer_reviews?id=eq.${encodeURIComponent(CONFIG_ID)}&select=payload`,
      key,
    )
    if (!got.ok || !Array.isArray(got.data) || !got.data.length) {
      return json(res, 200, { config: null })
    }
    const payload = (got.data[0] as { payload?: ReviewFormConfig }).payload
    return json(res, 200, { config: normalizeConfig(payload) })
  }

  if (req.method === 'POST') {
    const caller = await readCaller(req)
    if (!caller) {
      return json(res, 401, { error: 'Team login required to edit the review form.' })
    }
    const body = (req.body || {}) as { config?: ReviewFormConfig }
    const config = normalizeConfig(body.config)
    if (!config.spicy.length && !config.improve.length && !config.wantTry.length) {
      return json(res, 400, { error: 'Config looks empty.' })
    }
    if (!url || !key) return json(res, 200, { ok: true, config, stored: 'client-only' })
    const row = {
      id: `${CONFIG_PREFIX}${Date.now().toString(36)}`,
      created_at: new Date().toISOString(),
      payload: config,
    }
    const inserted = await sbFetch('customer_reviews', key, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row),
    })
    if (!inserted.ok) {
      return json(res, 500, { error: inserted.error || 'Could not save review form.' })
    }
    return json(res, 200, { ok: true, config, stored: 'cloud' })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
