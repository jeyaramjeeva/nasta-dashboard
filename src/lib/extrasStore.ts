/** Local extras that aren't in Excel yet: weather, inventory, partner split rules. */

import { demoStorageKey } from './demoMode'

export type WeatherTag = 'sunny' | 'good' | 'windy' | 'rainy' | 'mixed' | ''

export const WEATHER_OPTIONS: { value: WeatherTag; label: string }[] = [
  { value: 'sunny', label: 'Sunny' },
  { value: 'good', label: 'Good weather' },
  { value: 'windy', label: 'Windy' },
  { value: 'rainy', label: 'Rainy' },
  { value: 'mixed', label: 'Mixed' },
]

export type SplitMode = 'owed' | 'custom_pct' | 'expenses_first'

export interface SplitRules {
  mode: SplitMode
  /** Partner name → share 0–1 (should sum ~1 for custom modes). */
  shares: Record<string, number>
}

export interface InventoryItemDef {
  id: string
  name: string
  unit: string
  unitCost: number
  /** Optional kg per prep unit (Food/Stock converter). */
  kgPerUnit?: number
  /** Optional portions per prep unit. */
  portionPerUnit?: number
}

export interface InventoryLine {
  itemId: string
  qty: number
}

const WEATHER_KEY = 'nasta-weather-v2'
const WEATHER_LEGACY = 'nasta-weather-v1'
const SPLIT_KEY = 'nasta-split-rules-v1'
const INV_DEFS_KEY = 'nasta-inventory-defs-v2'
const INV_EVENT_KEY = 'nasta-inventory-events-v1'

const DEFAULT_ITEMS: InventoryItemDef[] = [
  { id: 'dosa-batter', name: 'Dosa batter', unit: 'batch', unitCost: 12 },
  { id: 'idli-batter', name: 'Idli batter', unit: 'batch', unitCost: 10 },
  { id: 'sambar', name: 'Sambar', unit: 'litre', unitCost: 8 },
  { id: 'tomato-chutney', name: 'Tomato chutney', unit: 'bowl', unitCost: 3.5 },
  { id: 'potato-masala', name: 'Potato masala', unit: 'batch', unitCost: 8 },
  { id: 'masala-chai', name: 'Masala chai', unit: 'litre', unitCost: 4 },
  { id: 'mango-lassi', name: 'Mango lassi', unit: 'litre', unitCost: 6 },
]

/** Core prep items the Food tab focuses on (ensured on load). */
export const FOOD_PREP_CORE: InventoryItemDef[] = DEFAULT_ITEMS.map((d) => ({ ...d }))

/** Merge missing core prep items; fix sambar unit to litre if still “pot”. */
export function ensureFoodPrepCatalog(defs?: InventoryItemDef[]): InventoryItemDef[] {
  const current = defs?.length ? [...defs] : loadInventoryDefs()
  const byId = new Map(current.map((d) => [d.id, { ...d }]))
  const hasAnyCore = FOOD_PREP_CORE.some((c) => byId.has(c.id))

  if (!hasAnyCore) {
    for (const core of FOOD_PREP_CORE) byId.set(core.id, { ...core })
  } else {
    // Do not resurrect items the user deleted — only migrate units on items still present.
    const sambar = byId.get('sambar')
    if (sambar && (sambar.unit || '').toLowerCase() === 'pot') {
      byId.set('sambar', { ...sambar, unit: 'litre' })
    }
  }

  const next = [...byId.values()]
  const coreIds = new Set(FOOD_PREP_CORE.map((d) => d.id))
  const ordered = [
    ...FOOD_PREP_CORE.map((c) => byId.get(c.id)).filter(
      (d): d is InventoryItemDef => Boolean(d),
    ),
    ...next.filter((d) => !coreIds.has(d.id)),
  ]
  saveInventoryDefs(ordered)
  return ordered
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(demoStorageKey(key))
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(demoStorageKey(key), JSON.stringify(value))
}

function migrateWeatherTag(tag: string): WeatherTag {
  if (tag === 'dry') return 'sunny'
  if (tag === 'rain') return 'rainy'
  if (
    tag === 'sunny' ||
    tag === 'good' ||
    tag === 'windy' ||
    tag === 'rainy' ||
    tag === 'mixed'
  ) {
    return tag
  }
  return ''
}

export function loadWeather(): Record<string, WeatherTag> {
  const current = readJson<Record<string, string> | null>(WEATHER_KEY, null)
  if (current) {
    const out: Record<string, WeatherTag> = {}
    for (const [k, v] of Object.entries(current)) {
      const t = migrateWeatherTag(v)
      if (t) out[k] = t
    }
    return out
  }
  const legacy = readJson<Record<string, string>>(WEATHER_LEGACY, {})
  const out: Record<string, WeatherTag> = {}
  for (const [k, v] of Object.entries(legacy)) {
    const t = migrateWeatherTag(v)
    if (t) out[k] = t
  }
  if (Object.keys(out).length) writeJson(WEATHER_KEY, out)
  return out
}

