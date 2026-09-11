/** Customer feedback via QR — tap-first form, cloud + local backup. */

import { DEFAULT_MENU } from './stallOps'
import { teamApiHeaders } from './teamApiHeaders'

export type SpicyLevel = string
export type RecommendLevel = string
export type ReviewLang = 'en' | 'de'

export interface ReviewChip {
  id: string
  en: string
  de: string
}

/** Built-in question blocks on /review (order is editable). */
export type ReviewQuestionKey =
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

export const DEFAULT_QUESTION_ORDER: ReviewQuestionKey[] = [
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

export type CustomReviewQuestion = {
  id: string
  en: string
  de: string
  /** chips = multi-select options; text = free text */
  type: 'chips' | 'text'
  options: ReviewChip[]
}

export interface ReviewFormConfig {
  spicy: ReviewChip[]
  improve: ReviewChip[]
  wantTry: ReviewChip[]
  favorites: ReviewChip[]
  visitReasons: ReviewChip[]
  recommend: ReviewChip[]
  /** Extra chips under “What did you eat?” (besides live menu). */
  eatExtras: ReviewChip[]
  /** Display order of built-in questions after overall stars. */
  questionOrder?: ReviewQuestionKey[]
  /** Extra staff-defined questions. */
  customQuestions?: CustomReviewQuestion[]
}

export interface CustomerReview {
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
  lang?: ReviewLang
}

/** Sentinel row id in customer_reviews for the editable form config. */
export const REVIEW_FORM_CONFIG_ID = '__review_form__'

export const SPICY_OPTIONS: { id: SpicyLevel; en: string; de: string }[] = [
  { id: 'perfect', en: 'Perfect 🌶️', de: 'Perfekt 🌶️' },
  { id: 'too_mild', en: 'Too mild', de: 'Zu mild' },
  { id: 'too_spicy', en: 'Too spicy', de: 'Zu scharf' },
  { id: 'not_spicy', en: "Didn't order spicy food", de: 'Kein scharfes Essen bestellt' },
]

export const IMPROVE_OPTIONS: { id: string; en: string; de: string }[] = [
  { id: 'great', en: 'Everything was great ✅', de: 'Alles war super ✅' },
  { id: 'spice', en: 'Spice', de: 'Schärfe' },
  { id: 'salt', en: 'Salt', de: 'Salz' },
  { id: 'portion', en: 'Portion size', de: 'Portionsgröße' },
  { id: 'temp', en: 'Temperature', de: 'Temperatur' },
  { id: 'wait', en: 'Wait time', de: 'Wartezeit' },
  { id: 'taste', en: 'Taste', de: 'Geschmack' },
  { id: 'presentation', en: 'Presentation', de: 'Präsentation' },
  { id: 'crispy', en: 'Crispy enough', de: 'Knusprig genug' },
  { id: 'chutney', en: 'Chutney', de: 'Chutney' },
  { id: 'sambar', en: 'Sambar', de: 'Sambar' },
  { id: 'value', en: 'Value for money', de: 'Preis-Leistung' },
]

export const WANT_TRY_OPTIONS: { id: string; en: string; de: string }[] = [
  { id: 'vada', en: 'Vada', de: 'Vada' },
  { id: 'more_dosa', en: 'More dosa varieties', de: 'Mehr Dosa-Varianten' },
  { id: 'mini_dosa', en: 'Mini dosa', de: 'Mini-Dosa' },
  { id: 'egg_dosa', en: 'Egg dosa', de: 'Ei-Dosa' },
  { id: 'dessert', en: 'Dessert', de: 'Dessert' },
  { id: 'kids', en: 'Kids meal', de: 'Kindermenü' },
  { id: 'less_spicy', en: 'Less spicy option', de: 'Mildere Option' },
]

export const RECOMMEND_OPTIONS: { id: RecommendLevel; en: string; de: string }[] = [
  { id: 'definitely', en: 'Definitely', de: 'Auf jeden Fall' },
  { id: 'maybe', en: 'Maybe', de: 'Vielleicht' },
  { id: 'probably_not', en: 'Probably not', de: 'Eher nicht' },
]

export const VISIT_OPTIONS: { id: string; en: string; de: string }[] = [
  { id: 'walked', en: 'Walked past', de: 'Vorbeigegangen' },
  { id: 'instagram', en: 'Instagram', de: 'Instagram' },
  { id: 'friend', en: 'Friend recommendation', de: 'Freundesempfehlung' },
  { id: 'google', en: 'Google Maps', de: 'Google Maps' },
  { id: 'event', en: 'Event/Festival', de: 'Event/Festival' },
  { id: 'returning', en: 'Returning customer', de: 'Wiederkehrender Gast' },
]

export const FAVORITE_OPTIONS: { id: string; en: string; de: string }[] = [
  { id: 'dosa', en: 'Dosa', de: 'Dosa' },
  { id: 'chutney', en: 'Chutney', de: 'Chutney' },
  { id: 'sambar', en: 'Sambar', de: 'Sambar' },
  { id: 'gobi', en: 'Gobi 65', de: 'Gobi 65' },
  { id: 'chai', en: 'Masala Chai', de: 'Masala Chai' },
  { id: 'lassi', en: 'Mango Lassi', de: 'Mango Lassi' },
]

export const FOOD_RATING_LABELS: { en: string[]; de: string[] } = {
  en: ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'],
  de: ['Schlecht', 'Geht so', 'Gut', 'Sehr gut', 'Ausgezeichnet'],
}

export const DEFAULT_REVIEW_FORM_CONFIG: ReviewFormConfig = {
  spicy: SPICY_OPTIONS.map((o) => ({ ...o })),
  improve: IMPROVE_OPTIONS.map((o) => ({ ...o })),
  wantTry: WANT_TRY_OPTIONS.map((o) => ({ ...o })),
  favorites: FAVORITE_OPTIONS.map((o) => ({ ...o })),
  visitReasons: VISIT_OPTIONS.map((o) => ({ ...o })),
  recommend: RECOMMEND_OPTIONS.map((o) => ({ ...o })),
  eatExtras: [],
  questionOrder: [...DEFAULT_QUESTION_ORDER],
  customQuestions: [],
}

const LANG_KEY = 'nasta-review-lang'
const LOCAL_KEY = 'nasta-customer-reviews-v1'
const FORM_LOCAL_KEY = 'nasta-review-form-config-v1'
const ITEM_OTHER = '__other__'

function slugChipId(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  return base || `chip_${Date.now().toString(36)}`
}

function normalizeChips(
  raw: unknown,
  fallback: ReviewChip[],
  allowEmpty = false,
): ReviewChip[] {
  if (!Array.isArray(raw)) return fallback.map((c) => ({ ...c }))
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
  if (!out.length) return allowEmpty ? [] : fallback.map((c) => ({ ...c }))
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
      options: type === 'chips' ? normalizeChips(r.options, [], true) : [],
    })
  }
  return out.slice(0, 20)
}

