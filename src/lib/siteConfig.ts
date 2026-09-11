/** Shared site customization — Developer Studio; synced to every account. */

import { teamApiHeaders } from './teamApiHeaders'

export type SiteNavId =
  | 'dashboard'
  | 'events'
  | 'calendar'
  | 'partners'
  | 'cash'
  | 'kitchen'
  | 'plan'
  | 'money'
  | 'insights'
  | 'stock'
  | 'food'
  | 'cards'
  | 'orders'
  | 'learn'
  | 'todos'
  | 'reviews'
  | 'goals'
  | 'intel'
  | 'team'
  | 'ai-helper'
  | 'ai-code'
  | 'upload'
  | 'quick-add'
  | 'playground'
  | 'account'
  | 'studio'
  | 'market-analysis'

export interface SiteNavItem {
  id: SiteNavId | string
  to: string
  labelEn: string
  labelDe: string
  visible: boolean
  audience: 'team' | 'jeeva' | 'developer' | 'guest' | 'all'
  stallOk: boolean
  custom?: boolean
}

export interface SiteFeatureTab {
  id: string
  labelEn: string
  labelDe: string
  bodyEn: string
  bodyDe: string
  visible: boolean
}

export interface SiteThemeOverrides {
  accent: string
  accent2: string
  radius: string
  bg: string
  bgElev: string
  /** Extra CSS injected for everyone (use carefully). */
  customCss: string
}

export interface SiteTextOverrides {
  brandName: string
  brandTaglineEn: string
  brandTaglineDe: string
  loginTitleEn: string
  loginTitleDe: string
  reviewEyebrow: string
  sidebarFooterEn: string
  sidebarFooterDe: string
}

export interface SiteSettings {
  /** Minutes on Orders before auto Stall mode. */
  idleEnterMinutes: number
  /** Minutes after unlock before auto re-lock. */
  idleRelockMinutes: number
  unlockPin: string
  showBrandSub: boolean
  showCountdown: boolean
  platePriceHint: number
}

export type BuiltinWidgetId =
  | 'countdown'
  | 'weather'
  | 'plates'
  | 'streak'
  | 'mood'
  | 'location'

export interface SiteWidget {
  id: string
  kind: 'builtin' | 'note'
  builtinId?: BuiltinWidgetId
  titleEn: string
  titleDe: string
  bodyEn: string
  bodyDe: string
  visible: boolean
  tone: 'leaf' | 'gold' | 'warn'
}

/** Override any UI label key (i18n) — empty = use default; hidden hides the string. */
export interface SiteCopyOverride {
  key: string
  en: string
  de: string
  hidden: boolean
}

/** Per-label overrides from Developer Edit UI pens. */
export interface SiteInlineEdit {
  text?: string
  hidden?: boolean
  deleted?: boolean
  fontSize?: string
  fontFamily?: string
}

export interface SiteConfig {
  version: 2
  updatedAt: string
  text: SiteTextOverrides
  theme: SiteThemeOverrides
  settings: SiteSettings
  nav: SiteNavItem[]
  features: SiteFeatureTab[]
  widgets: SiteWidget[]
  copy: SiteCopyOverride[]
  inlineEdits: Record<string, SiteInlineEdit>
}

export const SITE_CONFIG_ID = '__site_config__'
const LOCAL_KEY = 'nasta-site-config-v1'
const CUSTOM_CSS_ID = 'nasta-site-custom-css'

