import type { VercelRequest, VercelResponse } from '@vercel/node'
import { json, readCaller, TEAM_API_CORS_HEADERS } from './_lib/nastaAuth.js'
import { eventKeysForMenuPatch, requirePlaceEventId } from './_lib/scopedMenuPatch.js'
import { MutateAbort, saveStallOpsMutate } from './_lib/teamExtrasCas.js'

type DrinkChoice = 'chai' | 'lassi'

type PublicSection = 'combos' | 'mains' | 'snacks' | 'drinks'

interface MenuItem {
  id: string
  name: string
  kind: 'single' | 'combo'
  price: number
  priceWithChai?: number
  priceWithLassi?: number
  contents?: string
  description?: string
  ingredients?: string
  nameDe?: string
  contentsDe?: string
  descriptionDe?: string
  ingredientsDe?: string
  imageUrl?: string
  vegan?: boolean
  vegetarian?: boolean
  glutenFree?: boolean
  hidden?: boolean
  hideFromCustomer?: boolean
  soldOut?: boolean
  /** Customer /order section (overrides id/name heuristics). */
  publicSection?: PublicSection
}

interface OrderLine {
  menuItemId: string
  name: string
  price: number
  qty: number
  drink?: DrinkChoice
}

interface StallOrder {
  id: string
  label: string
  status: 'awaiting_claim' | 'pending' | 'completed'
  lines: OrderLine[]
  createdAt: string
  eventId?: string
  source?: 'pos' | 'customer'
  claimCode?: string
  claimedAt?: string
  customerName?: string
  voided?: boolean
  updatedAt?: string
}

interface EventOrderLink {
  menuKey: string
  label: string
}

interface StallOps {
  menu?: MenuItem[]
  orders?: StallOrder[]
  /** Tombstones — never re-add these ids when placing/claiming. */
  deletedOrderIds?: string[]
  activeEventId?: string
  /** Event-type key for the public `/order` catalog (synced from Orders → Event menu). */
  publicMenuKey?: string
  publicMenuLabel?: string
  /** Per-stall guest bindings so two same-day events keep separate `/order?event=` menus. */
  eventOrderLinks?: Record<string, EventOrderLink>
  eventMenus?: Record<string, MenuItem[]>
  eventPrices?: Record<string, Record<string, { price?: number; priceWithChai?: number; priceWithLassi?: number }>>
  eventTypeHiddenMenu?: Record<string, string[]>
}

type MenuItemPatch = Partial<
  Pick<
    MenuItem,
    | 'name'
    | 'nameDe'
    | 'contents'
    | 'contentsDe'
    | 'description'
    | 'descriptionDe'
    | 'ingredients'
    | 'ingredientsDe'
    | 'vegan'
    | 'vegetarian'
    | 'glutenFree'
    | 'imageUrl'
    | 'price'
    | 'priceWithChai'
    | 'priceWithLassi'
    | 'kind'
    | 'publicSection'
    | 'hideFromCustomer'
  >
>

/** Append-only public catalog edits (patches + order + custom dishes). */
type PublicMenuBag = {
  /** Event-type key this bag belongs to (Gourmet / Flohmarkt / …). */
  menuKey?: string
  items: Record<string, MenuItemPatch>
  order?: string[]
  extras?: MenuItem[]
  removed?: string[]
  updatedAt?: string
}

function emptyMenuBag(): PublicMenuBag {
  return { items: {} }
}

