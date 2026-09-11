import type { VercelRequest, VercelResponse } from '@vercel/node'
import { json, readCaller, TEAM_API_CORS_HEADERS } from './_lib/nastaAuth.js'
import { saveStallOpsMutate } from './_lib/teamExtrasCas.js'

type SpicyLevel = 'perfect' | 'too_mild' | 'too_spicy' | 'not_spicy'
type RecommendLevel = 'definitely' | 'maybe' | 'probably_not'

interface CustomerReview {
  id: string
  createdAt: string
  name: string
  overallRating: number
  items: string[]
  itemsOther?: string
  spicyOk?: SpicyLevel
  foodRating: number
  improve: string[]
  serviceRating: number
  recommend?: RecommendLevel
  wantToTry: string[]
  wantOther?: string
  visitReason: string[]
  favorites: string[]
  smileNote?: string
  lang?: 'en' | 'de'
}

const SPICY = new Set<SpicyLevel>(['perfect', 'too_mild', 'too_spicy', 'not_spicy'])
const RECOMMEND = new Set<RecommendLevel>(['definitely', 'maybe', 'probably_not'])

function supabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return { url, anon, service }
}

function clampStar(n: unknown): number {
  const v = Math.round(Number(n) || 0)
  if (v < 1 || v > 5) return 0
  return v
}

function mapSpicy(raw: unknown): SpicyLevel | undefined {
  if (SPICY.has(raw as SpicyLevel)) return raw as SpicyLevel
  if (raw === 'yes' || raw === 'bit_spicy') return 'perfect'
  if (raw === 'too_hot') return 'too_spicy'
  if (raw === 'too_mild') return 'too_mild'
  return undefined
}

function normalizeReview(raw: Partial<CustomerReview> & { spicyOk?: string }): CustomerReview | null {
  const overallRating = clampStar(raw.overallRating ?? raw.foodRating)
  if (!overallRating) return null
  return {
    id: String(raw.id || `rev-${Date.now().toString(36)}`),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    name: String(raw.name || '')
      .trim()
      .slice(0, 80),
    overallRating,
    items: Array.isArray(raw.items)
      ? raw.items.map((x) => String(x).trim()).filter(Boolean).slice(0, 16)
      : [],
    itemsOther: String(raw.itemsOther || '').trim().slice(0, 120) || undefined,
    spicyOk: mapSpicy(raw.spicyOk),
    foodRating: clampStar(raw.foodRating),
    improve: Array.isArray(raw.improve)
      ? raw.improve.map((x) => String(x).trim()).filter(Boolean).slice(0, 16)
      : [],
    serviceRating: clampStar(raw.serviceRating),
    recommend: RECOMMEND.has(raw.recommend as RecommendLevel)
      ? (raw.recommend as RecommendLevel)
      : undefined,
    wantToTry: Array.isArray(raw.wantToTry)
      ? raw.wantToTry.map((x) => String(x).trim()).filter(Boolean).slice(0, 16)
      : [],
    wantOther: String(raw.wantOther || '').trim().slice(0, 120) || undefined,
    visitReason: Array.isArray(raw.visitReason)
      ? raw.visitReason.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
      : [],
    favorites: Array.isArray(raw.favorites)
      ? raw.favorites.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
      : [],
    smileNote: String(raw.smileNote || '').trim().slice(0, 200) || undefined,
    lang: raw.lang === 'de' || raw.lang === 'en' ? raw.lang : undefined,
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
      Prefer: init?.method === 'POST' ? 'return=representation' : 'return=minimal',
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

async function insertReviewRow(review: CustomerReview, key: string) {
  return sbFetch('customer_reviews', key, {
    method: 'POST',
    body: JSON.stringify({ id: review.id, created_at: review.createdAt, payload: review }),
  })
}

async function listReviewRows(key: string, limit = 200): Promise<CustomerReview[]> {
  const res = await sbFetch(
    `customer_reviews?select=id,payload,created_at&order=created_at.desc&limit=${limit}`,
    key,
  )
  if (!res.ok || !Array.isArray(res.data)) return []
  return (res.data as { payload: CustomerReview; id?: string }[])
    .filter((row) => {
      const id = String(row.id || '')
      if (!id) return true
      if (id === '__review_form__' || id === '__site_config__') return false
      if (id.startsWith('__nasta_login_pin__')) return false
      if (
        id === '__public_menu_overrides__' ||
        id.startsWith('__pmenu_ov_') ||
        id.startsWith('__pmenu_k_')
      ) {
        return false
      }
      if (id.startsWith('__rform_')) return false
      return true
    })
    .map((row) => normalizeReview(row.payload))
    .filter((r): r is CustomerReview => Boolean(r))
}

async function mirrorIntoStallOps(review: CustomerReview) {
  const { url, service } = supabaseEnv()
  if (!url || !service) return
  await saveStallOpsMutate(url, service, (ops) => {
    const prev = Array.isArray(ops.customerReviews)
      ? (ops.customerReviews as CustomerReview[])
      : []
    return {
      ops: {
        ...ops,
        customerReviews: [review, ...prev.filter((r) => r.id !== review.id)].slice(0, 500),
      },
      value: true,
    }
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', TEAM_API_CORS_HEADERS)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const { url, anon, service } = supabaseEnv()
  const writeKey = service || anon
  const readKey = service || anon

  if (req.method === 'POST') {
    const review = normalizeReview((req.body || {}) as Partial<CustomerReview>)
    if (!review) return json(res, 400, { error: 'Overall rating is required.' })
    if (!url || !writeKey) {
      return json(res, 200, { ok: true, review, stored: 'client-only' })
    }
    const inserted = await insertReviewRow(review, writeKey)
    if (!inserted.ok) {
      return json(res, 200, {
        ok: true,
        review,
        stored: 'client-only',
        warning: inserted.error || 'Cloud table unavailable',
      })
    }
    await mirrorIntoStallOps(review).catch(() => undefined)
    return json(res, 200, { ok: true, review, stored: 'cloud' })
  }

  if (req.method === 'GET') {
    const caller = await readCaller(req)
    if (!caller) return json(res, 401, { error: 'Team login required' })
    if (!url || !readKey) return json(res, 200, { reviews: [] })
    const reviews = await listReviewRows(readKey)
    return json(res, 200, { reviews })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