export const DEFAULT_SITE_NAV: SiteNavItem[] = [
  { id: 'dashboard', to: '/', labelEn: 'Dashboard', labelDe: 'Dashboard', visible: true, audience: 'team', stallOk: false },
  { id: 'events', to: '/events', labelEn: 'Events', labelDe: 'Events', visible: true, audience: 'team', stallOk: false },
  { id: 'kitchen', to: '/kitchen', labelEn: 'Kitchen', labelDe: 'Küche', visible: true, audience: 'all', stallOk: true },
  { id: 'plan', to: '/plan', labelEn: 'Plan', labelDe: 'Plan', visible: true, audience: 'all', stallOk: true },
  { id: 'money', to: '/money', labelEn: 'Money', labelDe: 'Geld', visible: true, audience: 'team', stallOk: false },
  { id: 'orders', to: '/orders', labelEn: 'Orders', labelDe: 'Bestellungen', visible: true, audience: 'all', stallOk: true },
  { id: 'insights', to: '/insights', labelEn: 'Insights', labelDe: 'Einblicke', visible: true, audience: 'team', stallOk: false },
  { id: 'market-analysis', to: '/market-analysis', labelEn: 'Market analysis', labelDe: 'Marktanalyse', visible: true, audience: 'jeeva', stallOk: false },
  { id: 'account', to: '/account', labelEn: 'Account', labelDe: 'Konto', visible: true, audience: 'all', stallOk: false },
  // Merged into hubs — kept for Studio / redirects, hidden from sidebar.
  { id: 'calendar', to: '/plan', labelEn: 'Calendar', labelDe: 'Kalender', visible: false, audience: 'all', stallOk: true },
  { id: 'partners', to: '/money/partners', labelEn: 'Partners', labelDe: 'Partner', visible: false, audience: 'team', stallOk: false },
  { id: 'cash', to: '/money', labelEn: 'Cash box', labelDe: 'Cashbox', visible: false, audience: 'team', stallOk: false },
  { id: 'stock', to: '/kitchen', labelEn: 'Stock', labelDe: 'Lager', visible: false, audience: 'all', stallOk: true },
  { id: 'food', to: '/kitchen/food', labelEn: 'Food', labelDe: 'Essen', visible: false, audience: 'all', stallOk: true },
  { id: 'cards', to: '/kitchen/cards', labelEn: 'Cards', labelDe: 'Karten', visible: false, audience: 'all', stallOk: true },
  { id: 'learn', to: '/plan/learn', labelEn: 'Learn DE', labelDe: 'Deutsch üben', visible: false, audience: 'all', stallOk: true },
  { id: 'todos', to: '/plan/todos', labelEn: 'To-dos', labelDe: 'Aufgaben', visible: false, audience: 'all', stallOk: true },
  { id: 'reviews', to: '/insights/reviews', labelEn: 'Reviews', labelDe: 'Bewertungen', visible: false, audience: 'team', stallOk: false },
  { id: 'goals', to: '/insights/goals', labelEn: 'Goals', labelDe: 'Ziele', visible: false, audience: 'team', stallOk: false },
  { id: 'intel', to: '/insights', labelEn: 'Intel', labelDe: 'Intel', visible: false, audience: 'team', stallOk: false },
  { id: 'team', to: '/team', labelEn: 'Team', labelDe: 'Team', visible: false, audience: 'team', stallOk: true },
  { id: 'ai-helper', to: '/ai-helper', labelEn: 'AI helper', labelDe: 'KI-Hilfe', visible: false, audience: 'team', stallOk: true },
  { id: 'ai-code', to: '/ai-code', labelEn: 'AI Code', labelDe: 'KI-Code', visible: true, audience: 'developer', stallOk: false },
  { id: 'upload', to: '/upload', labelEn: 'Upload', labelDe: 'Upload', visible: true, audience: 'developer', stallOk: false },
  { id: 'quick-add', to: '/quick-add', labelEn: 'Quick add', labelDe: 'Schnell hinzufügen', visible: true, audience: 'developer', stallOk: false },
  { id: 'playground', to: '/playground', labelEn: 'Training', labelDe: 'Training', visible: true, audience: 'all', stallOk: true },
  { id: 'studio', to: '/studio', labelEn: 'Studio', labelDe: 'Studio', visible: true, audience: 'developer', stallOk: false },
]