function normMenuKey(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Legacy unscoped bags were Gourmet edits — only apply them to Gourmet. */
function isLegacyGourmetKey(want: string): boolean {
  return want === 'gourmet' || want === 'gourmet festival'
}

function sectionToKind(section: PublicSection | undefined): 'single' | 'combo' {
  return section === 'combos' ? 'combo' : 'single'
}

function normalizeSection(raw: unknown): PublicSection | undefined {
  const s = String(raw || '').trim()
  if (s === 'combos' || s === 'mains' || s === 'snacks' || s === 'drinks') return s
  return undefined
}

const CLAIM_TTL_MS = 30 * 60 * 1000

/** Fallback when cloud stall_ops has no catalog yet (mirrors app DEFAULT_MENU). */
const DEFAULT_PUBLIC_MENU: MenuItem[] = [
  {
    id: 'combo-1',
    name: 'Combo Pack 1',
    nameDe: 'Kombi-Paket 1',
    kind: 'combo',
    price: 14,
    priceWithChai: 14,
    priceWithLassi: 15,
    contents: 'Masala dosa + Blumenkohl 65 + drink (chai or lassi)',
    contentsDe: 'Masala Dosa + Blumenkohl 65 + Getränk (Chai oder Lassi)',
    description:
      'One main — crispy masala dosa — plus Blumenkohl 65 and your choice of Masala chai or Mango lassi.',
    descriptionDe:
      'Ein Hauptgericht — knusprige Masala Dosa — plus Blumenkohl 65 und Masala Chai oder Mango-Lassi.',
    ingredients:
      'Masala dosa (rice & urad dal, potato masala), Blumenkohl 65 (cauliflower, Indian flour, spices), drink',
    ingredientsDe:
      'Masala Dosa (Reis & Urad-Dal, Kartoffelmasala), Blumenkohl 65 (Blumenkohl, indisches Mehl, Gewürze), Getränk',
    vegan: true,
    vegetarian: true,
    glutenFree: false,
  },
  {
    id: 'combo-2',
    name: 'Combo Pack 2',
    nameDe: 'Kombi-Paket 2',
    kind: 'combo',
    price: 15,
    priceWithChai: 15,
    priceWithLassi: 16,
    contents: 'Cheese masala dosa + Blumenkohl 65 + drink (chai or lassi)',
    contentsDe: 'Käse-Masala-Dosa + Blumenkohl 65 + Getränk (Chai oder Lassi)',
    description:
      'One main — cheese masala dosa — plus Blumenkohl 65 and your choice of Masala chai or Mango lassi.',
    descriptionDe:
      'Ein Hauptgericht — Käse-Masala-Dosa — plus Blumenkohl 65 und Masala Chai oder Mango-Lassi.',
    ingredients:
      'Cheese masala dosa (rice & urad dal, potato masala, cheese), Blumenkohl 65, drink',
    ingredientsDe:
      'Käse-Masala-Dosa (Reis & Urad-Dal, Kartoffelmasala, Käse), Blumenkohl 65, Getränk',
    vegan: false,
    vegetarian: true,
    glutenFree: false,
  },
  {
    id: 'combo-3',
    name: 'Combo Pack 3',
    nameDe: 'Kombi-Paket 3',
    kind: 'combo',
    price: 14,
    priceWithChai: 14,
    priceWithLassi: 15,
    contents: 'Sambar idli + Blumenkohl 65 + drink (chai or lassi)',
    contentsDe: 'Sambar Idli + Blumenkohl 65 + Getränk (Chai oder Lassi)',
    description:
      'One main — sambar idli — plus Blumenkohl 65 and your choice of Masala chai or Mango lassi.',
    descriptionDe:
      'Ein Hauptgericht — Sambar Idli — plus Blumenkohl 65 und Masala Chai oder Mango-Lassi.',
    ingredients:
      'Sambar idli (idli batter, sambar), Blumenkohl 65 (cauliflower, Indian flour, spices), drink',
    ingredientsDe:
      'Sambar Idli (Idli-Teig, Sambar), Blumenkohl 65 (Blumenkohl, indisches Mehl, Gewürze), Getränk',
    vegan: true,
    vegetarian: true,
    glutenFree: false,
  },
  {
    id: 'masala-dosa',
    name: 'Ghee Masala dosa',
    nameDe: 'Ghee Masala Dosa',
    kind: 'single',
    price: 8,
    description:
      'A traditional South Indian golden crispy dosa filled with a flavorful spiced potato masala.',
    descriptionDe:
      'Traditionelle südindische goldene knusprige Dosa mit würzigem Kartoffelmasala.',
    ingredients:
      'Rice & urad dal batter, potato, onion, mustard seeds, curry leaves, turmeric, ghee',
    ingredientsDe:
      'Reis- & Urad-Dal-Teig, Kartoffel, Zwiebel, Senfsamen, Curryblätter, Kurkuma, Ghee',
    vegan: false,
    vegetarian: true,
    glutenFree: true,
  },
  {
    id: 'cheese-masala-dosa',
    name: 'Cheese masala dosa',
    nameDe: 'Käse-Masala-Dosa',
    kind: 'single',
    price: 9,
    description: 'Crispy dosa with creamy melted cheese and spiced potato masala.',
    descriptionDe: 'Knusprige Dosa mit geschmolzenem Käse und würzigem Kartoffelmasala.',
    ingredients: 'Rice & urad dal batter, potato masala, cheese',
    ingredientsDe: 'Reis- & Urad-Dal-Teig, Kartoffelmasala, Käse',
    vegan: false,
    vegetarian: true,
    glutenFree: true,
  },
  {
    id: 'plain-dosa',
    name: 'Plain dosa',
    nameDe: 'Plain Dosa',
    kind: 'single',
    price: 7,
    description: 'Thin, golden crispy dosa — light on its own or with chutney and sambar.',
    descriptionDe: 'Dünne, goldene knusprige Dosa — leicht allein oder mit Chutney und Sambar.',
    ingredients: 'Rice & urad dal batter, salt, oil',
    ingredientsDe: 'Reis- & Urad-Dal-Teig, Salz, Öl',
    vegan: true,
    vegetarian: true,
    glutenFree: true,
  },
  {
    id: 'sambar-idli',
    name: 'Sambar idli',
    nameDe: 'Sambar Idli',
    kind: 'single',
    price: 8,
    description: 'Soft idlis soaked in flavorful vegetable sambar.',
    descriptionDe: 'Weiche Idlis in aromatischem Gemüse-Sambar.',
    ingredients: 'Idli batter, toor dal, tamarind, vegetables, sambar spices',
    ingredientsDe: 'Idli-Teig, Toor Dal, Tamarinde, Gemüse, Sambar-Gewürze',
    vegan: true,
    vegetarian: true,
    glutenFree: true,
  },
  {
    id: 'gobi-65',
    name: 'Gobi 65',
    nameDe: 'Gobi 65',
    kind: 'single',
    price: 4.5,
    description: 'Crispy cauliflower florets marinated in a bold South Indian spice blend.',
    descriptionDe: 'Knusprige Blumenkohlröschen in kräftiger südindischer Marinade.',
    ingredients: 'Cauliflower, Indian flour, chili, garlic, ginger, curry leaves, spices',
    ingredientsDe: 'Blumenkohl, indisches Mehl, Chili, Knoblauch, Ingwer, Curryblätter, Gewürze',
    vegan: true,
    vegetarian: true,
    glutenFree: false,
    publicSection: 'snacks',
  },
  {
    id: 'medu-vada',
    name: 'Medu Vada',
    nameDe: 'Medu Vada',
    kind: 'single',
    price: 3,
    contents: '2 Pieces',
    contentsDe: '2 Stück',
    description: 'Crispy outside, soft inside — classic South Indian lentil fritters (2 pieces).',
    descriptionDe: 'Außen knusprig, innen weich — klassische südindische Linsenpuffer (2 Stück).',
    ingredients: 'Urad dal, onion, chili, curry leaves, oil',
    ingredientsDe: 'Urad Dal, Zwiebel, Chili, Curryblätter, Öl',
    vegan: true,
    vegetarian: true,
    glutenFree: true,
    publicSection: 'snacks',
  },
  {
    id: 'masala-chai',
    name: 'Masala chai',
    nameDe: 'Masala Chai',
    kind: 'single',
    price: 2,
    contents: 'Traditional Indian Spiced Tea',
    description: 'Freshly brewed Indian tea infused with a fragrant blend of spices.',
    descriptionDe: 'Frisch gebrühter indischer Tee mit aromatischen Gewürzen.',
    ingredients: 'Black tea, milk, ginger, cardamom, cloves, sugar',
    ingredientsDe: 'Schwarzer Tee, Milch, Ingwer, Kardamom, Nelken, Zucker',
    vegan: false,
    vegetarian: true,
    glutenFree: true,
    publicSection: 'drinks',
  },
  {
    id: 'mango-lassi',
    name: 'Mango lassi',
    nameDe: 'Mango-Lassi',
    kind: 'single',
    price: 3.5,
    description: 'Cool yogurt drink blended with sweet mango.',
    descriptionDe: 'Kühler Joghurt-Drink mit süßer Mango.',
    ingredients: 'Yogurt, mango pulp, sugar, cardamom',
    ingredientsDe: 'Joghurt, Mangopüree, Zucker, Kardamom',
    vegan: false,
    vegetarian: true,
    glutenFree: true,
    publicSection: 'drinks',
  },
]

const DEFAULT_BY_ID = new Map(DEFAULT_PUBLIC_MENU.map((m) => [m.id, m]))

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

function filterDeletedOrders(ops: StallOps): StallOps {
  const deleted = new Set(
    (Array.isArray(ops.deletedOrderIds) ? ops.deletedOrderIds : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean),
  )
  if (!deleted.size || !Array.isArray(ops.orders)) return ops
  return {
    ...ops,
    orders: ops.orders.filter((o) => !deleted.has(String(o.id || '').trim())),
  }
}

async function loadStallOps(key: string): Promise<StallOps> {
  const got = await sbFetch('team_extras?id=eq.latest&select=stall_ops', key)
  if (!got.ok) return {}
  const rows = Array.isArray(got.data) ? got.data : []
  const raw = ((rows[0] as { stall_ops?: StallOps } | undefined)?.stall_ops ||
    {}) as StallOps
  return filterDeletedOrders(raw)
}

function asStallOps(raw: Record<string, unknown>): StallOps {
  return filterDeletedOrders(raw as StallOps)
}

/**
 * Preview/customer menu edits persist here — `team_extras` updates are often blocked by RLS
 * when only the anon key is configured on Vercel (same pattern as site-config).
 * One stable row per menu key (not a growing history) — old `__pmenu_ov_*` timestamp dumps
 * were ~285KB×50 and blew Supabase egress on every /order load.
 */
const PUBLIC_MENU_OVERRIDES_ID = '__public_menu_overrides__'
const PUBLIC_MENU_OVERRIDES_PREFIX = '__pmenu_ov_'
const PUBLIC_MENU_KEYED_PREFIX = '__pmenu_k_'

function overrideRowIdForMenuKey(menuKey?: string): string {
  const k = normMenuKey(menuKey) || 'default'
  const slug =
    k
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'default'
  return `${PUBLIC_MENU_KEYED_PREFIX}${slug}`
}

function normalizeMenuBag(raw: unknown): PublicMenuBag {
  if (!raw || typeof raw !== 'object') return emptyMenuBag()
  const p = raw as PublicMenuBag & Record<string, unknown>
  const items =
    p.items && typeof p.items === 'object' && !Array.isArray(p.items)
      ? (p.items as Record<string, MenuItemPatch>)
      : {}
  const order = Array.isArray(p.order)
    ? p.order.map((x) => String(x || '').trim()).filter(Boolean)
    : undefined
  const removed = Array.isArray(p.removed)
    ? p.removed.map((x) => String(x || '').trim()).filter(Boolean)
    : undefined
  const extras = Array.isArray(p.extras)
    ? p.extras
        .filter((m) => m && typeof m === 'object' && (m as MenuItem).id)
        .map((m) => {
          const row = m as MenuItem
          const section = normalizeSection(row.publicSection)
          return {
            ...row,
            id: String(row.id),
            name: String(row.name || row.id),
            kind: row.kind === 'combo' || section === 'combos' ? 'combo' : 'single',
            price: Math.max(0, Number(row.price) || 0),
            publicSection: section,
          } as MenuItem
        })
    : undefined
  const menuKey = String(p.menuKey || '').trim() || undefined
  return {
    menuKey,
    items,
    order,
    extras,
    removed,
    updatedAt: String(p.updatedAt || '') || undefined,
  }
}

function bagMatchesMenuKey(bag: PublicMenuBag, menuKey?: string): boolean {
  const want = normMenuKey(menuKey)
  if (!want) return true
  const bagKey = normMenuKey(bag.menuKey)
  if (bagKey) return bagKey === want
  // Unscoped legacy rows only apply to Gourmet (that’s what was edited historically).
  return isLegacyGourmetKey(want)
}

async function loadPublicMenuBag(key: string, menuKey?: string): Promise<PublicMenuBag> {
  const stableId = overrideRowIdForMenuKey(menuKey)
  const keyed = await sbFetch(
    `customer_reviews?id=eq.${encodeURIComponent(stableId)}&select=payload`,
    key,
  )
  if (keyed.ok && Array.isArray(keyed.data) && keyed.data.length) {
    const bag = normalizeMenuBag((keyed.data[0] as { payload?: unknown }).payload)
    if (bagMatchesMenuKey(bag, menuKey)) return bag
  }

  const legacy = await sbFetch(
    `customer_reviews?id=eq.${encodeURIComponent(PUBLIC_MENU_OVERRIDES_ID)}&select=payload`,
    key,
  )
  if (legacy.ok && Array.isArray(legacy.data) && legacy.data.length) {
    const bag = normalizeMenuBag((legacy.data[0] as { payload?: unknown }).payload)
    if (bagMatchesMenuKey(bag, menuKey)) return bag
  }

  // Legacy timestamp history — keep tiny limit (was 40 × ~285KB ≈ 11MB egress per /order).
  const latest = await sbFetch(
    `customer_reviews?id=like.${PUBLIC_MENU_OVERRIDES_PREFIX}*&select=payload,created_at&order=created_at.desc&limit=3`,
    key,
  )
  if (latest.ok && Array.isArray(latest.data) && latest.data.length) {
    for (const row of latest.data) {
      const bag = normalizeMenuBag((row as { payload?: unknown }).payload)
      if (bagMatchesMenuKey(bag, menuKey)) return bag
    }
    if (normMenuKey(menuKey)) return emptyMenuBag()
    return normalizeMenuBag((latest.data[0] as { payload?: unknown }).payload)
  }
  return emptyMenuBag()
}

async function savePublicMenuBag(
  key: string,
  bag: PublicMenuBag,
  menuKey?: string,
): Promise<{ ok: boolean; error?: string }> {
  const scopedKey = String(menuKey || bag.menuKey || '').trim() || undefined
  const payload: PublicMenuBag = {
    ...normalizeMenuBag(bag),
    menuKey: scopedKey,
    updatedAt: new Date().toISOString(),
  }
  const id = overrideRowIdForMenuKey(scopedKey)
  // Prefer replace-in-place so history does not grow. Anon RLS may block UPDATE —
  // delete+insert works when DELETE is allowed; else plain insert of stable id.
  await sbFetch(`customer_reviews?id=eq.${encodeURIComponent(id)}`, key, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
  const inserted = await sbFetch('customer_reviews', key, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      id,
      created_at: new Date().toISOString(),
      payload,
    }),
  })
  if (!inserted.ok) return { ok: false, error: inserted.error }
  if (!Array.isArray(inserted.data) || !inserted.data.length) {
    return { ok: false, error: 'Override save returned no row (check RLS on customer_reviews).' }
  }
  return { ok: true }
}