export function normalizeReviewFormConfig(raw: Partial<ReviewFormConfig> | null | undefined): ReviewFormConfig {
  const d = DEFAULT_REVIEW_FORM_CONFIG
  return {
    spicy: normalizeChips(raw?.spicy, d.spicy),
    improve: normalizeChips(raw?.improve, d.improve),
    wantTry: normalizeChips(raw?.wantTry, d.wantTry),
    favorites: normalizeChips(raw?.favorites, d.favorites),
    visitReasons: normalizeChips(raw?.visitReasons, d.visitReasons),
    recommend: normalizeChips(raw?.recommend, d.recommend),
    eatExtras: normalizeChips(raw?.eatExtras, [], true),
    questionOrder: normalizeQuestionOrder(raw?.questionOrder),
    customQuestions: normalizeCustomQuestions(raw?.customQuestions),
  }
}

export function moveChipInList(list: ReviewChip[], id: string, dir: 'up' | 'down'): ReviewChip[] {
  const idx = list.findIndex((c) => c.id === id)
  if (idx < 0) return list
  const swap = dir === 'up' ? idx - 1 : idx + 1
  if (swap < 0 || swap >= list.length) return list
  const next = [...list]
  ;[next[idx], next[swap]] = [next[swap]!, next[idx]!]
  return next
}

export function moveQuestionKey(
  order: ReviewQuestionKey[],
  key: ReviewQuestionKey,
  dir: 'up' | 'down',
): ReviewQuestionKey[] {
  const idx = order.indexOf(key)
  if (idx < 0) return order
  const swap = dir === 'up' ? idx - 1 : idx + 1
  if (swap < 0 || swap >= order.length) return order
  const next = [...order]
  ;[next[idx], next[swap]] = [next[swap]!, next[idx]!]
  return next
}

export function loadLocalReviewFormConfig(): ReviewFormConfig {
  try {
    const raw = localStorage.getItem(FORM_LOCAL_KEY)
    if (!raw) return normalizeReviewFormConfig(null)
    return normalizeReviewFormConfig(JSON.parse(raw) as ReviewFormConfig)
  } catch {
    return normalizeReviewFormConfig(null)
  }
}

export function saveLocalReviewFormConfig(config: ReviewFormConfig) {
  localStorage.setItem(FORM_LOCAL_KEY, JSON.stringify(normalizeReviewFormConfig(config)))
}

