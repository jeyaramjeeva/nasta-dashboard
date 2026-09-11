/** 5-minute till training: last Saturday’s live menu + fake tickets, no cloud writes. */

import { clearDemoStorage, demoStorageKey, setDemoMode } from './demoMode'
import { germanyParts, germanyYmd } from './germanyTime'
import { enterStallMode } from './stallMode'
import {
  DEFAULT_EVENT_TYPES,
  DEFAULT_MENU,
  customerLabel,
  emptyStallOps,
  extractEventType,
  listEventTypes,
  loadCachedStallEvents,
  loadLiveStallOps,
  menuForEventType,
  newId,
  saveStallOpsLocal,
  soldCountsForEventDay,
  type MenuItem,
  type StallOpsState,
  type StallOrder,
} from './stallOps'

export const TILL_TRAINING_MS = 5 * 60 * 1000
export const TILL_TRAINING_FLAG = 'nasta-till-training'
export const TILL_TRAINING_META = 'nasta-till-training-meta'
const LIVE_SNAPSHOT_KEY = 'nasta-snapshot-v3'

export type TillTrainingMeta = {
  until: number
  eventId: string
  eventLabel: string
  dayYmd: string
  usedLastSaturday: boolean
}

/** Previous Saturday on the Germany calendar (never “today” if today is Saturday). */
export function lastSaturdayYmd(now = new Date()): string {
  const p = germanyParts(now)
  const utcNoon = Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0)
  const dow = new Date(utcNoon).getUTCDay()
  const back = dow === 6 ? 7 : (dow + 1) % 7
  const sat = new Date(utcNoon)
  sat.setUTCDate(sat.getUTCDate() - back)
  const y = sat.getUTCFullYear()
  const m = String(sat.getUTCMonth() + 1).padStart(2, '0')
  const d = String(sat.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function completedOnDay(orders: StallOrder[], dayYmd: string): StallOrder[] {
  return orders.filter((o) => {
    if (o.status !== 'completed' || o.voided) return false
    const when = germanyYmd(new Date(o.completedAt || o.createdAt))
    return when === dayYmd
  })
}

function busiestEventId(orders: StallOrder[]): string {
  const counts = new Map<string, number>()
  for (const o of orders) {
    const id = String(o.eventId || '').trim()
    if (!id) continue
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  let best = ''
  let n = 0
  for (const [id, c] of counts) {
    if (c > n) {
      best = id
      n = c
    }
  }
  return best
}

function latestSaleDay(orders: StallOrder[]): string {
  let best = ''
  for (const o of orders) {
    if (o.status !== 'completed' || o.voided) continue
    const day = germanyYmd(new Date(o.completedAt || o.createdAt))
    if (day > best) best = day
  }
  return best
}

export function pickTillTrainingTarget(
  live: StallOpsState,
  now = new Date(),
): { eventId: string; dayYmd: string; usedLastSaturday: boolean } {
  const saturday = lastSaturdayYmd(now)
  const satOrders = completedOnDay(live.orders || [], saturday)
  const satEvent = busiestEventId(satOrders)
  if (satEvent) return { eventId: satEvent, dayYmd: saturday, usedLastSaturday: true }

  const fallbackDay = latestSaleDay(live.orders || [])
  const fallbackOrders = fallbackDay ? completedOnDay(live.orders || [], fallbackDay) : []
  const fallbackEvent = busiestEventId(fallbackOrders)
  if (fallbackEvent && fallbackDay) {
    return { eventId: fallbackEvent, dayYmd: fallbackDay, usedLastSaturday: false }
  }

  const active = String(live.activeEventId || '').trim()
  const events = loadCachedStallEvents(live.eventBook)
  const first = events.find((e) => e.id.trim().toLowerCase() !== 'setup')
  return {
    eventId: active || first?.id || 'TRAIN',
    dayYmd: saturday,
    usedLastSaturday: false,
  }
}

function trainingMenu(
  live: StallOpsState,
  eventId: string,
): { items: MenuItem[]; typeKey: string; label: string } {
  const events = loadCachedStallEvents(live.eventBook)
  const types = listEventTypes(events, live.customEventTypes)
  const ev = events.find((e) => e.id === eventId)
  const typeKey =
    extractEventType(ev?.name, ev?.location, [...DEFAULT_EVENT_TYPES, ...types]) ||
    String(ev?.name || 'Flohmarkt')
  const items = menuForEventType(
    typeKey,
    live.eventMenus,
    live.menu?.length ? live.menu : DEFAULT_MENU,
    live.eventPrices,
    live.eventTypeHiddenMenu,
  ).filter((m) => !m.hidden)
  const label = ev
    ? `${ev.id}${typeKey ? ` · ${typeKey}` : ''}${ev.location ? ` · ${ev.location}` : ''}`
    : eventId
  return { items: items.length ? items : DEFAULT_MENU.filter((m) => !m.hidden), typeKey, label }
}

function fakeLine(item: MenuItem): StallOrder['lines'][number] {
  if (item.kind === 'combo') {
    const drink = 'chai' as const
    const price = item.priceWithChai ?? item.price
    return {
      menuItemId: item.id,
      name: `${item.name} + Masala chai`,
      price,
      qty: 1,
      drink,
    }
  }
  return { menuItemId: item.id, name: item.name, price: item.price, qty: 1 }
}

function fakeTickets(eventId: string, menu: MenuItem[], soldHints: { menuItemId: string }[]): StallOrder[] {
  const byId = new Map(menu.map((m) => [m.id, m]))
  const picks: MenuItem[] = []
  for (const h of soldHints) {
    const hit = byId.get(h.menuItemId)
    if (hit && !picks.some((p) => p.id === hit.id)) picks.push(hit)
    if (picks.length >= 2) break
  }
  for (const m of menu) {
    if (picks.length >= 2) break
    if (!picks.some((p) => p.id === m.id)) picks.push(m)
  }
  const now = Date.now()
  return picks.slice(0, 2).map((item, i) => ({
    id: newId('train'),
    label: customerLabel(i + 1),
    status: 'pending' as const,
    lines: [fakeLine(item)],
    createdAt: new Date(now - (i + 1) * 90_000).toISOString(),
    eventId,
    source: 'pos' as const,
  }))
}

export function buildTillTrainingSandbox(
  live: StallOpsState,
  now = new Date(),
): { state: StallOpsState; meta: TillTrainingMeta } {
  const target = pickTillTrainingTarget(live, now)
  const { items, typeKey, label } = trainingMenu(live, target.eventId)
  const soldHints = soldCountsForEventDay(live.orders || [], target.eventId, target.dayYmd)
  const stock = (live.stock?.length ? live.stock : emptyStallOps().stock).map((s) => ({
    ...s,
    bought: Math.max(s.bought, s.used + 20),
  }))
  const state: StallOpsState = {
    ...emptyStallOps(),
    stock,
    menu: live.menu?.length ? live.menu.map((m) => ({ ...m })) : DEFAULT_MENU.map((m) => ({ ...m })),
    orders: fakeTickets(target.eventId, items, soldHints),
    deletedOrderIds: [],
    activeEventId: target.eventId,
    publicMenuKey: typeKey,
    publicMenuLabel: `Training · ${label}`,
    eventPrices: { ...(live.eventPrices || {}) },
    eventTypeHiddenMenu: { ...(live.eventTypeHiddenMenu || {}) },
    eventMenus: { ...(live.eventMenus || {}) },
    eventMenusRev: { ...(live.eventMenusRev || {}) },
    eventMenuRemovedIds: { ...(live.eventMenuRemovedIds || {}) },
    customEventTypes: [...(live.customEventTypes || [])],
    paypalQrDataUrl: live.paypalQrDataUrl || '',
    paypalQrUpdatedAt: live.paypalQrUpdatedAt || '',
    eventStock: {},
    foodMade: {},
    recipes: live.recipes ? live.recipes.map((r) => ({ ...r })) : [],
    eventBook: live.eventBook
      ? {
          extras: [...(live.eventBook.extras || [])],
          patches: { ...(live.eventBook.patches || {}) },
        }
      : emptyStallOps().eventBook,
  }
  const extras = state.eventBook?.extras || []
  if (target.eventId && !extras.some((e) => e.id === target.eventId) && target.eventId === 'TRAIN') {
    extras.push({
      id: 'TRAIN',
      name: typeKey || 'Flohmarkt',
      location: 'Training stall',
      startDate: target.dayYmd,
      endDate: target.dayYmd,
      month: target.dayYmd.slice(0, 7),
      days: 1,
      fee: 0,
      status: 'Confirmed',
    })
    state.eventBook = { extras, patches: state.eventBook?.patches || {} }
  }
  return {
    state,
    meta: {
      until: now.getTime() + TILL_TRAINING_MS,
      eventId: target.eventId,
      eventLabel: label,
      dayYmd: target.dayYmd,
      usedLastSaturday: target.usedLastSaturday,
    },
  }
}

export function isTillTraining(): boolean {
  try {
    return sessionStorage.getItem(TILL_TRAINING_FLAG) === '1'
  } catch {
    return false
  }
}

export function readTillTrainingMeta(): TillTrainingMeta | null {
  if (!isTillTraining()) return null
  try {
    const raw = sessionStorage.getItem(TILL_TRAINING_META)
    if (!raw) return null
    const meta = JSON.parse(raw) as TillTrainingMeta
    if (!meta || typeof meta.until !== 'number') return null
    return meta
  } catch {
    return null
  }
}

export function clearTillTrainingSession() {
  try {
    sessionStorage.removeItem(TILL_TRAINING_FLAG)
    sessionStorage.removeItem(TILL_TRAINING_META)
  } catch {
    /* ignore */
  }
}

export function enterTillTraining(now = new Date()) {
  const live = loadLiveStallOps()
  const liveSnap = (() => {
    try {
      return localStorage.getItem(LIVE_SNAPSHOT_KEY)
    } catch {
      return null
    }
  })()
  const { state, meta } = buildTillTrainingSandbox(live, now)
  clearDemoStorage()
  setDemoMode(true)
  try {
    if (liveSnap) localStorage.setItem(demoStorageKey(LIVE_SNAPSHOT_KEY), liveSnap)
    sessionStorage.setItem(TILL_TRAINING_FLAG, '1')
    sessionStorage.setItem(TILL_TRAINING_META, JSON.stringify(meta))
  } catch {
    /* ignore */
  }
  saveStallOpsLocal(state)
  enterStallMode()
  window.location.assign('/orders')
}