function applyPublicMenuBag(menu: MenuItem[], bag: PublicMenuBag): MenuItem[] {
  const byId = new Map<string, MenuItem>()
  for (const m of menu) {
    if (m?.id) byId.set(m.id, m)
  }
  for (const ex of bag.extras || []) {
    if (!ex?.id) continue
    byId.set(ex.id, { ...(byId.get(ex.id) || ex), ...ex })
  }
  const removed = new Set(bag.removed || [])
  let list = [...byId.values()].filter(
    (m) => m && m.id && !removed.has(m.id) && !m.hidden && !m.hideFromCustomer,
  )
  list = list.map((m) => {
    const ov = bag.items?.[m.id]
    if (!ov) return m
    const next = applyMenuItemPatch(m, ov)
    const section = normalizeSection(ov.publicSection ?? next.publicSection)
    if (section) {
      next.publicSection = section
      next.kind = sectionToKind(section)
    }
    if (ov.hideFromCustomer) return { ...next, hideFromCustomer: true }
    return next
  })
  list = list.filter((m) => !m.hideFromCustomer)
  if (bag.order?.length) {
    const rank = new Map(bag.order.map((id, i) => [id, i]))
    list.sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : 10_000
      const rb = rank.has(b.id) ? rank.get(b.id)! : 10_000
      return ra - rb || a.name.localeCompare(b.name)
    })
  }
  return list
}

/** Combos are always: 1 main + Blumenkohl 65 + drink — keep copy locked. */
/** Drop duplicate dishes (e.g. Medu Vada as both `medu-vada` and `custom-…`). */
function dedupePublicMenu(menu: MenuItem[]): MenuItem[] {
  const seen = new Map<string, MenuItem>()
  const order: string[] = []
  for (const m of menu) {
    if (!m?.id) continue
    const key = String(m.name || m.id)
      .trim()
      .toLowerCase()
    if (!key) continue
    const prev = seen.get(key)
    if (!prev) {
      seen.set(key, m)
      order.push(key)
      continue
    }
    // Prefer custom extras / explicit snacks over seeded defaults.
    const prefer =
      (m.id.startsWith('custom-') && !prev.id.startsWith('custom-')) ||
      (m.publicSection === 'snacks' && prev.publicSection !== 'snacks')
        ? m
        : prev
    seen.set(key, prefer)
  }
  return order.map((k) => seen.get(k)!).filter(Boolean)
}