export function newReviewChip(en = 'New option', de = 'Neue Option'): ReviewChip {
  return { id: `${slugChipId(en)}_${Math.random().toString(36).slice(2, 6)}`, en, de }
}

export function itemOtherId() {
  return ITEM_OTHER
}

export function loadReviewLang(): ReviewLang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'de' || v === 'en') return v
  } catch {
    /* ignore */
  }
  return 'de'
}

export function saveReviewLang(lang: ReviewLang) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* ignore */
  }
}

export const REVIEW_UI = {
  en: {
    title: 'Quick feedback',
    thanksTitle: (name: string) => `Thank you, ${name}`,
    sub: 'A few taps — about 30 seconds.',
    overall: 'Overall, how was your experience?',
    optionalHint: 'Thanks! The rest is optional — only if you feel like it.',
    name: 'Name (optional)',
    namePh: 'First name is enough',
    ate: 'What did you eat?',
    ateOther: 'Other',
    ateOtherPh: 'What else?',
    spicy: 'How was the spice?',
    food: 'How was the food?',
    improve: 'What should we improve?',
    service: 'How was the service?',
    recommend: 'Would you recommend us?',
    want: 'What would you like us to add?',
    wantOther: 'Other idea (optional)',
    wantOtherPh: 'Short idea…',
    visit: 'Why did you visit us today?',
    favorite: 'What was your favorite today?',
    smile: 'What made you smile today? 😊',
    smilePh: 'A short note…',
    send: 'Send feedback',
    sending: 'Sending…',
    errOverall: 'Please tap your overall experience stars.',
    errDetails: 'Please rate the food and service too.',
    friend: 'friend',
    optional: 'optional',
  },
  de: {
    title: 'Kurzes Feedback',
    thanksTitle: (name: string) => `Vielen Dank, ${name}`,
    sub: 'Ein paar Tipps — etwa 30 Sekunden.',
    overall: 'Wie war dein Gesamteindruck?',
    optionalHint: 'Danke! Der Rest ist optional — nur wenn du magst.',
    name: 'Name (optional)',
    namePh: 'Vorname reicht',
    ate: 'Was hast du gegessen?',
    ateOther: 'Sonstiges',
    ateOtherPh: 'Was noch?',
    spicy: 'Wie war die Schärfe?',
    food: 'Wie war das Essen?',
    improve: 'Was können wir verbessern?',
    service: 'Wie war der Service?',
    recommend: 'Würdest du uns weiterempfehlen?',
    want: 'Was sollen wir noch anbieten?',
    wantOther: 'Andere Idee (optional)',
    wantOtherPh: 'Kurze Idee…',
    visit: 'Warum bist du heute bei uns?',
    favorite: 'Was war heute dein Favorit?',
    smile: 'Was hat dich heute zum Lächeln gebracht? 😊',
    smilePh: 'Kurze Notiz…',
    send: 'Feedback senden',
    sending: 'Wird gesendet…',
    errOverall: 'Bitte tippe die Sterne für den Gesamteindruck.',
    errDetails: 'Bitte bewerte auch Essen und Service.',
    friend: 'Freund',
    optional: 'optional',
  },
} as const

export function reviewMenuChips(): string[] {
  return DEFAULT_MENU.filter((m) => !m.hidden).map((m) => m.name)
}