export const DEFAULT_WIDGETS: SiteWidget[] = [
  {
    id: 'w-countdown',
    kind: 'builtin',
    builtinId: 'countdown',
    titleEn: 'Next stall',
    titleDe: 'Nächster Stand',
    bodyEn: '',
    bodyDe: '',
    visible: true,
    tone: 'leaf',
  },
  {
    id: 'w-weather',
    kind: 'builtin',
    builtinId: 'weather',
    titleEn: 'Weather',
    titleDe: 'Wetter',
    bodyEn: '',
    bodyDe: '',
    visible: true,
    tone: 'warn',
  },
  {
    id: 'w-plates',
    kind: 'builtin',
    builtinId: 'plates',
    titleEn: 'Plate hunt',
    titleDe: 'Teller-Jagd',
    bodyEn: '',
    bodyDe: '',
    visible: true,
    tone: 'leaf',
  },
  {
    id: 'w-streak',
    kind: 'builtin',
    builtinId: 'streak',
    titleEn: 'Streak kitchen',
    titleDe: 'Serie',
    bodyEn: '',
    bodyDe: '',
    visible: true,
    tone: 'gold',
  },
  {
    id: 'w-mood',
    kind: 'builtin',
    builtinId: 'mood',
    titleEn: 'Money mood',
    titleDe: 'Stimmung',
    bodyEn: '',
    bodyDe: '',
    visible: true,
    tone: 'leaf',
  },
  {
    id: 'w-location',
    kind: 'builtin',
    builtinId: 'location',
    titleEn: 'Lucky pitch',
    titleDe: 'Bester Standort',
    bodyEn: '',
    bodyDe: '',
    visible: true,
    tone: 'leaf',
  },
]

/** Common labels developers often want to tweak. */
export const DEFAULT_COPY_KEYS: { key: string; en: string; de: string }[] = [
  { key: 'commandCenter', en: 'Command center', de: 'Kommandozentrale' },
  { key: 'commandCenterSub', en: 'Live stall intelligence — filter by month or event type.', de: 'Live Stall-Intelligenz — nach Monat oder Eventtyp filtern.' },
  { key: 'sales', en: 'Sales collected', de: 'Einnahmen' },
  { key: 'costs', en: 'Total costs', de: 'Kosten gesamt' },
  { key: 'net', en: 'Net result', de: 'Netto' },
  { key: 'orders', en: 'Orders', de: 'Bestellungen' },
  { key: 'stock', en: 'Stock', de: 'Lager' },
  { key: 'todos', en: 'To-dos', de: 'Aufgaben' },
  { key: 'stallMode', en: 'Stall mode', de: 'Stand-Modus' },
  { key: 'unlock', en: 'Unlock', de: 'Entsperren' },
  { key: 'signOut', en: 'Sign out', de: 'Abmelden' },
]

export function defaultSiteConfig(): SiteConfig {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    text: {
      brandName: 'Nasta Zentrum',
      brandTaglineEn: 'Frisch · Gesund · Authentisch',
      brandTaglineDe: 'Frisch · Gesund · Authentisch',
      loginTitleEn: 'Nasta Zentrum',
      loginTitleDe: 'Nasta Zentrum',
      reviewEyebrow: 'Nasta Zentrum',
      sidebarFooterEn: '',
      sidebarFooterDe: '',
    },
    theme: {
      accent: '',
      accent2: '',
      radius: '',
      bg: '',
      bgElev: '',
      customCss: '',
    },
    settings: {
      idleEnterMinutes: 15,
      idleRelockMinutes: 15,
      unlockPin: '9987',
      showBrandSub: true,
      showCountdown: true,
      platePriceHint: 8,
    },
    nav: DEFAULT_SITE_NAV.map((n) => ({ ...n })),
    features: [],
    widgets: DEFAULT_WIDGETS.map((w) => ({ ...w })),
    copy: DEFAULT_COPY_KEYS.map((c) => ({ ...c, hidden: false })),
    inlineEdits: {},
  }
}