function forceComboPublicCopy(menu: MenuItem[]): MenuItem[] {
  return menu.map((m) => {
    const def = DEFAULT_BY_ID.get(m.id)
    if (!def || (m.id !== 'combo-1' && m.id !== 'combo-2' && m.id !== 'combo-3')) {
      return m
    }
    return {
      ...m,
      contents: def.contents,
      contentsDe: def.contentsDe,
      description: def.description,
      descriptionDe: def.descriptionDe,
      ingredients: def.ingredients,
      ingredientsDe: def.ingredientsDe,
      glutenFree: false,
    }
  })
}

function cleanMenuPatch(patch: MenuItemPatch): MenuItemPatch {
  const out: MenuItemPatch = {}
  if (patch.name != null) out.name = String(patch.name)
  if (patch.nameDe != null) out.nameDe = String(patch.nameDe)
  if (patch.contents != null) out.contents = String(patch.contents)
  if (patch.contentsDe != null) out.contentsDe = String(patch.contentsDe)
  if (patch.description != null) out.description = String(patch.description)
  if (patch.descriptionDe != null) out.descriptionDe = String(patch.descriptionDe)
  if (patch.ingredients != null) out.ingredients = String(patch.ingredients)
  if (patch.ingredientsDe != null) out.ingredientsDe = String(patch.ingredientsDe)
  if (patch.vegan != null) out.vegan = Boolean(patch.vegan)
  if (patch.vegetarian != null) out.vegetarian = Boolean(patch.vegetarian)
  if (patch.glutenFree != null) out.glutenFree = Boolean(patch.glutenFree)
  if (patch.price != null) out.price = Math.max(0, Number(patch.price) || 0)
  if (patch.priceWithChai != null) {
    out.priceWithChai = Math.max(0, Number(patch.priceWithChai) || 0)
  }
  if (patch.priceWithLassi != null) {
    out.priceWithLassi = Math.max(0, Number(patch.priceWithLassi) || 0)
  }
  if (patch.imageUrl !== undefined) out.imageUrl = patch.imageUrl
  const section = normalizeSection(patch.publicSection)
  if (section) {
    out.publicSection = section
    out.kind = sectionToKind(section)
  } else if (patch.kind === 'combo' || patch.kind === 'single') {
    out.kind = patch.kind
  }
  if (patch.hideFromCustomer != null) out.hideFromCustomer = Boolean(patch.hideFromCustomer)
  return out
}

function prune(orders: StallOrder[]): StallOrder[] {
  const now = Date.now()
  return (orders || []).filter((o) => {
    if (o.status !== 'awaiting_claim') return true
    const t = new Date(o.createdAt).getTime()
    return Number.isFinite(t) && now - t <= CLAIM_TTL_MS
  })
}

function visibleMenu(list: MenuItem[] | undefined): MenuItem[] {
  if (!Array.isArray(list) || !list.length) return []
  return list.filter((m) => m && m.id && m.name && !m.hidden && !m.hideFromCustomer)
}

function normKey(s: string | undefined | null): string {
  return String(s || '')
    .trim()
    .toLowerCase()
}

/** Case-insensitive lookup in event-type maps (Flohmarkt, Streetfood Festival, …). */
function pickTypeList(
  bag: Record<string, MenuItem[]> | undefined,
  key: string,
): MenuItem[] | undefined {
  if (!bag || !key) return undefined
  if (Array.isArray(bag[key]) && bag[key].length) return bag[key]
  const want = normKey(key)
  for (const [k, list] of Object.entries(bag)) {
    if (normKey(k) === want && Array.isArray(list) && list.length) return list
  }
  return undefined
}

function pickTypePrices(
  bag: StallOps['eventPrices'],
  key: string,
): Record<string, { price?: number; priceWithChai?: number; priceWithLassi?: number }> | undefined {
  if (!bag || !key) return undefined
  if (bag[key] && Object.keys(bag[key]).length) return bag[key]
  const want = normKey(key)
  for (const [k, v] of Object.entries(bag)) {
    if (normKey(k) === want && v && Object.keys(v).length) return v
  }
  return undefined
}

function pickHiddenIds(bag: StallOps['eventTypeHiddenMenu'], key: string): string[] {
  if (!bag || !key) return []
  if (Array.isArray(bag[key])) return bag[key]
  const want = normKey(key)
  for (const [k, v] of Object.entries(bag)) {
    if (normKey(k) === want && Array.isArray(v)) return v
  }
  return []
}

function applyTypePrices(
  list: MenuItem[],
  key: string,
  ops: StallOps,
): MenuItem[] {
  const hide = new Set(pickHiddenIds(ops.eventTypeHiddenMenu, key))
  const prices = pickTypePrices(ops.eventPrices, key) || {}
  const hasSaved = Boolean(pickTypeList(ops.eventMenus, key)?.length)
  return list
    .filter((m) => m && !hide.has(m.id))
    .map((m) => {
      if (hasSaved) return m
      const ov = prices[m.id]
      if (!ov) return m
      if (m.kind === 'combo') {
        const chai = ov.priceWithChai ?? m.priceWithChai ?? m.price
        const lassi = ov.priceWithLassi ?? m.priceWithLassi ?? m.price
        return { ...m, price: Number(chai) || 0, priceWithChai: chai, priceWithLassi: lassi }
      }
      return { ...m, price: Number(ov.price ?? m.price) || 0 }
    })
}

/** Prefer default copy when saved text still mentions coconut/yogurt or generic chutney. */
function pickMenuText(saved: string | undefined, def: string | undefined): string | undefined {
  const s = String(saved || '').trim()
  const d = String(def || '').trim()
  if (!d) return s || undefined
  if (!s) return d
  if (/coconut|kokos|yogurt|joghurt/i.test(s)) return d
  if (/\bchutney\b/i.test(s) && !/tomato|tomaten/i.test(s) && /tomato|tomaten/i.test(d)) {
    return d
  }
  return s
}

/** Dish photos live on base `menu` (Studio uploads) — event catalogs often omit them. */
function withBaseImages(list: MenuItem[], base: MenuItem[] | undefined): MenuItem[] {
  if (!Array.isArray(base) || !base.length) return list
  const byId = new Map(base.map((m) => [m.id, m]))
  return list.map((m) => {
    const fromBase = byId.get(m.id)?.imageUrl
    const img = String(fromBase || m.imageUrl || '').trim()
    if (!img || img === m.imageUrl) return m
    return { ...m, imageUrl: img }
  })
}