export function newReviewId(): string {
  return `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function thankYouMessage(r: Pick<CustomerReview, 'name'>, lang: ReviewLang): string {
  const first = r.name.trim().split(/\s+/)[0] || (lang === 'de' ? 'Freund' : 'friend')
  if (lang === 'de') {
    return [
      `Vielen Dank, ${first}, dass du bei uns vorbeigeschaut und gemeinsam mit uns eine Dosa genossen hast. ❤️`,
      '',
      'Jede Dosa, die wir zubereiten, ist etwas Besonderes. Doch heute hast du unseren Tag noch ein Stück schöner gemacht. Danke für deine lieben Worte, dein Lächeln und dafür, dass du unseren kleinen Traum unterstützt.',
      '',
      'Wir wünschen dir einen Tag voller gutem Essen, netter Menschen und schöner Überraschungen.',
      '',
      'Pass gut auf dich auf, bleib so, wie du bist, und komm gerne wieder vorbei, wenn du Lust auf eine knusprige Dosa hast. Wir freuen uns schon auf deinen nächsten Besuch! ☀️',
    ].join('\n')
  }
  return [
    `Thank you, ${first}, for stopping by and sharing a meal with us. ❤️`,
    '',
    'Every dosa we make is special, but today you made our day even more special. Thank you for your kind words, your smile, and for supporting our little dream.',
    '',
    'We hope your day is filled with good food, good people, and happy surprises.',
    '',
    "Take care, keep smiling, and come back whenever you're craving another crispy dosa. We'll be waiting for you. ☀️",
  ].join('\n')
}

function clampStar(n: unknown): number {
  const v = Math.round(Number(n) || 0)
  if (v < 1 || v > 5) return 0
  return v
}

function mapLegacySpicy(raw: unknown): SpicyLevel | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  if (raw === 'yes' || raw === 'bit_spicy') return 'perfect'
  if (raw === 'too_hot') return 'too_spicy'
  return raw.trim().slice(0, 48)
}

export function normalizeReview(raw: Partial<CustomerReview> | null | undefined): CustomerReview | null {
  if (!raw || typeof raw !== 'object') return null
  const overallRating = clampStar(raw.overallRating ?? raw.foodRating)
  if (!overallRating) return null
  const foodRating = clampStar(raw.foodRating)
  const serviceRating = clampStar(raw.serviceRating)
  const name = String(raw.name || '').trim().slice(0, 80)
  const spicyOk = mapLegacySpicy(raw.spicyOk)
  const recommend =
    typeof raw.recommend === 'string' && raw.recommend.trim()
      ? raw.recommend.trim().slice(0, 48)
      : undefined
  return {
    id: String(raw.id || newReviewId()),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    name,
    overallRating,
    items: Array.isArray(raw.items)
      ? raw.items.map((x) => String(x).trim()).filter(Boolean).slice(0, 16)
      : [],
    itemsOther: String(raw.itemsOther || '').trim().slice(0, 120) || undefined,
    spicyOk,
    foodRating,
    improve: Array.isArray(raw.improve)
      ? raw.improve.map((x) => String(x).trim()).filter(Boolean).slice(0, 16)
      : [],
    serviceRating,
    recommend,
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

export function loadLocalReviews(): CustomerReview[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CustomerReview[]
    return Array.isArray(parsed) ? (parsed.map(normalizeReview).filter(Boolean) as CustomerReview[]) : []
  } catch {
    return []
  }
}

export function saveLocalReviews(list: CustomerReview[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 500)))
}

export function appendLocalReview(review: CustomerReview) {
  const next = [review, ...loadLocalReviews()].slice(0, 500)
  saveLocalReviews(next)
  return next
}

export function spicyLabel(
  id: SpicyLevel | undefined,
  lang: ReviewLang = 'en',
  config?: ReviewFormConfig,
): string {
  if (!id) return '—'
  const list = config?.spicy || SPICY_OPTIONS
  const o = list.find((x) => x.id === id)
  return o ? o[lang] : id
}

export function recommendLabel(
  id: RecommendLevel | undefined,
  lang: ReviewLang = 'en',
  config?: ReviewFormConfig,
): string {
  if (!id) return '—'
  const list = config?.recommend || RECOMMEND_OPTIONS
  const o = list.find((x) => x.id === id)
  return o ? o[lang] : id
}

export async function fetchReviewFormConfig(): Promise<ReviewFormConfig> {
  try {
    const res = await fetch('/api/review-form')
    if (res.ok) {
      const data = (await res.json()) as { config?: ReviewFormConfig | null }
      if (data.config && (data.config.spicy?.length || data.config.wantTry?.length)) {
        const cfg = normalizeReviewFormConfig(data.config)
        saveLocalReviewFormConfig(cfg)
        return cfg
      }
    }
  } catch {
    /* fall through */
  }
  return loadLocalReviewFormConfig()
}

export async function publishReviewFormConfig(
  config: ReviewFormConfig,
  user: { name?: string; email?: string } | null,
): Promise<ReviewFormConfig> {
  const normalized = normalizeReviewFormConfig(config)
  saveLocalReviewFormConfig(normalized)
  const res = await fetch('/api/review-form', {
    method: 'POST',
    headers: await teamApiHeaders(user),
    body: JSON.stringify({ config: normalized, userName: user?.name, userEmail: user?.email }),
  })
  const data = (await res.json()) as { config?: ReviewFormConfig; error?: string }
  if (!res.ok) throw new Error(data.error || 'Could not save review form')
  const saved = normalizeReviewFormConfig(data.config || normalized)
  saveLocalReviewFormConfig(saved)
  return saved
}

export function reviewPublicUrl(): string {
  if (typeof window === 'undefined') return '/review'
  return `${window.location.origin}/review`
}

export function reviewQrImageUrl(size = 220): string {
  const data = encodeURIComponent(reviewPublicUrl())
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`
}