const FONT_SIZES = new Set(['0.8rem', '0.9rem', '1rem', '1.15rem', '1.35rem', '1.6rem', '1.85rem'])
const FONT_FAMILIES = new Set([
  '',
  'Georgia, "Times New Roman", serif',
  '"Segoe UI", system-ui, sans-serif',
  'ui-monospace, Consolas, monospace',
  '"Trebuchet MS", "Segoe UI", sans-serif',
  '"Palatino Linotype", Palatino, serif',
])

export function normalizeInlineEdit(raw: unknown): SiteInlineEdit | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const next: SiteInlineEdit = {}
  if (typeof o.text === 'string') next.text = o.text.slice(0, 2000)
  if (o.hidden) next.hidden = true
  if (o.deleted) next.deleted = true
  if (typeof o.fontSize === 'string' && o.fontSize && FONT_SIZES.has(o.fontSize)) {
    next.fontSize = o.fontSize
  }
  if (typeof o.fontFamily === 'string' && o.fontFamily && FONT_FAMILIES.has(o.fontFamily)) {
    next.fontFamily = o.fontFamily
  }
  if (
    next.text === undefined &&
    !next.hidden &&
    !next.deleted &&
    !next.fontSize &&
    !next.fontFamily
  ) {
    return null
  }
  return next
}

function slugId(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || `item-${Date.now().toString(36)}`
  )
}

export function newFeatureTab(labelEn = 'New feature'): SiteFeatureTab {
  const id = slugId(labelEn)
  return {
    id,
    labelEn,
    labelDe: labelEn,
    bodyEn: 'Describe this feature for the team…',
    bodyDe: 'Beschreibe diese Funktion für das Team…',
    visible: true,
  }
}

export function newNoteWidget(titleEn = 'Custom note'): SiteWidget {
  return {
    id: `note-${Date.now().toString(36)}`,
    kind: 'note',
    titleEn,
    titleDe: titleEn,
    bodyEn: 'Your message for the dashboard…',
    bodyDe: 'Deine Nachricht für das Dashboard…',
    visible: true,
    tone: 'leaf',
  }
}

function clampMin(n: unknown, fallback: number, min: number, max: number): number {
  const v = Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, Math.round(v)))
}