function serializePublicMenu(list: MenuItem[]): MenuItem[] {
  return list.map((m) => {
    const def = DEFAULT_BY_ID.get(m.id)
    const img = String(m.imageUrl || def?.imageUrl || '').trim()
    const imageUrl =
      img.startsWith('data:image/') || /^https?:\/\//i.test(img) ? img : undefined
    const forceVegan = m.id === 'gobi-65' || m.id === 'combo-3'
    /** Combos always include Blumenkohl 65 (Indian flour) — not gluten-free. */
    const forceNotGf =
      m.id === 'gobi-65' ||
      m.id === 'combo-1' ||
      m.id === 'combo-2' ||
      m.id === 'combo-3'
    const forceComboRecipe =
      m.id === 'combo-1' || m.id === 'combo-2' || m.id === 'combo-3'
    const snackIds = new Set(['gobi-65', 'medu-vada', 'custom-mrwgvuy8-k7m'])
    const drinkIds = new Set(['masala-chai', 'mango-lassi'])
    const vegan = forceVegan
      ? true
      : m.vegan === true || m.vegan === false
        ? m.vegan
        : Boolean(def?.vegan)
    const vegetarian = forceVegan
      ? true
      : m.vegetarian === true || m.vegetarian === false
        ? m.vegetarian
        : Boolean(def?.vegetarian)
    const glutenFree = forceNotGf
      ? false
      : m.glutenFree === true || m.glutenFree === false
        ? m.glutenFree
        : Boolean(def?.glutenFree)
    const section =
      normalizeSection(m.publicSection) ||
      (m.kind === 'combo' || forceComboRecipe
        ? 'combos'
        : snackIds.has(m.id)
          ? 'snacks'
          : drinkIds.has(m.id)
            ? 'drinks'
            : undefined)
    const kind =
      section === 'combos' || m.kind === 'combo' || forceComboRecipe ? 'combo' : 'single'
    return {
      id: m.id,
      name: m.name || def?.name || m.id,
      nameDe: (m.nameDe || def?.nameDe || '').trim() || undefined,
      kind,
      publicSection: section,
      price: Number(m.price) || 0,
      priceWithChai: m.priceWithChai,
      priceWithLassi: m.priceWithLassi,
      contents:
        forceComboRecipe && def?.contents
          ? def.contents
          : pickMenuText(m.contents, def?.contents),
      contentsDe:
        forceComboRecipe && def?.contentsDe
          ? def.contentsDe
          : pickMenuText(m.contentsDe, def?.contentsDe),
      description:
        forceComboRecipe && def?.description
          ? def.description
          : pickMenuText(m.description, def?.description),
      descriptionDe:
        forceComboRecipe && def?.descriptionDe
          ? def.descriptionDe
          : pickMenuText(m.descriptionDe, def?.descriptionDe),
      ingredients:
        (forceNotGf || forceComboRecipe) && def?.ingredients
          ? def.ingredients
          : pickMenuText(m.ingredients, def?.ingredients),
      ingredientsDe:
        (forceNotGf || forceComboRecipe) && def?.ingredientsDe
          ? def.ingredientsDe
          : pickMenuText(m.ingredientsDe, def?.ingredientsDe),
      imageUrl,
      soldOut: Boolean(m.soldOut),
      vegan,
      vegetarian,
      glutenFree,
    }
  })
}

async function resolvePublicCatalog(
  key: string,
  ops: StallOps,
  typeHint?: string,
  eventId?: string,
): Promise<{ menu: MenuItem[]; menuKey: string; menuLabel: string; eventId: string }> {
  const target = resolveGuestMenuTarget(ops, eventId, typeHint)
  const preferredKey = target.menuKey || typeHint || undefined
  const pub = publicMenu(ops, preferredKey, target.menuLabel || undefined)
  // Scope overrides by event type — never apply Gourmet edits onto Flohmarkt, etc.
  const bag = await loadPublicMenuBag(key, preferredKey || pub.menuKey || undefined)
  const menu = dedupePublicMenu(forceComboPublicCopy(applyPublicMenuBag(pub.menu, bag)))
  return {
    menu,
    menuKey: pub.menuKey,
    menuLabel: pub.menuLabel,
    eventId: target.eventId,
  }
}

/** Resolve catalog key + label for a guest stall (`?event=` + optional `?type=`). */
function resolveGuestMenuTarget(
  ops: StallOps,
  eventId?: string,
  typeHint?: string,
): { menuKey: string; menuLabel: string; eventId: string } {
  const eid = String(eventId || '').trim()
  const type = String(typeHint || '').trim()
  const link = eid && ops.eventOrderLinks ? ops.eventOrderLinks[eid] : undefined
  const menuKey = String(
    link?.menuKey || type || (eid && ops.activeEventId === eid ? ops.publicMenuKey : '') || ops.publicMenuKey || '',
  ).trim()
  const menuLabel = String(
    link?.label ||
      (eid && ops.activeEventId === eid ? ops.publicMenuLabel : '') ||
      ops.publicMenuLabel ||
      menuKey ||
      eid ||
      '',
  ).trim()
  return { menuKey, menuLabel, eventId: eid }
}

/**
 * Public `/order` catalog — same event-type menu as Orders → New order.
 * Prefer stall binding / `?type=` / `publicMenuKey`, then longest fallback.
 */
function publicMenu(
  ops: StallOps,
  preferredKey?: string,
  preferredLabel?: string,
): { menu: MenuItem[]; menuKey: string; menuLabel: string } {
  const key = String(preferredKey || ops.publicMenuKey || '').trim()
  const label = String(preferredLabel || ops.publicMenuLabel || '').trim()

  if (key) {
    const saved = pickTypeList(ops.eventMenus, key)
    const base = saved?.length ? saved : Array.isArray(ops.menu) ? ops.menu : []
    const priced = withBaseImages(applyTypePrices(base, key, ops), ops.menu)
    let vis = visibleMenu(priced)
    if (!vis.length && saved?.length) {
      vis = visibleMenu(withBaseImages(saved, ops.menu))
    }
    if (vis.length) {
      return {
        menu: serializePublicMenu(vis),
        menuKey: key,
        menuLabel: label || key,
      }
    }
  }

  // Fallback: longest saved event menu (legacy / no stall selected yet)
  const candidates: { key: string; list: MenuItem[] }[] = []
  if (ops.eventMenus && typeof ops.eventMenus === 'object') {
    for (const [k, list] of Object.entries(ops.eventMenus)) {
      if (Array.isArray(list) && list.length) candidates.push({ key: k, list })
    }
    candidates.sort((a, b) => b.list.length - a.list.length)
  }
  for (const c of candidates) {
    const vis = visibleMenu(
      withBaseImages(applyTypePrices(c.list, c.key, ops), ops.menu),
    )
    if (vis.length) {
      return {
        menu: serializePublicMenu(vis),
        menuKey: c.key,
        menuLabel: label || c.key,
      }
    }
  }

  let best = visibleMenu(ops.menu)
  if (!best.length) best = visibleMenu(DEFAULT_PUBLIC_MENU)
  return {
    menu: serializePublicMenu(best),
    menuKey: key || '',
    menuLabel: label || (key ? key : 'Menu'),
  }
}

function linePrice(item: MenuItem, drink?: DrinkChoice): number {
  if (item.kind === 'combo') {
    if (drink === 'lassi') return Number(item.priceWithLassi ?? item.price) || 0
    return Number(item.priceWithChai ?? item.price) || 0
  }
  return Number(item.price) || 0
}

