/** Local extras that aren't in Excel yet: weather, inventory, partner split rules. */

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
  { id: 'cauliflower', name: 'Cauliflower', unit: 'kg', unitCost: 3 },
  { id: 'potato-masala', name: 'Potato masala', unit: 'batch', unitCost: 8 },
  { id: 'cheese', name: 'Cheese', unit: 'pack', unitCost: 5 },
  { id: 'mango-lassi', name: 'Mango lassi', unit: 'litre', unitCost: 6 },
  { id: 'masala-chai', name: 'Masala chai', unit: 'litre', unitCost: 4 },
  { id: 'sambar', name: 'Sambar', unit: 'pot', unitCost: 8 },
  { id: 'tomato-chutney', name: 'Tomato chutney', unit: 'bowl', unitCost: 3.5 },
  { id: 'linsen-tuffi', name: 'Linsen tuffi', unit: 'batch', unitCost: 7 },
]

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
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