export function setEventWeather(eventId: string, tag: WeatherTag) {
  const all = loadWeather()
  if (!tag) delete all[eventId]
  else all[eventId] = tag
  writeJson(WEATHER_KEY, all)
}

export function loadSplitRules(partnerNames: string[]): SplitRules {
  const saved = readJson<SplitRules | null>(SPLIT_KEY, null)
  if (saved?.mode) {
    const shares = { ...saved.shares }
    for (const n of partnerNames) {
      if (shares[n] == null) shares[n] = 1 / Math.max(partnerNames.length, 1)
    }
    return { mode: saved.mode, shares }
  }
  const equal = 1 / Math.max(partnerNames.length, 1)
  const shares: Record<string, number> = {}
  for (const n of partnerNames) shares[n] = equal
  // Default: repay expenses first, then equal profit share
  return { mode: 'expenses_first', shares }
}

export function saveSplitRules(rules: SplitRules) {
  writeJson(SPLIT_KEY, rules)
}

export function loadInventoryDefs(): InventoryItemDef[] {
  const saved = readJson<InventoryItemDef[] | null>(INV_DEFS_KEY, null)
  if (saved?.length) return saved
  writeJson(INV_DEFS_KEY, DEFAULT_ITEMS)
  return DEFAULT_ITEMS.map((d) => ({ ...d }))
}

export function saveInventoryDefs(defs: InventoryItemDef[]) {
  writeJson(INV_DEFS_KEY, defs)
}

export function updateInventoryUnitCost(itemId: string, unitCost: number) {
  const defs = loadInventoryDefs().map((d) =>
    d.id === itemId ? { ...d, unitCost: Math.max(0, unitCost) } : d,
  )
  saveInventoryDefs(defs)
  return defs
}

export function updateInventoryDish(
  itemId: string,
  patch: Partial<
    Pick<InventoryItemDef, 'name' | 'unit' | 'unitCost' | 'kgPerUnit' | 'portionPerUnit'>
  >,
): InventoryItemDef[] {
  const defs = loadInventoryDefs().map((d) => {
    if (d.id !== itemId) return d
    const next = { ...d }
    if (patch.name != null) {
      const n = String(patch.name).trim()
      if (n) next.name = n
    }
    if (patch.unit != null) {
      const u = String(patch.unit).trim()
      if (u) next.unit = u
    }
    if (patch.unitCost != null && Number.isFinite(Number(patch.unitCost))) {
      next.unitCost = Math.max(0, Number(patch.unitCost))
    }
    if (patch.kgPerUnit != null && Number.isFinite(Number(patch.kgPerUnit))) {
      next.kgPerUnit = Math.max(0, Number(patch.kgPerUnit))
    }
    if (patch.portionPerUnit != null && Number.isFinite(Number(patch.portionPerUnit))) {
      next.portionPerUnit = Math.max(0, Number(patch.portionPerUnit))
    }
    return next
  })
  saveInventoryDefs(defs)
  return defs
}

export function removeInventoryDish(itemId: string): InventoryItemDef[] {
  const defs = loadInventoryDefs().filter((d) => d.id !== itemId)
  saveInventoryDefs(defs)
  const all = loadEventInventory()
  let touched = false
  for (const eid of Object.keys(all)) {
    const next = (all[eid] || []).filter((l) => l.itemId !== itemId)
    if (next.length !== (all[eid] || []).length) {
      all[eid] = next
      touched = true
    }
  }
  if (touched) writeJson(INV_EVENT_KEY, all)
  return defs
}

export function addInventoryDish(name: string, unit = 'portion', unitCost = 0): InventoryItemDef[] {
  const trimmed = name.trim()
  if (!trimmed) return loadInventoryDefs()
  const id =
    trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `dish-${Date.now()}`
  const defs = loadInventoryDefs()
  if (defs.some((d) => d.id === id || d.name.toLowerCase() === trimmed.toLowerCase())) {
    return defs
  }
  const next = [...defs, { id, name: trimmed, unit, unitCost: Math.max(0, unitCost) }]
  saveInventoryDefs(next)
  return next
}

export function loadEventInventory(): Record<string, InventoryLine[]> {
  return readJson(INV_EVENT_KEY, {})
}

export function setEventInventory(eventId: string, lines: InventoryLine[]) {
  const all = loadEventInventory()
  all[eventId] = lines.filter((l) => l.qty > 0)
  writeJson(INV_EVENT_KEY, all)
}

export function inventoryCostForEvent(
  eventId: string,
  defs = loadInventoryDefs(),
  byEvent = loadEventInventory(),
): number {
  const lines = byEvent[eventId] || []
  const map = new Map(defs.map((d) => [d.id, d]))
  return (
    Math.round(
      lines.reduce((s, l) => s + (map.get(l.itemId)?.unitCost || 0) * l.qty, 0) * 100,
    ) / 100
  )
}