function makeLines(
  menu: MenuItem[],
  raw: { menuItemId: string; qty: number; drink?: DrinkChoice }[],
): OrderLine[] | null {
  const byId = new Map(menu.map((m) => [m.id, m]))
  const lines: OrderLine[] = []
  for (const row of raw.slice(0, 20)) {
    const item = byId.get(String(row.menuItemId || ''))
    const qty = Math.min(20, Math.max(0, Math.round(Number(row.qty) || 0)))
    if (!item || item.soldOut || qty <= 0) continue
    let drink: DrinkChoice | undefined
    let name = item.name
    if (item.kind === 'combo') {
      drink = row.drink === 'lassi' ? 'lassi' : 'chai'
      name = `${item.name} · ${drink === 'chai' ? 'Masala chai' : 'Mango lassi'}`
    }
    lines.push({
      menuItemId: item.id,
      name,
      price: linePrice(item, drink),
      qty,
      drink,
    })
  }
  return lines.length ? lines : null
}

function genCode(orders: StallOrder[], eventId?: string): string {
  const scope = String(eventId || '').trim()
  const used = new Set(
    orders
      .filter((o) => {
        if (o.status !== 'awaiting_claim' || !o.claimCode) return false
        if (!scope) return true
        return String(o.eventId || '').trim() === scope
      })
      .map((o) => o.claimCode!),
  )
  for (let i = 0; i < 40; i++) {
    const code = String(1000 + Math.floor(Math.random() * 9000))
    if (!used.has(code)) return code
  }
  return String(Date.now() % 9000).padStart(4, '0')
}

function queueInfo(orders: StallOrder[], order: StallOrder) {
  if (order.status === 'awaiting_claim') {
    return { status: order.status, ahead: null as number | null, ticket: null as string | null }
  }
  if (order.status === 'completed') {
    return { status: order.status, ahead: 0, ticket: order.label }
  }
  const scope = String(order.eventId || '').trim()
  const pending = orders
    .filter((o) => {
      if (o.status !== 'pending' || o.voided) return false
      if (!scope) return true
      return String(o.eventId || '').trim() === scope
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const idx = pending.findIndex((o) => o.id === order.id)
  return {
    status: order.status,
    ahead: idx < 0 ? null : idx,
    ticket: order.label,
  }
}

function nextCustomerNumber(orders: StallOrder[], eventId?: string): number {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })
  const scope = String(eventId || '').trim()
  let max = 0
  for (const o of orders) {
    if (scope && String(o.eventId || '').trim() !== scope) continue
    const day = new Date(o.createdAt).toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })
    if (day !== today) continue
    const m = /^Customer\s+(\d+)$/i.exec((o.label || '').trim())
    if (m) max = Math.max(max, Number(m[1]) || 0)
  }
  return max + 1
}

function applyMenuItemPatch(m: MenuItem, patch: MenuItemPatch): MenuItem {
  const next: MenuItem = { ...m, id: m.id, kind: m.kind }
  if (patch.name != null) next.name = String(patch.name).trim() || m.name
  if (patch.nameDe != null) next.nameDe = String(patch.nameDe).trim() || undefined
  if (patch.contents != null) next.contents = String(patch.contents).trim() || undefined
  if (patch.contentsDe != null) {
    next.contentsDe = String(patch.contentsDe).trim() || undefined
  }
  if (patch.description != null) {
    next.description = String(patch.description).trim() || undefined
  }
  if (patch.descriptionDe != null) {
    next.descriptionDe = String(patch.descriptionDe).trim() || undefined
  }
  if (patch.ingredients != null) {
    next.ingredients = String(patch.ingredients).trim() || undefined
  }
  if (patch.ingredientsDe != null) {
    next.ingredientsDe = String(patch.ingredientsDe).trim() || undefined
  }
  if (patch.vegan != null) next.vegan = Boolean(patch.vegan)
  if (patch.vegetarian != null) next.vegetarian = Boolean(patch.vegetarian)
  if (patch.glutenFree != null) next.glutenFree = Boolean(patch.glutenFree)
  if (patch.price != null) next.price = Math.max(0, Number(patch.price) || 0)
  if (patch.priceWithChai != null) {
    next.priceWithChai = Math.max(0, Number(patch.priceWithChai) || 0)
  }
  if (patch.priceWithLassi != null) {
    next.priceWithLassi = Math.max(0, Number(patch.priceWithLassi) || 0)
  }
  if (patch.imageUrl !== undefined) {
    const img = String(patch.imageUrl || '').trim()
    next.imageUrl =
      !img
        ? undefined
        : img.startsWith('data:image/') || /^https?:\/\//i.test(img)
          ? img
          : m.imageUrl
  }
  const section = normalizeSection(patch.publicSection)
  if (section) {
    next.publicSection = section
    next.kind = sectionToKind(section)
  } else if (patch.kind === 'combo' || patch.kind === 'single') {
    next.kind = patch.kind
  }
  if (patch.hideFromCustomer != null) next.hideFromCustomer = Boolean(patch.hideFromCustomer)
  return next
}

/** Ensure cloud has a writable catalog (API otherwise falls back to hardcoded defaults). */
function ensureWritableMenu(ops: StallOps): MenuItem[] {
  const raw = Array.isArray(ops.menu) ? ops.menu.filter((m) => m && m.id) : []
  if (!raw.length) return DEFAULT_PUBLIC_MENU.map((m) => ({ ...m }))
  const byId = new Map(raw.map((m) => [m.id, m]))
  for (const d of DEFAULT_PUBLIC_MENU) {
    if (!byId.has(d.id)) byId.set(d.id, { ...d })
  }
  const ordered: MenuItem[] = []
  const seen = new Set<string>()
  for (const m of raw) {
    if (seen.has(m.id)) continue
    ordered.push(byId.get(m.id) || m)
    seen.add(m.id)
  }
  for (const d of DEFAULT_PUBLIC_MENU) {
    if (seen.has(d.id)) continue
    ordered.push(byId.get(d.id)!)
    seen.add(d.id)
  }
  return ordered
}