export function normalizeSiteConfig(raw: Partial<SiteConfig> | null | undefined): SiteConfig {
  const base = defaultSiteConfig()
  if (!raw || typeof raw !== 'object') return base
  const text = { ...base.text, ...(raw.text || {}) }
  const theme = { ...base.theme, ...(raw.theme || {}) }
  const settings: SiteSettings = {
    idleEnterMinutes: clampMin(raw.settings?.idleEnterMinutes, 15, 1, 240),
    idleRelockMinutes: clampMin(raw.settings?.idleRelockMinutes, 15, 1, 240),
    unlockPin: String(raw.settings?.unlockPin ?? '9987')
      .replace(/\D/g, '')
      .slice(0, 8) || '9987',
    showBrandSub: raw.settings?.showBrandSub !== false,
    showCountdown: raw.settings?.showCountdown !== false,
    platePriceHint: clampMin(raw.settings?.platePriceHint, 8, 1, 100),
  }

  const byId = new Map<string, SiteNavItem>()
  for (const n of base.nav) byId.set(n.id, { ...n })
  if (Array.isArray(raw.nav)) {
    for (const n of raw.nav) {
      if (!n || typeof n !== 'object' || !n.id) continue
      const prev = byId.get(String(n.id))
      byId.set(String(n.id), {
        id: String(n.id),
        to: String(n.to || prev?.to || `/feature/${n.id}`),
        labelEn: String(n.labelEn || prev?.labelEn || n.id),
        labelDe: String(n.labelDe || n.labelEn || prev?.labelDe || n.id),
        visible: n.visible !== false,
        audience: (['team', 'jeeva', 'developer', 'guest', 'all'] as const).includes(
          n.audience as SiteNavItem['audience'],
        )
          ? (n.audience as SiteNavItem['audience'])
          : prev?.audience || 'team',
        stallOk: Boolean(n.stallOk ?? prev?.stallOk),
        custom: Boolean(n.custom || prev?.custom),
      })
    }
  }
  const nav: SiteNavItem[] = []
  const seen = new Set<string>()
  for (const d of base.nav) {
    const hit = byId.get(d.id)
    if (hit) {
      nav.push(hit)
      seen.add(d.id)
    }
  }
  for (const [id, item] of byId) {
    if (!seen.has(id)) nav.push(item)
  }

  // Force tool placement: Upload / Quick add / AI Code → Developer; AI helper → FAB only.
  // Merged leaf tabs stay hidden (hubs: kitchen / plan / money / insights).
  const HIDDEN_MERGED = new Set([
    'calendar',
    'partners',
    'cash',
    'stock',
    'food',
    'cards',
    'learn',
    'todos',
    'reviews',
    'goals',
    'intel',
    'team',
    'ai-helper',
  ])
  for (let i = 0; i < nav.length; i++) {
    const id = nav[i].id
    if (id === 'upload' || id === 'quick-add' || id === 'ai-code') {
      nav[i] = { ...nav[i], audience: 'developer', stallOk: false }
    }
    if (HIDDEN_MERGED.has(id)) {
      nav[i] = { ...nav[i], visible: false }
    }
    if (id === 'kitchen') {
      nav[i] = { ...nav[i], to: '/kitchen', visible: true, audience: 'all', stallOk: true }
    }
    if (id === 'plan') {
      nav[i] = { ...nav[i], to: '/plan', visible: true, audience: 'all', stallOk: true }
    }
    if (id === 'money') {
      nav[i] = { ...nav[i], to: '/money', visible: true, audience: 'team', stallOk: false }
    }
    if (id === 'insights') {
      nav[i] = { ...nav[i], to: '/insights', stallOk: false }
    }
    if (id === 'market-analysis') {
      nav[i] = {
        ...nav[i],
        to: '/market-analysis',
        visible: true,
        audience: 'all',
        stallOk: false,
      }
    }
  }

  const features: SiteFeatureTab[] = Array.isArray(raw.features)
    ? raw.features
        .filter((f) => f && typeof f === 'object' && f.id)
        .map((f) => ({
          id: String(f.id).slice(0, 48),
          labelEn: String(f.labelEn || f.id).slice(0, 80),
          labelDe: String(f.labelDe || f.labelEn || f.id).slice(0, 80),
          bodyEn: String(f.bodyEn || '').slice(0, 8000),
          bodyDe: String(f.bodyDe || f.bodyEn || '').slice(0, 8000),
          visible: f.visible !== false,
        }))
    : []

  const widgetMap = new Map<string, SiteWidget>()
  for (const w of base.widgets) widgetMap.set(w.id, { ...w })
  if (Array.isArray(raw.widgets)) {
    for (const w of raw.widgets) {
      if (!w || typeof w !== 'object' || !w.id) continue
      const prev = widgetMap.get(String(w.id))
      widgetMap.set(String(w.id), {
        id: String(w.id).slice(0, 48),
        kind: w.kind === 'note' ? 'note' : 'builtin',
        builtinId: (w.builtinId || prev?.builtinId) as BuiltinWidgetId | undefined,
        titleEn: String(w.titleEn || prev?.titleEn || w.id).slice(0, 80),
        titleDe: String(w.titleDe || w.titleEn || prev?.titleDe || w.id).slice(0, 80),
        bodyEn: String(w.bodyEn ?? prev?.bodyEn ?? '').slice(0, 2000),
        bodyDe: String(w.bodyDe ?? w.bodyEn ?? prev?.bodyDe ?? '').slice(0, 2000),
        visible: w.visible !== false,
        tone: (['leaf', 'gold', 'warn'] as const).includes(w.tone as SiteWidget['tone'])
          ? (w.tone as SiteWidget['tone'])
          : prev?.tone || 'leaf',
      })
    }
  }
  const widgets = [...widgetMap.values()]

  const copyMap = new Map<string, SiteCopyOverride>()
  for (const c of base.copy) copyMap.set(c.key, { ...c })
  if (Array.isArray(raw.copy)) {
    for (const c of raw.copy) {
      if (!c || typeof c !== 'object' || !c.key) continue
      const prev = copyMap.get(String(c.key))
      copyMap.set(String(c.key), {
        key: String(c.key).slice(0, 80),
        en: String(c.en ?? prev?.en ?? '').slice(0, 500),
        de: String(c.de ?? c.en ?? prev?.de ?? '').slice(0, 500),
        hidden: Boolean(c.hidden),
      })
    }
  }

  const inlineEdits: Record<string, SiteInlineEdit> = {}
  const rawEdits = raw.inlineEdits
  if (rawEdits && typeof rawEdits === 'object') {
    for (const [key, val] of Object.entries(rawEdits)) {
      const id = String(key).slice(0, 120)
      if (!id) continue
      const edit = normalizeInlineEdit(val)
      if (edit) inlineEdits[id] = edit
    }
  }

  return {
    version: 2,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
    text,
    theme,
    settings,
    nav,
    features,
    widgets,
    copy: [...copyMap.values()],
    inlineEdits,
  }
}