function patchMenuInStallOps(
  ops: StallOps,
  id: string,
  patch: MenuItemPatch,
  scopeKey?: string,
): StallOps {
  const touchesPrice =
    patch.price != null || patch.priceWithChai != null || patch.priceWithLassi != null
  let menu = ensureWritableMenu(ops)
  if (!touchesPrice) {
    if (!menu.some((m) => m.id === id)) {
      const def = DEFAULT_BY_ID.get(id)
      if (!def) throw new Error(`Unknown menu item: ${id}`)
      menu = [...menu, { ...def }]
    }
    menu = menu.map((m) => (m.id === id ? applyMenuItemPatch(m, patch) : m))
  }

  const eventMenus: NonNullable<StallOps['eventMenus']> = { ...(ops.eventMenus || {}) }
  const scopeKeys = eventKeysForMenuPatch(scopeKey)
  if (scopeKeys.length) {
    for (const key of scopeKeys) {
      const list = eventMenus[key]
      if (!Array.isArray(list) || !list.length) continue
      if (!list.some((m) => m.id === id)) continue
      eventMenus[key] = list.map((m) => (m.id === id ? applyMenuItemPatch(m, patch) : m))
    }
  }

  const eventPrices: NonNullable<StallOps['eventPrices']> = { ...(ops.eventPrices || {}) }
  if (touchesPrice) {
    for (const key of scopeKeys) {
      if (!key) continue
      const bag = { ...(eventPrices[key] || {}) }
      const prev = bag[id] || {}
      bag[id] = {
        ...prev,
        ...(patch.price != null ? { price: Math.max(0, Number(patch.price) || 0) } : {}),
        ...(patch.priceWithChai != null
          ? { priceWithChai: Math.max(0, Number(patch.priceWithChai) || 0) }
          : {}),
        ...(patch.priceWithLassi != null
          ? { priceWithLassi: Math.max(0, Number(patch.priceWithLassi) || 0) }
          : {}),
      }
      eventPrices[key] = bag
    }
  }

  return { ...ops, menu, eventMenus, eventPrices }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', TEAM_API_CORS_HEADERS)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const { url, anon, service } = supabaseEnv()
  const key = service || anon
  if (!url || !key) {
    return json(res, 503, { error: 'Ordering is not available (cloud not configured).' })
  }

  if (req.method === 'GET') {
    const code = String(req.query.code || '')
      .replace(/\D/g, '')
      .slice(0, 4)
    const ops = await loadStallOps(key)
    const orders = prune(Array.isArray(ops.orders) ? ops.orders : [])
    const eventHint = String(req.query?.event || '').trim()
    if (code.length === 4) {
      let order = orders.find((o) => {
        if (o.claimCode !== code || o.voided) return false
        if (!eventHint) return true
        const oe = String(o.eventId || '').trim()
        return !oe || oe === eventHint
      })
      // Fresh tickets can be polled before event query matches — fall back to code-only.
      if (!order) {
        order = orders.find((o) => o.claimCode === code && !o.voided)
      }
      if (!order) {
        return json(res, 404, {
          error: 'Order not found. If you just placed it, wait a moment and refresh.',
        })
      }
      const q = queueInfo(orders, order)
      return json(res, 200, {
        order: {
          id: order.id,
          claimCode: order.claimCode,
          eventId: order.eventId || '',
          lines: order.lines,
          customerName: order.customerName,
          createdAt: order.createdAt,
          ...q,
        },
      })
    }
    const typeHint = String(req.query?.type || '').trim()
    const { menu, menuKey, menuLabel, eventId } = await resolvePublicCatalog(
      key,
      ops,
      typeHint || undefined,
      eventHint || undefined,
    )
    const scope = eventId || eventHint
    const pendingCount = orders.filter((o) => {
      if (o.status !== 'pending' || o.voided) return false
      if (!scope) return true
      return String(o.eventId || '').trim() === scope
    }).length
    return json(res, 200, {
      menu,
      menuKey,
      menuLabel,
      eventId: eventHint || '',
      activeEventId: '',
      pendingCount,
    })
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as {
      action?: string
      lines?: { menuItemId: string; qty: number; drink?: DrinkChoice }[]
      customerName?: string
      code?: string
      eventId?: string
      menuKey?: string
      menuItemId?: string
      patch?: MenuItemPatch
      order?: string[]
      item?: Partial<MenuItem> & { publicSection?: PublicSection }
    }
    const action = body.action || 'place'

    if (action === 'claim') {
      const caller = await readCaller(req)
      if (!caller) return json(res, 401, { error: 'Team login required to claim.' })
      const code = String(body.code || '')
        .replace(/\D/g, '')
        .slice(0, 4)
      if (code.length !== 4) return json(res, 400, { error: 'Enter a 4-digit code.' })
      const scope = String(body.eventId || '').trim()
      const saved = await saveStallOpsMutate(url, key, (raw) => {
        const ops = asStallOps(raw)
        let orders = prune(Array.isArray(ops.orders) ? ops.orders : [])
        let hit = orders.find((o) => {
          if (o.status !== 'awaiting_claim' || o.claimCode !== code || o.voided) return false
          if (!scope) return true
          return String(o.eventId || '').trim() === scope
        })
        if (!hit) {
          const anyWaiting = orders.filter(
            (o) => o.status === 'awaiting_claim' && o.claimCode === code && !o.voided,
          )
          if (!scope && anyWaiting.length === 1) hit = anyWaiting[0]
          else if (scope && anyWaiting.length > 0) {
            const other = anyWaiting.find((o) => String(o.eventId || '').trim() !== scope)
            const otherId = String(other?.eventId || '').trim()
            throw new MutateAbort(
              404,
              otherId
                ? `This code is for stall ${otherId}. Switch Event menu to ${otherId}, then claim.`
                : 'Code not found for this stall. Pick the correct Event menu, or ask the guest to place again.',
            )
          }
        }
        if (!hit) {
          const already = orders.find(
            (o) =>
              o.claimCode === code &&
              !o.voided &&
              (o.status === 'pending' || o.status === 'completed') &&
              (!scope || String(o.eventId || '').trim() === scope),
          )
          if (already) {
            return { ops, value: already }
          }
          throw new MutateAbort(
            404,
            scope
              ? 'Code not found for this stall. Check Event menu or ask guest to place again.'
              : 'Code not found. Ask guest to place again (expires after 30 minutes).',
          )
        }
        const claimEventId = String(hit.eventId || scope || '').trim() || undefined
        const n = nextCustomerNumber(orders, claimEventId)
        const now = new Date().toISOString()
        const claimed: StallOrder = {
          ...hit,
          status: 'pending',
          label: `Customer ${n}`,
          claimedAt: now,
          updatedAt: now,
          eventId: claimEventId || hit.eventId,
        }
        orders = orders.map((o) => (o.id === hit!.id ? claimed : o))
        return { ops: { ...ops, orders }, value: claimed }
      })
      if (saved.ok === false) {
        return json(res, saved.status || 500, { error: saved.error || 'Could not claim order' })
      }
      return json(res, 200, { ok: true, order: saved.value })
    }

    if (
      action === 'patchMenuItem' ||
      action === 'reorderMenu' ||
      action === 'addMenuItem' ||
      action === 'removeMenuItem'
    ) {
      const caller = await readCaller(req)
      if (!caller) {
        return json(res, 401, { error: 'Team login required to edit the customer menu.' })
      }
      const writeKey = service || anon
      const typeHint = String(req.query?.type || body.menuKey || '').trim()
      try {
        const opsNow = await loadStallOps(writeKey)
        const basePub = publicMenu(opsNow, typeHint || undefined)
        const scopeKey = typeHint || basePub.menuKey || ''
        const bag = await loadPublicMenuBag(writeKey, scopeKey || undefined)
        bag.menuKey = scopeKey || bag.menuKey

        if (action === 'reorderMenu') {
          const order = Array.isArray(body.order)
            ? body.order.map((x) => String(x || '').trim()).filter(Boolean)
            : []
          if (order.length < 2) {
            return json(res, 400, { error: 'order needs at least two ids.' })
          }
          bag.order = order
        } else if (action === 'removeMenuItem') {
          const menuItemId = String(body.menuItemId || '').trim()
          if (!menuItemId) return json(res, 400, { error: 'menuItemId is required.' })
          bag.removed = [...new Set([...(bag.removed || []), menuItemId])]
          bag.order = (bag.order || basePub.menu.map((m) => m.id)).filter(
            (id) => id !== menuItemId,
          )
          bag.extras = (bag.extras || []).filter((m) => m.id !== menuItemId)
          bag.items = { ...bag.items }
          delete bag.items[menuItemId]
        } else if (action === 'addMenuItem') {
          const raw = body.item && typeof body.item === 'object' ? body.item : null
          if (!raw) return json(res, 400, { error: 'item is required.' })
          const section =
            normalizeSection(raw.publicSection) ||
            (raw.kind === 'combo' ? 'combos' : 'mains')
          const name = String(raw.name || '').trim()
          if (!name) return json(res, 400, { error: 'Dish name is required.' })
          const id =
            String(raw.id || '').trim() ||
            `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
          const kind = sectionToKind(section)
          const price = Math.max(0, Number(raw.price ?? raw.priceWithChai) || 0)
          const item: MenuItem = {
            id,
            name,
            nameDe: String(raw.nameDe || name).trim() || name,
            kind,
            publicSection: section,
            price,
            priceWithChai:
              kind === 'combo'
                ? Math.max(0, Number(raw.priceWithChai ?? price) || 0)
                : undefined,
            priceWithLassi:
              kind === 'combo'
                ? Math.max(0, Number(raw.priceWithLassi ?? price) || 0)
                : undefined,
            contents: String(raw.contents || '').trim() || undefined,
            contentsDe: String(raw.contentsDe || '').trim() || undefined,
            description: String(raw.description || '').trim() || undefined,
            descriptionDe: String(raw.descriptionDe || '').trim() || undefined,
            ingredients: String(raw.ingredients || '').trim() || undefined,
            ingredientsDe: String(raw.ingredientsDe || '').trim() || undefined,
            imageUrl: String(raw.imageUrl || '').trim() || undefined,
            vegan: Boolean(raw.vegan),
            vegetarian: Boolean(raw.vegetarian || raw.vegan),
            glutenFree: section === 'snacks' || section === 'combos' ? false : Boolean(raw.glutenFree),
          }
          bag.extras = [...(bag.extras || []).filter((m) => m.id !== id), item]
          const currentOrder =
            bag.order?.length ? bag.order : basePub.menu.map((m) => m.id)
          if (!currentOrder.includes(id)) bag.order = [...currentOrder, id]
          bag.items = {
            ...bag.items,
            [id]: {
              publicSection: section,
              kind,
              name: item.name,
              nameDe: item.nameDe,
              price: item.price,
              priceWithChai: item.priceWithChai,
              priceWithLassi: item.priceWithLassi,
            },
          }
          bag.removed = (bag.removed || []).filter((x) => x !== id)
        } else {
          // patchMenuItem
          const menuItemId = String(body.menuItemId || '').trim()
          const patch = body.patch && typeof body.patch === 'object' ? body.patch : null
          if (!menuItemId || !patch) {
            return json(res, 400, { error: 'menuItemId and patch are required.' })
          }
          const cleaned = cleanMenuPatch(patch)
          if (!Object.keys(cleaned).length) {
            return json(res, 400, { error: 'Nothing to update.' })
          }
          bag.items = {
            ...bag.items,
            [menuItemId]: { ...(bag.items[menuItemId] || {}), ...cleaned },
          }
          // Keep extras in sync when editing a custom dish
          if (bag.extras?.some((m) => m.id === menuItemId)) {
            bag.extras = bag.extras.map((m) =>
              m.id === menuItemId ? applyMenuItemPatch(m, cleaned) : m,
            )
          }
          try {
            const patched = await saveStallOpsMutate(url, writeKey, (raw) => ({
              ops: patchMenuInStallOps(asStallOps(raw), menuItemId, cleaned, scopeKey),
              value: true,
            }))
            if (!patched.ok) {
              /* bag already holds the edit */
            }
          } catch {
            /* bag already holds the edit */
          }
        }

        const saved = await savePublicMenuBag(writeKey, bag, scopeKey || undefined)
        if (!saved.ok) {
          return json(res, 500, { error: saved.error || 'Could not save menu changes.' })
        }
        const pub = await resolvePublicCatalog(writeKey, opsNow, typeHint || undefined)
        return json(res, 200, {
          ok: true,
          menu: pub.menu,
          menuKey: pub.menuKey,
          menuLabel: pub.menuLabel,
        })
      } catch (e) {
        return json(res, 400, {
          error: e instanceof Error ? e.message : 'Could not update menu.',
        })
      }
    }

    // place — stamp the stall from the guest QR (`eventId`), not the global active stall
    const ops = await loadStallOps(key)
    const placeEventId = requirePlaceEventId(body.eventId)
    if (!placeEventId) {
      return json(res, 400, {
        error: 'Scan the stall QR to order (this link is missing the event).',
      })
    }
    const placeTypeHint = String(body.menuKey || req.query?.type || '').trim()
    const { menu } = await resolvePublicCatalog(
      key,
      ops,
      placeTypeHint || undefined,
      placeEventId || undefined,
    )
    if (!menu.length) return json(res, 400, { error: 'Menu is empty — ask staff to set prices.' })
    const lines = makeLines(menu, Array.isArray(body.lines) ? body.lines : [])
    if (!lines) return json(res, 400, { error: 'Add at least one item.' })
    const orderId = `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const saved = await saveStallOpsMutate(url, key, (raw) => {
      const latest = asStallOps(raw)
      let orders = prune(Array.isArray(latest.orders) ? latest.orders : [])
      const existing = orders.find((o) => o.id === orderId)
      if (existing) {
        return {
          ops: latest,
          value: { claimCode: existing.claimCode || '', orderId },
        }
      }
      const claimCode = genCode(orders, placeEventId || undefined)
      const now = new Date().toISOString()
      const order: StallOrder = {
        id: orderId,
        label: `Hold ${claimCode}`,
        status: 'awaiting_claim',
        lines,
        createdAt: now,
        updatedAt: now,
        eventId: placeEventId || undefined,
        source: 'customer',
        claimCode,
        customerName: String(body.customerName || '')
          .trim()
          .slice(0, 60) || undefined,
      }
      let eventOrderLinks = latest.eventOrderLinks
      if (placeEventId && placeTypeHint) {
        eventOrderLinks = {
          ...(latest.eventOrderLinks || {}),
          [placeEventId]: {
            menuKey: placeTypeHint,
            label:
              String(latest.eventOrderLinks?.[placeEventId]?.label || '').trim() ||
              placeTypeHint,
          },
        }
      }
      orders = [order, ...orders].slice(0, 800)
      return {
        ops: { ...latest, orders, eventOrderLinks },
        value: { claimCode, orderId },
      }
    })
    if (saved.ok === false) {
      return json(res, saved.status || 500, { error: saved.error || 'Could not place order' })
    }
    return json(res, 200, {
      ok: true,
      claimCode: saved.value.claimCode,
      orderId: saved.value.orderId,
      eventId: placeEventId || '',
      message: 'Show this number to staff to start your order.',
      expiresInMinutes: 30,
    })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