export function loadLocalSiteConfig(): SiteConfig {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return defaultSiteConfig()
    return normalizeSiteConfig(JSON.parse(raw) as SiteConfig)
  } catch {
    return defaultSiteConfig()
  }
}

export function saveLocalSiteConfig(config: SiteConfig) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(config))
}

export function applySiteTheme(theme: SiteThemeOverrides) {
  const root = document.documentElement
  const setOrClear = (prop: string, value: string) => {
    if (value) root.style.setProperty(prop, value)
    else root.style.removeProperty(prop)
  }
  setOrClear('--accent', theme.accent)
  setOrClear('--accent-2', theme.accent2)
  setOrClear('--radius', theme.radius)
  setOrClear('--bg', theme.bg)
  setOrClear('--bg-elev', theme.bgElev)

  let styleEl = document.getElementById(CUSTOM_CSS_ID) as HTMLStyleElement | null
  if (theme.customCss?.trim()) {
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = CUSTOM_CSS_ID
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = theme.customCss
  } else if (styleEl) {
    styleEl.remove()
  }
}

export function idleEnterMs(settings: SiteSettings): number {
  return Math.max(1, settings.idleEnterMinutes) * 60 * 1000
}

export function idleRelockMs(settings: SiteSettings): number {
  return Math.max(1, settings.idleRelockMinutes) * 60 * 1000
}

export async function fetchSiteConfig(): Promise<SiteConfig> {
  try {
    const res = await fetch('/api/site-config')
    if (res.ok) {
      const data = (await res.json()) as { config?: SiteConfig | null }
      if (data.config) {
        const cfg = normalizeSiteConfig(data.config)
        saveLocalSiteConfig(cfg)
        return cfg
      }
    }
  } catch {
    /* fall through */
  }
  return loadLocalSiteConfig()
}

export async function publishSiteConfig(
  config: SiteConfig,
  user: { name?: string; email?: string } | null,
): Promise<SiteConfig> {
  const next = normalizeSiteConfig({ ...config, updatedAt: new Date().toISOString() })
  saveLocalSiteConfig(next)
  const res = await fetch('/api/site-config', {
    method: 'POST',
    headers: await teamApiHeaders(user),
    body: JSON.stringify({ config: next, userName: user?.name, userEmail: user?.email }),
  })
  const data = (await res.json()) as { config?: SiteConfig; error?: string }
  if (!res.ok) throw new Error(data.error || 'Could not save site config')
  const saved = normalizeSiteConfig(data.config || next)
  saveLocalSiteConfig(saved)
  return saved
}
