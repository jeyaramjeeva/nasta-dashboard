/** Stall stock + POS orders (synced via team_extras.stall_ops). */

import { demoStorageKey } from './demoMode'
import type { EventRow } from '../types'
import {
  emptyEventBook,
  mergeEventRows,
  normalizeCalendarNotes,
  normalizeEventBook,
  type CalendarNote,
  type EventBook,
} from './eventBook'
import { germanyTodayYmd, germanyYmd } from './germanyTime'

export interface StockItem {
  id: string
  name: string
  unit: string
  /** Alert when remaining ≤ this. */
  lowAt: number
  bought: number
  used: number
  /** Optional expiry date yyyy-mm-dd. */
  expiresOn?: string
  /** Optional kg per stock/prep unit (converter). */
  kgPerUnit?: number
  /** Optional portions per unit (converter). */
  portionPerUnit?: number
}

export type MenuKind = 'single' | 'combo'
export type DrinkChoice = 'chai' | 'lassi'

export interface MenuItem {
  id: string
  name: string
  kind: MenuKind
  /** Default price for single items. */
  price: number
  /** Default combo price with masala chai. */
  priceWithChai?: number
  /** Default combo price with mango lassi. */
  priceWithLassi?: number
  /** What’s included (combos). */
  contents?: string
  /** Short story / how we prepare it (customer menu). */
  description?: string
  /** Ingredient list for customers. */
  ingredients?: string
  /** German labels for customer `/order` (default language). */
  nameDe?: string
  contentsDe?: string
  descriptionDe?: string
  ingredientsDe?: string
  /** Photo for customer order page (https URL or data:image…). */
  imageUrl?: string
  /** Dietary tags for customer menu. */
  vegan?: boolean
  vegetarian?: boolean
  glutenFree?: boolean
  /** Estimated food cost € (excl. drink for combos). */
  foodCost?: number
  /** Extra cost when drink is masala chai. */
  drinkCostChai?: number
  /** Extra cost when drink is mango lassi. */
  drinkCostLassi?: number
  /** Soft-deleted — hidden from POS, kept so defaults don’t return. */
  hidden?: boolean
  /** Hide from public customer order page. */
  hideFromCustomer?: boolean
  /** Visible on `/order` but not orderable. */
  soldOut?: boolean
  /** Customer `/order` section (combos / mains / snacks / drinks). */
  publicSection?: 'combos' | 'mains' | 'snacks' | 'drinks'
}

export type PayMethod = 'cash' | 'paypal'
export type EventParticipant = 'Sriram' | 'Sneha' | 'Jeeva'

export type PrepAssignee = 'Sriram' | 'Sneha' | 'Jeeva' | ''

export interface PrepTask {
  id: string
  text: string
  done: boolean
  assignee: PrepAssignee
}

/** Per-event overrides for one menu item. */
export interface EventPriceOverride {
  price?: number
  priceWithChai?: number
  priceWithLassi?: number
}

/** Guest `/order?event=` binding for one stall (menu type + display label). */
export interface EventOrderLink {
  menuKey: string
  label: string
}

/** True when both sides refer to the same stall event (empty matches empty). */
export function sameStallEvent(
  orderEventId: string | undefined,
  stallEventId: string | undefined,
): boolean {
  const a = String(orderEventId || '').trim()
  const b = String(stallEventId || '').trim()
  return a === b
}

/** Orders belonging to a stall; empty stallEventId returns all. */
export function ordersForStallEvent(
  orders: StallOrder[],
  stallEventId: string | undefined,
): StallOrder[] {
  const eid = String(stallEventId || '').trim()
  if (!eid) return orders
  return orders.filter((o) => String(o.eventId || '').trim() === eid)
}

/** Guest path for a stall QR (keeps same-day events isolated). */
export function guestOrderPath(
  eventId: string,
  opts?: { type?: string; preview?: boolean },
): string {
  const q = new URLSearchParams()
  const eid = String(eventId || '').trim()
  if (eid) q.set('event', eid)
  const type = String(opts?.type || '').trim()
  if (type) q.set('type', type)
  if (opts?.preview) q.set('preview', '1')
  const s = q.toString()
  return s ? `/order?${s}` : '/order'
}

export interface OrderLine {
  menuItemId: string
  name: string
  price: number
  qty: number
  drink?: DrinkChoice
  /** Portions handed over so far (0…qty). */
  deliveredQty?: number
}

export type SpoilReason = 'leftover' | 'burnt' | 'weather' | 'other'

export interface FoodMadeRow {
  made: number
  used: number
  name: string
  unit: string
  spoiled?: number
  spoilReason?: SpoilReason
  /** Qty carried in from previous day. */
  carriedIn?: number
}

export interface RecipeYield {
  menuItemId: string
  portions: number
}

export interface RecipeIngredient {
  itemId: string
  qtyPerBatch: number
}

export interface Recipe {
  prepItemId: string
  batchSize: number
  unit: string
  yields: RecipeYield[]
  ingredients?: RecipeIngredient[]
}

export interface StockAutoUseRule {
  menuItemId: string
  stockItemId: string
  qtyPerSale: number
}

export type OrderStatus = 'awaiting_claim' | 'pending' | 'completed'
export type OrderSource = 'pos' | 'customer'

export interface StallOrder {
  id: string
  /** Customer label / ticket # */
  label: string
  status: OrderStatus
  lines: OrderLine[]
  createdAt: string
  completedAt?: string
  /** Stall / Excel event this order belongs to. */
  eventId?: string
  /** Cash the customer handed over (€). */
  paid?: number
  /** Tip kept in the box (€). */
  tip?: number
  /** Change to return (€) = paid − total − tip. */
  change?: number
  /** How the customer paid. */
  payMethod?: PayMethod
  /** Voided / refunded after completion. */
  voided?: boolean
  voidReason?: string
  voidedAt?: string
  /** Who created the order. */
  source?: OrderSource
  /** 4-digit code customer shows staff to activate the ticket. */
  claimCode?: string
  /** When staff entered the claim code. */
  claimedAt?: string
  /** Optional name from customer self-order. */
  customerName?: string
  /**
   * Last local/cloud mutation time. Sync merge prefers the newer revision so
   * “Back to pending” / edits are not overwritten by a stale completed copy.
   */
  updatedAt?: string
  /**
   * When payment was taken while the ticket is still in the kitchen
   * (status stays `pending` until Delivered).
   */
  paidAt?: string
}

export interface OrderConflict {
  orderId: string
  local: StallOrder
  remote: StallOrder
}

/** Delivery clock for next-day catch-up tickets: 5 minutes after taken. */
export const CATCH_UP_DELIVERY_LAG_MS = 5 * 60 * 1000

export function isCatchUpCompletion(createdAt: string, now = new Date()): boolean {
  const taken = Date.parse(createdAt)
  if (!Number.isFinite(taken)) return false
  return germanyYmd(new Date(taken)) !== germanyYmd(now)
}

/** Wall-clock when staff tap Delivered, or taken+5min when closing a ticket days later. */
export function stampCompletedAt(createdAt: string, now = new Date()): string {
  const taken = Date.parse(createdAt)
  if (!Number.isFinite(taken)) return now.toISOString()
  if (!isCatchUpCompletion(createdAt, now)) return now.toISOString()
  return new Date(taken + CATCH_UP_DELIVERY_LAG_MS).toISOString()
}

/** Pending ticket already paid (cash/PayPal) but food not handed over yet. */
export function isOrderPrepaid(o: StallOrder): boolean {
  if (o.status !== 'pending' || o.voided) return false
  if (o.payMethod !== 'cash' && o.payMethod !== 'paypal') return false
  return o.paid != null && Number.isFinite(Number(o.paid))
}

export function lineDeliveredQty(l: OrderLine): number {
  const qty = Math.max(0, Number(l.qty) || 0)
  const d = l.deliveredQty != null ? Number(l.deliveredQty) : 0
  if (!Number.isFinite(d)) return 0
  return Math.max(0, Math.min(qty, Math.round(d)))
}

export function orderFullyDelivered(o: StallOrder): boolean {
  const lines = o.lines || []
  if (!lines.length) return false
  return lines.every((l) => lineDeliveredQty(l) >= Math.max(0, Number(l.qty) || 0) && (Number(l.qty) || 0) > 0)
}

export function linesEqualForConflict(a: OrderLine[], b: OrderLine[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    if (
      x.menuItemId !== y.menuItemId ||
      x.qty !== y.qty ||
      x.price !== y.price ||
      x.drink !== y.drink ||
      lineDeliveredQty(x) !== lineDeliveredQty(y)
    ) {
      return false
    }
  }
  return true
}

/** Detect tickets where remote LWW overwrote a divergent local revision. */
export function detectOrderConflicts(
  localOrders: StallOrder[],
  remoteOrders: StallOrder[],
): OrderConflict[] {
  const remoteById = new Map(remoteOrders.map((o) => [o.id, o]))
  const out: OrderConflict[] = []
  for (const local of localOrders) {
    const remote = remoteById.get(local.id)
    if (!remote || local.voided || remote.voided) continue
    const statusDiff = local.status !== remote.status
    const linesDiff = !linesEqualForConflict(local.lines || [], remote.lines || [])
    if (!statusDiff && !linesDiff) continue
    const localMs = orderRevisionMs(local)
    const remoteMs = orderRevisionMs(remote)
    if (remoteMs <= localMs) continue
    out.push({
      orderId: local.id,
      local: normalizeOrder(local),
      remote: normalizeOrder(remote),
    })
  }
  return out
}

/** Days until expiry (negative = expired). Null if no date. */
export function stockExpiryDays(expiresOn: string | undefined, todayYmd: string): number | null {
  if (!expiresOn || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) return null
  const a = Date.parse(`${expiresOn}T12:00:00Z`)
  const b = Date.parse(`${todayYmd}T12:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.round((a - b) / 86400000)
}

/** Unclaimed QR orders expire so fake carts don’t clog the kitchen. */
export const CLAIM_TTL_MS = 30 * 60 * 1000

export interface StallOpsState {
  stock: StockItem[]
  menu: MenuItem[]
  orders: StallOrder[]
  /**
   * Tombstones for hard-deleted tickets. Sync merge must honor these or
   * cloud refresh / saveStallOpsCloud will resurrect removed pending orders.
   */
  deletedOrderIds?: string[]
  /** Event selected for new POS tickets. */
  activeEventId?: string
  /**
   * Event-type menu key shown on the public `/order` page
   * (same catalog as New order for the selected stall).
   */
  publicMenuKey?: string
  /** Human label for the public menu (e.g. “E010 · Flohmarkt · Köln”). */
  publicMenuLabel?: string
  /**
   * Per-stall guest menu bindings so two same-day events keep separate
   * `/order?event=` catalogs even when `publicMenuKey` points at only one.
   */
  eventOrderLinks?: Record<string, EventOrderLink>
  /**
   * Price overrides keyed by **event type** (Flohmarkt, Street Festival, …),
   * not individual stall IDs. Legacy event-id keys still resolve as fallback.
   * Prefer `eventMenus` for full per-type catalogs.
   */
  eventPrices?: Record<string, Record<string, EventPriceOverride>>
  /** Event type → menu item ids hidden on New order for that type (legacy). */
  eventTypeHiddenMenu?: Record<string, string[]>
  /**
   * Full menu catalog per event type (Flohmarkt, Streetfood Festival, Gourmet, …).
   * When set, New order and Menu prices use this list (prices included).
   */
  eventMenus?: Record<string, MenuItem[]>
  /** Per-type catalog clock — higher wins on sync so stale cloud saves can’t undo edits. */
  eventMenusRev?: Record<string, number>
  /** Per-type deleted dish ids — sync must not resurrect these. */
  eventMenuRemovedIds?: Record<string, string[]>
  /** Extra event types added in Menu prices (beyond Excel / defaults). */
  customEventTypes?: string[]
  /** Prep checklist per event. */
  prepChecklists?: Record<string, PrepTask[]>
  /** Who worked each event. */
  eventParticipants?: Record<string, EventParticipant[]>
  /** Uploaded PayPal QR image (data URL) — set in Developer Studio. */
  paypalQrDataUrl?: string
  /** ISO time when PayPal QR was last set/cleared — wins sync merges. */
  paypalQrUpdatedAt?: string
  /** Team to-dos with due dates + reminder flags. */
  teamTodos?: TeamTodo[]
  /** Main goal + milestones. */
  teamGoals?: TeamGoal[]
  /** eventId → stockItemId → qty reserved for that event. */
  eventStock?: Record<string, Record<string, number>>
  /**
   * Food made per stall day: eventId → yyyy-mm-dd → itemKey → made/used qty.
   * Remaining = made − used − spoiled (prep batches, litres of sambar/chai, …).
   */
  foodMade?: Record<string, Record<string, Record<string, FoodMadeRow>>>
  /** Prep → menu portion yields + ingredients. */
  recipes?: Recipe[]
  /** Menu sale → warehouse auto-use mapping. */
  stockAutoUse?: StockAutoUseRule[]
  /** Order ids already applied for auto-use (idempotent). */
  stockAutoUseApplied?: string[]
  /**
   * One-shot E012 (Aug 2026) catch-up: pending→sold + line prices.
   * Must not keep rewriting Flohmarkt catalogs for later stalls.
   */
  e012CatchupV1?: string
  /** Personal inboxes for reminder emails (set by Jeeva in Account). */
  notifyEmails?: TeamNotifyEmails
  /** Internal team chat (synced). */
  teamChat?: TeamChatMessage[]
  /** Internal announcements (synced). */
  announcements?: TeamAnnouncement[]
  /** Scanned / photographed business cards. */
  businessCards?: BusinessCard[]
  /** App event extras + patches (Applied / Confirmed / Rejected). */
  eventBook?: EventBook
  /** User calendar notes (synced). */
  calendarNotes?: CalendarNote[]
}

export interface BusinessCard {
  id: string
  name: string
  company?: string
  role?: string
  phone?: string
  email?: string
  notes?: string
  /** Raw OCR dump (front+back). */
  extractedText?: string
  frontImageUrl?: string
  backImageUrl?: string
  eventId?: string
  createdAt: string
  updatedAt?: string
}

export interface TeamChatMessage {
  id: string
  from: string
  text: string
  createdAt: string
}

export interface TeamAnnouncement {
  id: string
  title: string
  body: string
  from: string
  createdAt: string
  pinned?: boolean
}

export type TeamMemberName = 'Sriram' | 'Sneha' | 'Jeeva'

export type TeamNotifyEmails = Partial<Record<TeamMemberName, string>>

export interface TeamTodo {
  id: string
  text: string
  done: boolean
  assignee: PrepAssignee
  /** Due date yyyy-mm-dd (Germany calendar). */
  dueYmd: string
  /** Optional due time HH:mm (24h Germany). */
  dueTime?: string
  /** ISO when 24h reminder email was sent. */
  reminded24hAt?: string
  /** ISO when 2h reminder email was sent. */
  reminded2hAt?: string
  createdAt: string
  /** ISO — used to merge cloud/local without wiping Done items. */
  updatedAt?: string
}

export interface GoalMilestone {
  id: string
  label: string
  done: boolean
  /** Optional target amount (€) for progress display. */
  targetAmount?: number
  /** Optional due date yyyy-mm-dd. */
  dueDate?: string
}

export interface TeamGoal {
  id: string
  title: string
  /** Where we are now (free text or current €). */
  currentNote: string
  /** Main target amount € (optional). */
  targetAmount?: number
  /** Current progress amount € (optional). */
  currentAmount?: number
  milestones: GoalMilestone[]
}

const KEY = 'nasta-stall-ops-v1'

export const DEFAULT_STOCK: StockItem[] = [
  { id: 'plates', name: 'Plates', unit: 'pcs', lowAt: 20, bought: 0, used: 0 },
  { id: 'idly-bowl', name: 'Idly bowl', unit: 'pcs', lowAt: 5, bought: 0, used: 0 },
  { id: 'cauli-bowl', name: 'Cauliflower bowl', unit: 'pcs', lowAt: 5, bought: 0, used: 0 },
  { id: 'lassi-cup', name: 'Lassi cup', unit: 'pcs', lowAt: 10, bought: 0, used: 0 },
  { id: 'chai-cup', name: 'Masala chai cup', unit: 'pcs', lowAt: 10, bought: 0, used: 0 },
  { id: 'cauli-packet', name: 'Cauliflower packet', unit: 'pcs', lowAt: 3, bought: 0, used: 0 },
  { id: 'salad-packet', name: 'Salad packet', unit: 'pcs', lowAt: 3, bought: 0, used: 0 },
  { id: 'cabbage', name: 'Cabbage', unit: 'pcs', lowAt: 2, bought: 0, used: 0 },
  { id: 'dosa-batter', name: 'Dosa batter', unit: 'batch', lowAt: 1, bought: 0, used: 0 },
  { id: 'idli-batter', name: 'Idli batter', unit: 'batch', lowAt: 1, bought: 0, used: 0 },
  { id: 'chutney', name: 'Tomato chutney', unit: 'bowl', lowAt: 2, bought: 0, used: 0 },
  { id: 'sambar', name: 'Sambar', unit: 'pot', lowAt: 1, bought: 0, used: 0 },
]

export const DEFAULT_MENU: MenuItem[] = [
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
    foodCost: 3.5,
    drinkCostChai: 0.6,
    drinkCostLassi: 1.2,
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
    foodCost: 4.2,
    drinkCostChai: 0.6,
    drinkCostLassi: 1.2,
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
    foodCost: 5.0,
    drinkCostChai: 0.6,
    drinkCostLassi: 1.2,
  },
  {
    id: 'masala-dosa',
    name: 'Ghee Masala dosa',
    nameDe: 'Ghee Masala Dosa',
    kind: 'single',
    price: 8,
    foodCost: 2.8,
    description:
      'A traditional South Indian golden crispy dosa filled with a flavorful spiced potato masala.',
    descriptionDe:
      'Traditionelle südindische goldene knusprige Dosa mit würzigem Kartoffelmasala.',
    ingredients: 'Rice & urad dal batter, potato, onion, mustard seeds, curry leaves, turmeric, ghee',
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
    foodCost: 3.4,
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
    foodCost: 2.2,
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
    foodCost: 2.0,
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
    foodCost: 1.8,
    description: 'Crispy cauliflower florets marinated in a bold South Indian spice blend.',
    descriptionDe: 'Knusprige Blumenkohlröschen in kräftiger südindischer Marinade.',
    ingredients: 'Cauliflower, Indian flour, chili, garlic, ginger, curry leaves, spices',
    ingredientsDe: 'Blumenkohl, indisches Mehl, Chili, Knoblauch, Ingwer, Curryblätter, Gewürze',
    vegan: true,
    vegetarian: true,
    glutenFree: false,
  },
  {
    id: 'medu-vada',
    name: 'Medu Vada',
    nameDe: 'Medu Vada',
    kind: 'single',
    price: 3,
    foodCost: 1.0,
    contents: '2 Pieces',
    contentsDe: '2 Stück',
    description: 'Crispy outside, soft inside — classic South Indian lentil fritters (2 pieces).',
    descriptionDe: 'Außen knusprig, innen weich — klassische südindische Linsenpuffer (2 Stück).',
    ingredients: 'Urad dal, onion, chili, curry leaves, oil',
    ingredientsDe: 'Urad Dal, Zwiebel, Chili, Curryblätter, Öl',
    vegan: true,
    vegetarian: true,
    glutenFree: true,
  },
  {
    id: 'masala-chai',
    name: 'Masala chai',
    nameDe: 'Masala Chai',
    kind: 'single',
    price: 2,
    foodCost: 0.6,
    contents: 'Traditional Indian Spiced Tea',
    description: 'Freshly brewed Indian tea infused with a fragrant blend of spices.',
    descriptionDe: 'Frisch gebrühter indischer Tee mit aromatischen Gewürzen.',
    ingredients: 'Black tea, milk, ginger, cardamom, cloves, sugar',
    ingredientsDe: 'Schwarzer Tee, Milch, Ingwer, Kardamom, Nelken, Zucker',
    vegan: false,
    vegetarian: true,
    glutenFree: true,
  },
  {
    id: 'mango-lassi',
    name: 'Mango lassi',
    nameDe: 'Mango-Lassi',
    kind: 'single',
    price: 3.5,
    foodCost: 1.2,
    description: 'Cool yogurt drink blended with sweet mango.',
    descriptionDe: 'Kühler Joghurt-Drink mit süßer Mango.',
    ingredients: 'Yogurt, mango pulp, sugar, cardamom',
    ingredientsDe: 'Joghurt, Mangopüree, Zucker, Kardamom',
    vegan: false,
    vegetarian: true,
    glutenFree: true,
  },
]

export const DEFAULT_PREP_TASKS: Omit<PrepTask, 'id'>[] = [
  { text: 'Batter ready (dosa / idli)', done: false, assignee: 'Jeeva' },
  { text: 'Tomato chutney + sambar', done: false, assignee: 'Sneha' },
  { text: 'Gazebo / tables / float', done: false, assignee: 'Sriram' },
  { text: 'Cups, plates, napkins', done: false, assignee: '' },
  { text: 'Chai + lassi stocked', done: false, assignee: '' },
]

export function drinkLabel(drink: DrinkChoice): string {
  return drink === 'chai' ? 'Masala chai' : 'Mango lassi'
}

/** Split combo contents string into editable item lines. */
export function parseComboContents(contents?: string): string[] {
  if (!contents?.trim()) return []
  return contents
    .split(/\s*[+·,|]\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinComboContents(items: string[]): string {
  return items.map((s) => s.trim()).filter(Boolean).join(' + ')
}

export function lineKey(menuItemId: string, drink?: DrinkChoice): string {
  return drink ? `${menuItemId}:${drink}` : menuItemId
}

export function comboLineName(item: MenuItem, drink: DrinkChoice): string {
  return `${item.name} · ${drinkLabel(drink)}`
}

/** Common stall types — always offered in Menu prices even before Excel loads. */
export const DEFAULT_EVENT_TYPES = ['Flohmarkt', 'Streetfood Festival', 'Gourmet'] as const

/**
 * Synonyms share one menu/price catalog.
 * Gourmet Festival → Gourmet; Street Festival → Streetfood Festival.
 */
const EVENT_TYPE_ALIAS_TO_CANONICAL: Record<string, string> = {
  flohmarkt: 'Flohmarkt',
  gourmet: 'Gourmet',
  'gourmet festival': 'Gourmet',
  'gourmet-festival': 'Gourmet',
  streetfood: 'Streetfood Festival',
  'streetfood festival': 'Streetfood Festival',
  'street food festival': 'Streetfood Festival',
  'street festival': 'Streetfood Festival',
  'street-festival': 'Streetfood Festival',
}

/** Excel stall ids like E012 — never a menu/price type. */
export function isEventIdKey(name: string | undefined | null): boolean {
  return /^E\d+$/i.test(String(name || '').trim())
}

/** Normalize event type label for price/menu keys (aliases collapse to canonical). */
export function eventTypeKey(name: string | undefined | null): string {
  const raw = (name || '').trim()
  if (!raw) return ''
  const mapped = EVENT_TYPE_ALIAS_TO_CANONICAL[raw.toLowerCase()]
  return mapped || raw
}

const SNAPSHOT_LOCAL_KEY = 'nasta-snapshot-v3'

/** Excel + event-book rows from this device — used to remap E012 → Flohmarkt. */
export function loadCachedStallEvents(
  eventBook?: EventBook | null,
): { id: string; name: string; location?: string }[] {
  let excel: EventRow[] = []
  try {
    const raw = localStorage.getItem(demoStorageKey(SNAPSHOT_LOCAL_KEY))
    if (raw) {
      const snap = JSON.parse(raw) as { events?: EventRow[] }
      if (Array.isArray(snap.events)) {
        excel = snap.events.filter((e) => e && String(e.id || '').trim())
      }
    }
  } catch {
    /* ignore */
  }
  return mergeEventRows(excel, eventBook).map((e) => ({
    id: e.id,
    name: e.name,
    location: e.location,
  }))
}

/** Storage keys that may hold data for a canonical type (incl. old alias names). */
export function eventTypeStorageKeys(eventType: string | undefined): string[] {
  const key = eventTypeKey(eventType)
  if (!key) return []
  const keys = new Set<string>([key])
  for (const [alias, canon] of Object.entries(EVENT_TYPE_ALIAS_TO_CANONICAL)) {
    if (canon !== key) continue
    keys.add(canon)
    // Preserve common spellings that may already exist in saved stall_ops
    if (alias === 'gourmet festival') keys.add('Gourmet Festival')
    if (alias === 'street festival') keys.add('Street Festival')
    if (alias === 'street food festival') keys.add('Street Food Festival')
    if (alias === 'streetfood festival') keys.add('Streetfood Festival')
    if (alias === 'gourmet') keys.add('Gourmet')
    if (alias === 'flohmarkt') keys.add('Flohmarkt')
  }
  return [...keys]
}

function pickTypeMapEntry<T>(
  bag: Record<string, T> | undefined,
  eventType: string | undefined,
  isPresent: (v: T) => boolean,
): T | undefined {
  if (!bag) return undefined
  for (const k of eventTypeStorageKeys(eventType)) {
    const v = bag[k]
    if (v != null && isPresent(v)) return v
  }
  const want = eventTypeKey(eventType)
  if (!want) return undefined
  for (const [k, v] of Object.entries(bag)) {
    if (eventTypeKey(k) === want && v != null && isPresent(v)) return v
  }
  return undefined
}

/** Move alias keys (Gourmet Festival, Street Festival, …) onto the canonical type. */
export function consolidateEventTypeMaps(
  eventMenus: Record<string, MenuItem[]> | undefined,
  eventPrices: Record<string, Record<string, EventPriceOverride>> | undefined,
  eventTypeHiddenMenu: Record<string, string[]> | undefined,
  eventMenuRemovedIds?: Record<string, string[]>,
  eventMenusRev?: Record<string, number>,
): {
  eventMenus: Record<string, MenuItem[]>
  eventPrices: Record<string, Record<string, EventPriceOverride>>
  eventTypeHiddenMenu: Record<string, string[]>
  eventMenuRemovedIds: Record<string, string[]>
  eventMenusRev: Record<string, number>
  changed: boolean
} {
  const removed = normalizeTypeIdLists(eventMenuRemovedIds)
  const menus = applyMenuRemovals(normalizeEventMenus(eventMenus), removed)
  const prices = normalizeEventPrices(eventPrices)
  const hidden = normalizeHiddenMenu(eventTypeHiddenMenu)
  const revs = normalizeMenuRevs(eventMenusRev)
  const changed =
    JSON.stringify(menus) !== JSON.stringify(eventMenus || {}) ||
    JSON.stringify(prices) !== JSON.stringify(eventPrices || {}) ||
    JSON.stringify(hidden) !== JSON.stringify(eventTypeHiddenMenu || {}) ||
    JSON.stringify(removed) !== JSON.stringify(eventMenuRemovedIds || {}) ||
    JSON.stringify(revs) !== JSON.stringify(eventMenusRev || {})
  return {
    eventMenus: menus,
    eventPrices: prices,
    eventTypeHiddenMenu: hidden,
    eventMenuRemovedIds: removed,
    eventMenusRev: revs,
    changed,
  }
}

/**
 * Pull event type from Excel name / location text.
 * Excel usually has type in `name` and city in `location`; some rows combine both.
 */
export function extractEventType(
  name: string | undefined,
  location: string | undefined,
  knownTypes: string[],
): string {
  const n = (name || '').trim()
  const loc = (location || '').trim()
  if (!n && !loc) return ''

  // Prefer matching known / canonical types (longest first)
  const known = [
    ...new Set([
      ...knownTypes.map(eventTypeKey).filter(Boolean),
      ...Object.values(EVENT_TYPE_ALIAS_TO_CANONICAL),
      ...Object.keys(EVENT_TYPE_ALIAS_TO_CANONICAL),
    ]),
  ].sort((a, b) => b.length - a.length)

  const nLower = n.toLowerCase()
  for (const t of known) {
    if (t.toLowerCase() === nLower) return eventTypeKey(t)
  }

  const hay = `${n} ${loc}`.toLowerCase()
  for (const t of known) {
    if (hay.includes(t.toLowerCase())) return eventTypeKey(t)
  }

  if (n && loc) {
    const escaped = loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const stripped = n
      .replace(new RegExp(`^${escaped}\\s*[-·,/]?\\s*`, 'i'), '')
      .replace(new RegExp(`\\s*[-·,/]?\\s*${escaped}$`, 'i'), '')
      .trim()
    if (stripped && stripped.toLowerCase() !== nLower) {
      const k = eventTypeKey(stripped)
      return isEventIdKey(k) ? '' : k
    }
  }

  if (n && n.toLowerCase() !== 'setup') {
    const k = eventTypeKey(n)
    return isEventIdKey(k) ? '' : k
  }
  return ''
}

/** Resolve price/menu key from selected stall → event type. */
export function priceKeyForEvent(
  eventId: string | undefined,
  events: { id: string; name: string; location?: string }[],
  knownTypes?: string[],
): string {
  if (!eventId) return ''
  const ev = events.find((e) => e.id === eventId)
  if (!ev) {
    // Events not loaded yet — never treat E012 as a type (Menu prices would lock on it).
    return isEventIdKey(eventId) ? '' : eventTypeKey(eventId)
  }
  const known = knownTypes?.length ? knownTypes : [...DEFAULT_EVENT_TYPES]
  const t = extractEventType(ev.name, ev.location, known) || eventTypeKey(ev.name)
  if (t && !isEventIdKey(t)) return t
  return ''
}

/** Unique event types: defaults + Excel + custom (aliases collapsed). */
export function listEventTypes(
  events: { name: string; location?: string }[],
  customTypes?: string[],
): string[] {
  const knownSeed = [
    ...DEFAULT_EVENT_TYPES,
    ...(customTypes || []).map(eventTypeKey).filter(Boolean),
    ...events.map((e) => eventTypeKey(e.name)).filter(Boolean),
  ]
  const set = new Set<string>()
  for (const t of DEFAULT_EVENT_TYPES) set.add(t)
  for (const t of customTypes || []) {
    const k = eventTypeKey(t)
    if (k) set.add(k)
  }
  for (const e of events) {
    const k = extractEventType(e.name, e.location, knownSeed)
    if (k && k.toLowerCase() !== 'setup' && !isEventIdKey(k)) set.add(k)
  }
  const defaults = new Set<string>(DEFAULT_EVENT_TYPES)
  const extras = [...set]
    .filter((t) => !defaults.has(t))
    .sort((a, b) => a.localeCompare(b))
  return [...DEFAULT_EVENT_TYPES, ...extras]
}

/** Clone base menu and apply legacy type price / hide rules. */
export function seedMenuForEventType(
  baseMenu: MenuItem[],
  eventType: string,
  eventPrices?: Record<string, Record<string, EventPriceOverride>>,
  hidden?: Record<string, string[]>,
): MenuItem[] {
  const key = eventTypeKey(eventType)
  const hideList =
    pickTypeMapEntry(hidden, key, (v) => Array.isArray(v) && v.length > 0) || []
  const hide = new Set(hideList)
  const prices =
    pickTypeMapEntry(eventPrices, key, (v) => Boolean(v && Object.keys(v).length)) || {}
  return baseMenu
    .filter((m) => !m.hidden && !hide.has(m.id))
    .map((m) => {
      const ov = prices[m.id]
      if (m.kind === 'combo') {
        const chai = ov?.priceWithChai ?? m.priceWithChai ?? m.price
        const lassi = ov?.priceWithLassi ?? m.priceWithLassi ?? m.price
        return {
          ...m,
          price: chai,
          priceWithChai: chai,
          priceWithLassi: lassi,
          hidden: false,
        }
      }
      return { ...m, price: ov?.price ?? m.price, hidden: false }
    })
}

/** Menu for POS / editor: saved type menu, or seeded from defaults + legacy overrides. */
export function menuForEventType(
  eventType: string | undefined,
  eventMenus: Record<string, MenuItem[]> | undefined,
  baseMenu: MenuItem[],
  eventPrices?: Record<string, Record<string, EventPriceOverride>>,
  hidden?: Record<string, string[]>,
): MenuItem[] {
  const key = eventTypeKey(eventType)
  if (!key) return baseMenu.filter((m) => !m.hidden)
  const saved = pickTypeMapEntry(eventMenus, key, (v) => Array.isArray(v))
  if (saved) return saved.filter((m) => !m.hidden)
  return seedMenuForEventType(baseMenu, key, eventPrices, hidden)
}

export function isHiddenForEventType(
  itemId: string,
  eventType: string | undefined,
  hidden: Record<string, string[]> | undefined,
): boolean {
  const key = eventTypeKey(eventType)
  if (!key || !hidden) return false
  const list = pickTypeMapEntry(hidden, key, (v) => Array.isArray(v)) || []
  return list.includes(itemId)
}

/** Overrides for a stall: type key first, then legacy per-event-id. */
export function overridesForPriceKey(
  priceKey: string | undefined,
  eventPrices: Record<string, Record<string, EventPriceOverride>> | undefined,
  legacyEventId?: string,
): Record<string, EventPriceOverride> | undefined {
  if (!eventPrices) return undefined
  const fromType = pickTypeMapEntry(
    eventPrices,
    priceKey,
    (v) => Boolean(v && Object.keys(v).length),
  )
  if (fromType) return fromType
  if (legacyEventId && eventPrices[legacyEventId]) return eventPrices[legacyEventId]
  return undefined
}

export function resolveMenuPrice(
  item: MenuItem,
  /** Event type key (preferred) or legacy event id. */
  priceKey: string | undefined,
  eventPrices: Record<string, Record<string, EventPriceOverride>> | undefined,
  drink?: DrinkChoice,
  /** When priceKey is a type, still honor old per-stall overrides. */
  legacyEventId?: string,
): number {
  const bag = overridesForPriceKey(priceKey, eventPrices, legacyEventId)
  const ov = bag?.[item.id]
  if (item.kind === 'combo') {
    const d = drink || 'chai'
    if (d === 'chai') {
      const v = ov?.priceWithChai ?? item.priceWithChai ?? item.price
      return Math.max(0, Number(v) || 0)
    }
    const v = ov?.priceWithLassi ?? item.priceWithLassi ?? item.price
    return Math.max(0, Number(v) || 0)
  }
  const v = ov?.price ?? item.price
  return Math.max(0, Number(v) || 0)
}

export function makeOrderLine(
  item: MenuItem,
  qty: number,
  eventId: string | undefined,
  eventPrices: Record<string, Record<string, EventPriceOverride>> | undefined,
  drink?: DrinkChoice,
): OrderLine {
  const d = item.kind === 'combo' ? drink || 'chai' : undefined
  return {
    menuItemId: item.id,
    name: d ? comboLineName(item, d) : item.name,
    price: resolveMenuPrice(item, eventId, eventPrices, d),
    qty,
    drink: d,
  }
}

/** Estimated cost for one unit (combo includes drink cost). */
export function unitFoodCost(item: MenuItem, drink?: DrinkChoice): number {
  const base = Math.max(0, Number(item.foodCost) || 0)
  if (item.kind !== 'combo') return base
  const d = drink || 'chai'
  const drinkCost =
    d === 'chai'
      ? Math.max(0, Number(item.drinkCostChai) || 0)
      : Math.max(0, Number(item.drinkCostLassi) || 0)
  return Math.round((base + drinkCost) * 100) / 100
}

export function comboMarginEuro(
  item: MenuItem,
  eventId: string | undefined,
  eventPrices: Record<string, Record<string, EventPriceOverride>> | undefined,
  drink: DrinkChoice,
): { price: number; cost: number; margin: number; marginPct: number } {
  const price = resolveMenuPrice(item, eventId, eventPrices, drink)
  const cost = unitFoodCost(item, drink)
  const margin = Math.round((price - cost) * 100) / 100
  const marginPct = price > 0 ? Math.round((margin / price) * 1000) / 10 : 0
  return { price, cost, margin, marginPct }
}

export function activeOrders(orders: StallOrder[]): StallOrder[] {
  return orders.filter((o) => !o.voided)
}

function normalizeOrderStatus(raw: unknown): OrderStatus {
  if (raw === 'completed') return 'completed'
  if (raw === 'awaiting_claim') return 'awaiting_claim'
  return 'pending'
}

export function normalizeOrder(o: Partial<StallOrder> & { id?: string }): StallOrder {
  return {
    id: o.id || newId('ord'),
    label: o.label || '',
    status: normalizeOrderStatus(o.status),
    lines: (o.lines || []).map((l) => {
      const qty = Math.max(0, Number(l.qty) || 0)
      const deliveredRaw = l.deliveredQty != null ? Number(l.deliveredQty) : undefined
      const deliveredQty =
        deliveredRaw != null && Number.isFinite(deliveredRaw)
          ? Math.max(0, Math.min(qty, Math.round(deliveredRaw)))
          : undefined
      return {
        menuItemId: l.menuItemId,
        name: l.name,
        price: Number(l.price) || 0,
        qty,
        drink: l.drink === 'chai' || l.drink === 'lassi' ? l.drink : undefined,
        deliveredQty,
      }
    }),
    createdAt: o.createdAt || new Date().toISOString(),
    completedAt: o.completedAt,
    eventId: o.eventId || undefined,
    paid: o.paid != null ? Number(o.paid) : undefined,
    tip: o.tip != null ? Number(o.tip) : undefined,
    change: o.change != null ? Number(o.change) : undefined,
    payMethod:
      o.payMethod === 'paypal' || o.payMethod === 'cash' ? (o.payMethod as PayMethod) : undefined,
    voided: Boolean(o.voided),
    voidReason: o.voidReason || undefined,
    voidedAt: o.voidedAt || undefined,
    source: o.source === 'customer' || o.source === 'pos' ? o.source : undefined,
    claimCode: o.claimCode ? String(o.claimCode).replace(/\D/g, '').slice(0, 4) : undefined,
    claimedAt: o.claimedAt,
    customerName: o.customerName ? String(o.customerName).trim().slice(0, 60) : undefined,
    updatedAt:
      typeof o.updatedAt === 'string' && o.updatedAt.trim()
        ? o.updatedAt.trim()
        : undefined,
    paidAt: typeof o.paidAt === 'string' && o.paidAt.trim() ? o.paidAt.trim() : undefined,
  }
}

/** Drop unclaimed QR orders older than TTL. */
export function pruneExpiredClaims(
  orders: StallOrder[],
  now = Date.now(),
  ttlMs = CLAIM_TTL_MS,
): StallOrder[] {
  return orders.filter((o) => {
    if (o.status !== 'awaiting_claim') return true
    const t = new Date(o.createdAt).getTime()
    if (!Number.isFinite(t)) return false
    return now - t <= ttlMs
  })
}

export function generateClaimCode(orders: StallOrder[]): string {
  const used = new Set(
    orders
      .filter((o) => o.status === 'awaiting_claim' && o.claimCode)
      .map((o) => o.claimCode!),
  )
  for (let i = 0; i < 40; i++) {
    const code = String(1000 + Math.floor(Math.random() * 9000))
    if (!used.has(code)) return code
  }
  return String(Date.now() % 9000).padStart(4, '0')
}

/** Pending kitchen tickets only (not awaiting claim). */
export function kitchenPending(orders: StallOrder[]): StallOrder[] {
  return orders
    .filter((o) => o.status === 'pending' && !o.voided)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** How many pending tickets are ahead (0 = next up). */
export function queueAheadCount(orders: StallOrder[], orderId: string): number {
  const pending = kitchenPending(orders)
  const idx = pending.findIndex((o) => o.id === orderId)
  if (idx < 0) return 0
  return idx
}

const MAX_DELETED_ORDER_IDS = 500

function normalizeDeletedOrderIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of raw) {
    const id = String(x || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out.slice(-MAX_DELETED_ORDER_IDS)
}

/** Newest mutation clock for sync (updatedAt wins over status rank). */
export function orderRevisionMs(o: StallOrder): number {
  const candidates = [o.updatedAt, o.voidedAt, o.claimedAt, o.completedAt, o.createdAt]
  let max = 0
  for (const raw of candidates) {
    const t = Date.parse(String(raw || ''))
    if (Number.isFinite(t) && t > max) max = t
  }
  return max
}

export function touchOrder(o: StallOrder, patch: Partial<StallOrder> = {}): StallOrder {
  return {
    ...o,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
}

function preferOrder(a: StallOrder, b: StallOrder): StallOrder {
  const rank = (s: OrderStatus) =>
    s === 'completed' ? 3 : s === 'pending' ? 2 : s === 'awaiting_claim' ? 1 : 0
  // Voided / refunded must win so a stale non-voided cloud copy can’t reopen kitchen tickets.
  if (a.voided && !b.voided) return a
  if (b.voided && !a.voided) return b
  // Newest revision wins — allows completed → pending (“Back to pending”).
  const aT = orderRevisionMs(a)
  const bT = orderRevisionMs(b)
  if (aT !== bT) return aT > bT ? a : b
  // Tie: prefer richer status only as a last resort.
  if (rank(a.status) !== rank(b.status)) {
    return rank(a.status) >= rank(b.status) ? a : b
  }
  return a
}

/**
 * Merge remote + local order bags (tickets + delete tombstones).
 * Tombstones win: a deleted id never reappears from the other side.
 */
export function mergeStallOrderBags(
  remote: { orders?: StallOrder[]; deletedOrderIds?: string[] },
  local: { orders?: StallOrder[]; deletedOrderIds?: string[] },
): { orders: StallOrder[]; deletedOrderIds: string[] } {
  const deletedOrderIds = normalizeDeletedOrderIds([
    ...(remote.deletedOrderIds || []),
    ...(local.deletedOrderIds || []),
  ])
  const deleted = new Set(deletedOrderIds)
  const map = new Map<string, StallOrder>()
  for (const o of remote.orders || []) {
    const n = normalizeOrder(o)
    if (!n.id || deleted.has(n.id)) continue
    map.set(n.id, n)
  }
  for (const o of local.orders || []) {
    const n = normalizeOrder(o)
    if (!n.id || deleted.has(n.id)) continue
    const prev = map.get(n.id)
    map.set(n.id, prev ? preferOrder(n, prev) : n)
  }
  const orders = relabelDuplicateCustomers(
    pruneExpiredClaims([...map.values()]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )
  return { orders, deletedOrderIds }
}

/** Keep restocks and deductions from both devices (used/bought only go up). */
export function mergeStockItems(
  remote: StockItem[] | undefined,
  local: StockItem[] | undefined,
): StockItem[] {
  const map = new Map<string, StockItem>()
  for (const s of remote || []) {
    const id = String(s?.id || '').trim()
    if (!id) continue
    map.set(id, { ...s, id })
  }
  for (const s of local || []) {
    const id = String(s?.id || '').trim()
    if (!id) continue
    const prev = map.get(id)
    if (!prev) {
      map.set(id, { ...s, id })
      continue
    }
    map.set(id, {
      ...prev,
      ...s,
      id,
      bought: Math.max(Number(prev.bought) || 0, Number(s.bought) || 0),
      used: Math.max(Number(prev.used) || 0, Number(s.used) || 0),
    })
  }
  return [...map.values()]
}

/**
 * After a two-device merge, the same stall/day can have two "Customer 5" labels.
 * Keep the earlier ticket’s number and give later ones the next free slot.
 */
export function relabelDuplicateCustomers(orders: StallOrder[]): StallOrder[] {
  const groups = new Map<string, StallOrder[]>()
  for (const o of orders) {
    if (o.voided || o.status === 'awaiting_claim') continue
    if (parseCustomerNumber(o.label) <= 0) continue
    const day = germanyYmd(new Date(o.createdAt))
    const eid = String(o.eventId || '').trim()
    const key = `${eid}|${day}`
    const list = groups.get(key) || []
    list.push(o)
    groups.set(key, list)
  }
  const rename = new Map<string, string>()
  for (const list of groups.values()) {
    const sorted = [...list].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    )
    const used = new Set<number>()
    for (const o of sorted) {
      let n = parseCustomerNumber(o.label)
      if (used.has(n)) {
        while (used.has(n)) n += 1
        rename.set(o.id, customerLabel(n))
      }
      used.add(n)
    }
  }
  if (!rename.size) return orders
  return orders.map((o) => {
    const label = rename.get(o.id)
    return label ? { ...o, label } : o
  })
}

/** Merge remote + local orders so QR place/claim don’t wipe each other. */
export function mergeStallOrders(
  remote: StallOrder[],
  local: StallOrder[],
  deletedOrderIds?: string[],
): StallOrder[] {
  return mergeStallOrderBags(
    { orders: remote, deletedOrderIds },
    { orders: local, deletedOrderIds },
  ).orders
}

/** Record a hard delete so sync cannot resurrect the ticket. */
export function withDeletedOrder(
  state: StallOpsState,
  orderId: string,
): StallOpsState {
  const id = String(orderId || '').trim()
  if (!id) return state
  const deletedOrderIds = normalizeDeletedOrderIds([
    ...(state.deletedOrderIds || []),
    id,
  ])
  return {
    ...state,
    orders: (state.orders || []).filter((o) => o.id !== id),
    deletedOrderIds,
  }
}

export function claimOrderByCode(
  orders: StallOrder[],
  code: string,
  stallEventId?: string,
): { orders: StallOrder[]; claimed: StallOrder | null; error?: string } {
  const cleaned = String(code || '').replace(/\D/g, '').slice(0, 4)
  if (cleaned.length !== 4) {
    return { orders, claimed: null, error: 'Enter the 4-digit code from the customer.' }
  }
  const pruned = pruneExpiredClaims(orders)
  const scope = String(stallEventId || '').trim()
  const matchesCode = (o: StallOrder) =>
    o.claimCode === cleaned && !o.voided

  // Prefer this stall’s waiting ticket only — never claim the other same-day stall.
  let hit = pruned.find((o) => {
    if (o.status !== 'awaiting_claim' || !matchesCode(o)) return false
    if (!scope) return true
    return String(o.eventId || '').trim() === scope
  })
  if (!hit) {
    const anyWaiting = pruned.filter(
      (o) => o.status === 'awaiting_claim' && matchesCode(o),
    )
    if (!scope && anyWaiting.length === 1) hit = anyWaiting[0]
    else if (scope && anyWaiting.length > 0) {
      const other = anyWaiting.find((o) => String(o.eventId || '').trim() !== scope)
      const otherId = String(other?.eventId || '').trim()
      return {
        orders: pruned,
        claimed: null,
        error: otherId
          ? `This code is for stall ${otherId}. Switch Event menu to ${otherId}, then claim.`
          : 'Code not found for this stall. Pick the correct Event menu, or ask the guest to place again.',
      }
    }
  }
  if (!hit) {
    const inScope = (o: StallOrder) =>
      !scope || String(o.eventId || '').trim() === scope
    const alreadyPending = pruned.find(
      (o) => o.status === 'pending' && matchesCode(o) && inScope(o),
    )
    if (alreadyPending) {
      return {
        orders: pruned,
        claimed: null,
        error: `Already claimed as ${alreadyPending.label}. Open Pending.`,
      }
    }
    const alreadyDone = pruned.find(
      (o) => o.status === 'completed' && matchesCode(o) && inScope(o),
    )
    if (alreadyDone) {
      return {
        orders: pruned,
        claimed: null,
        error: `Code already used (${alreadyDone.label} — completed).`,
      }
    }
    const other = pruned.find(
      (o) => matchesCode(o) && !o.voided && !inScope(o),
    )
    const otherId = String(other?.eventId || '').trim()
    if (scope && otherId) {
      return {
        orders: pruned,
        claimed: null,
        error: `This code is for stall ${otherId}. Switch Event menu to ${otherId}, then claim.`,
      }
    }
    return {
      orders: pruned,
      claimed: null,
      error: scope
        ? 'Code not found for this stall. Pick the correct Event menu, or ask the guest to place again.'
        : 'Code not found. Ask the guest to place again (codes expire after 30 minutes).',
    }
  }
  const claimEventId = String(hit.eventId || scope || '').trim() || undefined
  const n = nextCustomerNumber(pruned, new Date(), claimEventId)
  const now = new Date().toISOString()
  const claimed: StallOrder = {
    ...hit,
    status: 'pending',
    label: customerLabel(n),
    claimedAt: now,
    updatedAt: now,
    eventId: claimEventId || hit.eventId,
  }
  return {
    orders: pruned.map((o) => (o.id === hit.id ? claimed : o)),
    claimed,
  }
}

export function remainingOf(item: StockItem): number {
  return Math.max(0, (item.bought || 0) - (item.used || 0))
}

export function isLowStock(item: StockItem): boolean {
  return remainingOf(item) <= (item.lowAt ?? 0)
}

export function orderTotal(lines: OrderLine[]): number {
  return Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100
}

function dietFlag(raw: unknown, fallback?: boolean): boolean {
  if (raw === true || raw === false) return raw
  return Boolean(fallback)
}

/** Stall recipe: Gobi 65 (and Combo 3) are vegan — no yogurt. */
function forceVeganIds(id: string): boolean {
  return id === 'gobi-65' || id === 'combo-3'
}

/** Blumenkohl/Gobi 65 uses Indian flour — not gluten free (all combos include it). */
function forceNotGlutenFreeIds(id: string): boolean {
  return (
    id === 'gobi-65' ||
    id === 'combo-1' ||
    id === 'combo-2' ||
    id === 'combo-3'
  )
}

/** Refresh stale coconut/yogurt/chutney/old-combo copy from defaults. */
function pickMenuText(saved: string | undefined, def: string | undefined): string | undefined {
  const s = String(saved || '').trim()
  const d = String(def || '').trim()
  if (!d) return s || undefined
  if (!s) return d
  if (/coconut|kokos|yogurt|joghurt/i.test(s)) return d
  if (/\bchutney\b/i.test(s) && !/tomato|tomaten/i.test(s) && /tomato|tomaten/i.test(d)) {
    return d
  }
  // Combos are always main + Blumenkohl 65 + drink — replace old chutney/sambar packs.
  if (
    /blumenkohl|gobi\s*65/i.test(d) &&
    !/blumenkohl|gobi\s*65/i.test(s) &&
    /(chutney|sambar)/i.test(s)
  ) {
    return d
  }
  return s
}

function normalizeMenuItem(raw: Partial<MenuItem> & { id: string }): MenuItem {
  const def = DEFAULT_MENU.find((d) => d.id === raw.id)
  const kind: MenuKind =
    raw.kind === 'combo' || raw.kind === 'single'
      ? raw.kind
      : def?.kind === 'combo' || /^combo-\d+$/i.test(raw.id)
        ? 'combo'
        : 'single'
  const price = Math.max(0, Number(raw.price ?? def?.price) || 0)
  const diet = {
    vegan: forceVeganIds(raw.id) ? true : dietFlag(raw.vegan, def?.vegan),
    vegetarian: forceVeganIds(raw.id)
      ? true
      : dietFlag(raw.vegetarian, def?.vegetarian),
    glutenFree: forceNotGlutenFreeIds(raw.id)
      ? false
      : dietFlag(raw.glutenFree, def?.glutenFree),
  }
  const de = {
    nameDe: (raw.nameDe ?? def?.nameDe ?? '').trim() || undefined,
    contentsDe: pickMenuText(raw.contentsDe, def?.contentsDe),
    descriptionDe: pickMenuText(raw.descriptionDe, def?.descriptionDe),
    ingredientsDe: pickMenuText(raw.ingredientsDe, def?.ingredientsDe),
  }
  if (kind === 'combo') {
    return {
      id: raw.id,
      name: raw.name || def?.name || raw.id,
      kind: 'combo',
      price,
      priceWithChai: Math.max(
        0,
        Number(raw.priceWithChai ?? def?.priceWithChai ?? price) || 0,
      ),
      priceWithLassi: Math.max(
        0,
        Number(raw.priceWithLassi ?? def?.priceWithLassi ?? price) || 0,
      ),
      contents: pickMenuText(raw.contents, def?.contents),
      description: pickMenuText(raw.description, def?.description),
      ingredients: pickMenuText(raw.ingredients, def?.ingredients),
      ...de,
      ...diet,
      imageUrl: normalizeMenuImageUrl(raw.imageUrl ?? def?.imageUrl),
      foodCost: Math.max(0, Number(raw.foodCost ?? def?.foodCost) || 0),
      drinkCostChai: Math.max(0, Number(raw.drinkCostChai ?? def?.drinkCostChai) || 0),
      drinkCostLassi: Math.max(0, Number(raw.drinkCostLassi ?? def?.drinkCostLassi) || 0),
      hidden: Boolean(raw.hidden ?? def?.hidden),
      hideFromCustomer: Boolean(raw.hideFromCustomer ?? def?.hideFromCustomer),
      soldOut: Boolean(raw.soldOut ?? def?.soldOut),
    }
  }
  return {
    id: raw.id,
    name: raw.name || def?.name || raw.id,
    kind: 'single',
    price,
    contents: pickMenuText(raw.contents, def?.contents),
    description: pickMenuText(raw.description, def?.description),
    ingredients: pickMenuText(raw.ingredients, def?.ingredients),
    ...de,
    ...diet,
    imageUrl: normalizeMenuImageUrl(raw.imageUrl ?? def?.imageUrl),
    foodCost: Math.max(0, Number(raw.foodCost ?? def?.foodCost) || 0) || undefined,
    hidden: Boolean(raw.hidden ?? def?.hidden),
    hideFromCustomer: Boolean(raw.hideFromCustomer ?? def?.hideFromCustomer),
    soldOut: Boolean(raw.soldOut ?? def?.soldOut),
    publicSection: raw.publicSection ?? def?.publicSection,
  }
}

/** Overlay local dish fields (prices, names) onto a remote item. */
export function mergeMenuItemPreferLocal(remote: MenuItem, local: MenuItem): MenuItem {
  return {
    ...remote,
    ...local,
    imageUrl: local.imageUrl || remote.imageUrl,
  }
}

/**
 * Local catalog wins on membership + prices.
 * Pass `appendMissingFromRemote` for the base menu so new default dishes still appear.
 * Event-type menus must NOT append — that resurrected deleted dishes on refresh.
 */
export function mergeMenuListsPreferLocal(
  remote: MenuItem[] | undefined,
  local: MenuItem[] | undefined,
  opts?: { appendMissingFromRemote?: boolean },
): MenuItem[] {
  const r = remote || []
  if (!Array.isArray(local)) return r
  const l = local
  if (!r.length) return l
  const remById = new Map(r.map((m) => [m.id, m]))
  const seen = new Set<string>()
  const out: MenuItem[] = []
  for (const item of l) {
    const rem = remById.get(item.id)
    out.push(rem ? mergeMenuItemPreferLocal(rem, item) : item)
    seen.add(item.id)
  }
  if (opts?.appendMissingFromRemote) {
    for (const item of r) {
      if (seen.has(item.id)) continue
      out.push(item)
    }
  }
  return out
}

export function mergeEventPriceMaps(
  remote: Record<string, Record<string, EventPriceOverride>> | undefined,
  local: Record<string, Record<string, EventPriceOverride>> | undefined,
): Record<string, Record<string, EventPriceOverride>> {
  const r = normalizeEventPrices(remote)
  const l = normalizeEventPrices(local)
  const keys = new Set([...Object.keys(r), ...Object.keys(l)])
  const out: Record<string, Record<string, EventPriceOverride>> = {}
  for (const k of keys) {
    out[k] = { ...(r[k] || {}), ...(l[k] || {}) }
  }
  return out
}

function normalizeTypeIdLists(
  raw: Record<string, string[]> | undefined,
): Record<string, string[]> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string[]> = {}
  for (const [type, ids] of Object.entries(raw)) {
    const key = eventTypeKey(type)
    if (!key || !Array.isArray(ids)) continue
    const prev = out[key] || []
    out[key] = [...new Set([...prev, ...ids.map((id) => String(id)).filter(Boolean)])]
  }
  return out
}

function normalizeMenuRevs(raw: Record<string, number> | undefined): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [type, ts] of Object.entries(raw)) {
    const key = eventTypeKey(type) || String(type || '').trim()
    if (!key) continue
    const n = Number(ts) || 0
    out[key] = Math.max(out[key] || 0, n)
  }
  return out
}

function applyMenuRemovals(
  menus: Record<string, MenuItem[]>,
  removed: Record<string, string[]>,
): Record<string, MenuItem[]> {
  if (!removed || !Object.keys(removed).length) return menus
  const out: Record<string, MenuItem[]> = {}
  for (const [type, list] of Object.entries(menus)) {
    const key = eventTypeKey(type) || type
    const drop = new Set(removed[key] || [])
    out[type] = drop.size ? list.filter((m) => !drop.has(m.id)) : list
  }
  return out
}

/** Prefer the newer per-type catalog (rev) so a slow cloud round-trip cannot undo an edit. */
export function mergeEventMenuState(
  remote: Pick<StallOpsState, 'eventMenus' | 'eventMenusRev' | 'eventMenuRemovedIds'>,
  local: Pick<StallOpsState, 'eventMenus' | 'eventMenusRev' | 'eventMenuRemovedIds'>,
): Pick<StallOpsState, 'eventMenus' | 'eventMenusRev' | 'eventMenuRemovedIds'> {
  const rMenus = normalizeEventMenus(remote.eventMenus)
  const lMenus = normalizeEventMenus(local.eventMenus)
  const rRev = normalizeMenuRevs(remote.eventMenusRev)
  const lRev = normalizeMenuRevs(local.eventMenusRev)
  const rRemoved = normalizeTypeIdLists(remote.eventMenuRemovedIds)
  const lRemoved = normalizeTypeIdLists(local.eventMenuRemovedIds)
  const removedUnion: Record<string, string[]> = {}
  for (const k of new Set([...Object.keys(rRemoved), ...Object.keys(lRemoved)])) {
    removedUnion[k] = [...new Set([...(rRemoved[k] || []), ...(lRemoved[k] || [])])]
  }
  const keys = new Set([
    ...Object.keys(rMenus),
    ...Object.keys(lMenus),
    ...Object.keys(rRev),
    ...Object.keys(lRev),
  ])
  const eventMenus: Record<string, MenuItem[]> = {}
  const eventMenusRev: Record<string, number> = {}
  for (const k of keys) {
    const lr = lRev[k] || 0
    const rr = rRev[k] || 0
    eventMenusRev[k] = Math.max(lr, rr)
    let list: MenuItem[]
    if (lr > rr && Object.prototype.hasOwnProperty.call(lMenus, k)) {
      list = lMenus[k] ?? []
    } else if (rr > lr && Object.prototype.hasOwnProperty.call(rMenus, k)) {
      list = rMenus[k] ?? []
    } else if (Object.prototype.hasOwnProperty.call(lMenus, k)) {
      list = mergeMenuListsPreferLocal(rMenus[k], lMenus[k] ?? [])
    } else {
      list = rMenus[k] ?? []
    }
    const drop = new Set(removedUnion[k] || [])
    eventMenus[k] = drop.size ? list.filter((m) => !drop.has(m.id)) : list
  }
  return {
    eventMenus,
    eventMenusRev,
    eventMenuRemovedIds: removedUnion,
  }
}

/** Prefer local event-type catalogs after a public-menu sync (remote can be stale). */
export function mergeEventMenuMaps(
  remote: Record<string, MenuItem[]> | undefined,
  local: Record<string, MenuItem[]> | undefined,
): Record<string, MenuItem[]> {
  return mergeEventMenuState({ eventMenus: remote }, { eventMenus: local }).eventMenus || {}
}

function normalizeMenuImageUrl(raw: unknown): string | undefined {
  const s = String(raw || '').trim()
  if (!s) return undefined
  if (s.startsWith('data:image/') && s.length <= 1_200_000) return s
  if (/^https?:\/\//i.test(s) && s.length <= 2000) return s
  return undefined
}

/** Merge saved menu with defaults so new combos appear for everyone. Preserves saved order. */
export function mergeMenu(raw: Partial<MenuItem>[] | undefined | null): MenuItem[] {
  const byId = new Map<string, MenuItem>()
  for (const d of DEFAULT_MENU) byId.set(d.id, { ...d })
  if (Array.isArray(raw)) {
    for (const r of raw) {
      if (!r?.id) continue
      const prev = byId.get(r.id)
      byId.set(r.id, normalizeMenuItem({ ...prev, ...r, id: r.id }))
    }
  }
  if (Array.isArray(raw) && raw.length) {
    const ordered: MenuItem[] = []
    const seen = new Set<string>()
    for (const r of raw) {
      if (!r?.id || seen.has(r.id)) continue
      const item = byId.get(r.id)
      if (!item) continue
      ordered.push(item)
      seen.add(r.id)
    }
    for (const d of DEFAULT_MENU) {
      if (seen.has(d.id)) continue
      ordered.push(byId.get(d.id)!)
      seen.add(d.id)
    }
    for (const [id, item] of byId) {
      if (seen.has(id)) continue
      ordered.push(item)
    }
    return ordered
  }
  return DEFAULT_MENU.map((d) => byId.get(d.id)!)
}

function normalizeEventPrices(
  raw: StallOpsState['eventPrices'],
): Record<string, Record<string, EventPriceOverride>> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, Record<string, EventPriceOverride>> = {}
  for (const [eventId, items] of Object.entries(raw)) {
    if (!items || typeof items !== 'object') continue
    // Collapse aliases (Gourmet Festival → Gourmet); keep legacy event ids as-is
    const isLegacy = /^E\d+$/i.test(eventId.trim())
    const key = isLegacy ? eventId.trim() : eventTypeKey(eventId) || eventId
    const canonicalWins = isLegacy || eventId === key
    if (!out[key]) out[key] = {}
    for (const [itemId, ov] of Object.entries(items)) {
      if (!ov || typeof ov !== 'object') continue
      const incoming: EventPriceOverride = {}
      if (ov.price != null && Number.isFinite(Number(ov.price))) {
        incoming.price = Math.max(0, Number(ov.price))
      }
      if (ov.priceWithChai != null && Number.isFinite(Number(ov.priceWithChai))) {
        incoming.priceWithChai = Math.max(0, Number(ov.priceWithChai))
      }
      if (ov.priceWithLassi != null && Number.isFinite(Number(ov.priceWithLassi))) {
        incoming.priceWithLassi = Math.max(0, Number(ov.priceWithLassi))
      }
      if (!Object.keys(incoming).length) continue
      const prev = out[key][itemId] || {}
      // Canonical key overwrites; alias only fills fields the canonical list lacks.
      out[key][itemId] = canonicalWins ? { ...prev, ...incoming } : { ...incoming, ...prev }
    }
  }
  return out
}

export function emptyStallOps(): StallOpsState {
  return {
    stock: DEFAULT_STOCK.map((s) => ({ ...s })),
    menu: DEFAULT_MENU.map((m) => ({ ...m })),
    orders: [],
    deletedOrderIds: [],
    activeEventId: '',
    publicMenuKey: '',
    publicMenuLabel: '',
    eventOrderLinks: {},
    eventPrices: {},
    eventTypeHiddenMenu: {},
    eventMenus: {},
    eventMenusRev: {},
    eventMenuRemovedIds: {},
    customEventTypes: [],
    prepChecklists: {},
    eventParticipants: {},
    paypalQrDataUrl: '',
    paypalQrUpdatedAt: '',
    teamTodos: [],
    teamGoals: [],
    eventStock: {},
    foodMade: {},
    recipes: [],
    stockAutoUse: [],
    stockAutoUseApplied: [],
    notifyEmails: {},
    teamChat: [],
    announcements: [],
    businessCards: [],
    eventBook: emptyEventBook(),
    calendarNotes: [],
  }
}

/**
 * Prefer the newer PayPal QR so sync can’t resurrect an old image.
 * `untiedPrefer`: when neither side has a timestamp, prefer that side
 * (use `'b'` / remote on refresh, `'a'` / local on save).
 */
export function preferPaypalQr(
  a: Pick<StallOpsState, 'paypalQrDataUrl' | 'paypalQrUpdatedAt'>,
  b: Pick<StallOpsState, 'paypalQrDataUrl' | 'paypalQrUpdatedAt'>,
  untiedPrefer: 'a' | 'b' = 'a',
): { paypalQrDataUrl: string; paypalQrUpdatedAt: string } {
  const aAt = Date.parse(String(a.paypalQrUpdatedAt || '')) || 0
  const bAt = Date.parse(String(b.paypalQrUpdatedAt || '')) || 0
  const aUrl =
    typeof a.paypalQrDataUrl === 'string' && a.paypalQrDataUrl.startsWith('data:image/')
      ? a.paypalQrDataUrl
      : ''
  const bUrl =
    typeof b.paypalQrDataUrl === 'string' && b.paypalQrDataUrl.startsWith('data:image/')
      ? b.paypalQrDataUrl
      : ''
  // Explicit clear (empty url + newer timestamp) must beat a stale image.
  if (aAt > bAt) {
    return { paypalQrDataUrl: aUrl, paypalQrUpdatedAt: a.paypalQrUpdatedAt || '' }
  }
  if (bAt > aAt) {
    return { paypalQrDataUrl: bUrl, paypalQrUpdatedAt: b.paypalQrUpdatedAt || '' }
  }
  if (aUrl && bUrl) {
    return untiedPrefer === 'b'
      ? { paypalQrDataUrl: bUrl, paypalQrUpdatedAt: b.paypalQrUpdatedAt || '' }
      : { paypalQrDataUrl: aUrl, paypalQrUpdatedAt: a.paypalQrUpdatedAt || '' }
  }
  if (aUrl) return { paypalQrDataUrl: aUrl, paypalQrUpdatedAt: a.paypalQrUpdatedAt || '' }
  if (bUrl) return { paypalQrDataUrl: bUrl, paypalQrUpdatedAt: b.paypalQrUpdatedAt || '' }
  return { paypalQrDataUrl: '', paypalQrUpdatedAt: '' }
}

function normalizeTeamChat(raw: StallOpsState['teamChat']): TeamChatMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m) => m && typeof m === 'object')
    .map((m) => ({
      id: String(m.id || newId('chat')),
      from: String(m.from || 'Team').slice(0, 40),
      text: String(m.text || '').trim().slice(0, 1000),
      createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString(),
    }))
    .filter((m) => m.text)
    .slice(0, 300)
}

function normalizeAnnouncements(raw: StallOpsState['announcements']): TeamAnnouncement[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({
      id: String(a.id || newId('ann')),
      title: String(a.title || 'Note').trim().slice(0, 120),
      body: String(a.body || '').trim().slice(0, 2000),
      from: String(a.from || 'Team').slice(0, 40),
      createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date().toISOString(),
      pinned: Boolean(a.pinned),
    }))
    .filter((a) => a.title || a.body)
    .slice(0, 80)
}

function normalizeBusinessCards(raw: StallOpsState['businessCards']): BusinessCard[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((c) => c && typeof c === 'object')
    .map((c) => {
      const front =
        typeof c.frontImageUrl === 'string' && c.frontImageUrl.startsWith('data:image/')
          ? c.frontImageUrl
          : undefined
      const back =
        typeof c.backImageUrl === 'string' && c.backImageUrl.startsWith('data:image/')
          ? c.backImageUrl
          : undefined
      return {
        id: String(c.id || newId('card')),
        name: String(c.name || 'Contact').trim().slice(0, 120),
        company: c.company ? String(c.company).trim().slice(0, 120) : undefined,
        role: c.role ? String(c.role).trim().slice(0, 80) : undefined,
        phone: c.phone ? String(c.phone).trim().slice(0, 40) : undefined,
        email: c.email ? String(c.email).trim().slice(0, 120) : undefined,
        notes: c.notes ? String(c.notes).trim().slice(0, 1000) : undefined,
        extractedText: c.extractedText
          ? String(c.extractedText).trim().slice(0, 4000)
          : undefined,
        frontImageUrl: front,
        backImageUrl: back,
        eventId: c.eventId ? String(c.eventId).trim().slice(0, 40) : undefined,
        createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
        updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : undefined,
      }
    })
    .filter((c) => c.name || c.frontImageUrl || c.backImageUrl)
    .slice(0, 200)
}

function normalizeHiddenMenu(
  raw: StallOpsState['eventTypeHiddenMenu'],
): Record<string, string[]> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string[]> = {}
  for (const [type, ids] of Object.entries(raw)) {
    const key = eventTypeKey(type)
    if (!key || !Array.isArray(ids)) continue
    const prev = out[key] || []
    out[key] = [...new Set([...prev, ...ids.map((id) => String(id)).filter(Boolean)])]
  }
  return out
}

/** Normalize a saved type menu without re-injecting global defaults. */
export function normalizeMenuList(raw: Partial<MenuItem>[] | undefined | null): MenuItem[] {
  if (!Array.isArray(raw) || !raw.length) return []
  const ordered: MenuItem[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    const id = r?.id
    if (!id || seen.has(id)) continue
    ordered.push(normalizeMenuItem({ ...r, id }))
    seen.add(id)
  }
  return ordered
}

function normalizeEventMenus(
  raw: StallOpsState['eventMenus'],
): Record<string, MenuItem[]> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, MenuItem[]> = {}
  for (const [type, items] of Object.entries(raw)) {
    const key = eventTypeKey(type)
    if (!key || !Array.isArray(items)) continue
    if (!items.length) {
      if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = []
      continue
    }
    const list = normalizeMenuList(items as Partial<MenuItem>[])
    const prev = out[key]
    if (!prev) {
      out[key] = list
      continue
    }
    // Alias keys (Gourmet Festival → Gourmet) used to replace the whole catalog
    // when lengths matched — that wiped a just-edited price on refresh.
    // Canonical key wins; otherwise keep the first list and overlay its prices.
    out[key] =
      type === key
        ? mergeMenuListsPreferLocal(prev, list)
        : mergeMenuListsPreferLocal(list, prev)
  }
  return out
}

type EventMenuRehomeSlice = {
  eventMenus?: Record<string, MenuItem[]>
  eventPrices?: Record<string, Record<string, EventPriceOverride>>
  eventTypeHiddenMenu?: Record<string, string[]>
  eventMenuRemovedIds?: Record<string, string[]>
  eventMenusRev?: Record<string, number>
  publicMenuKey?: string
  activeEventId?: string
  customEventTypes?: string[]
  eventBook?: EventBook
}

/**
 * Move leftover stall-id catalogs (E012, …) onto the real event type
 * (Flohmarkt / Streetfood Festival / Gourmet) so Menu prices and New order share one list.
 */
export function rehomeEventIdMenuState(
  slice: EventMenuRehomeSlice,
  events?: { id: string; name: string; location?: string }[],
): {
  eventMenus: Record<string, MenuItem[]>
  eventPrices: Record<string, Record<string, EventPriceOverride>>
  eventTypeHiddenMenu: Record<string, string[]>
  eventMenuRemovedIds: Record<string, string[]>
  eventMenusRev: Record<string, number>
  publicMenuKey: string
  changed: boolean
} {
  const evs = events?.length ? events : loadCachedStallEvents(slice.eventBook)
  const menus = { ...normalizeEventMenus(slice.eventMenus) }
  const prices = { ...normalizeEventPrices(slice.eventPrices) }
  const hidden = { ...normalizeHiddenMenu(slice.eventTypeHiddenMenu) }
  const removed = { ...normalizeTypeIdLists(slice.eventMenuRemovedIds) }
  const revs = { ...normalizeMenuRevs(slice.eventMenusRev) }
  let publicMenuKey = String(slice.publicMenuKey || '')
  const known = [
    ...DEFAULT_EVENT_TYPES,
    ...(slice.customEventTypes || []).map(eventTypeKey).filter(Boolean),
  ]

  const idKeys = new Set<string>()
  for (const bag of [menus, prices, hidden, removed, revs]) {
    for (const k of Object.keys(bag)) {
      if (isEventIdKey(k)) idKeys.add(k)
    }
  }
  if (isEventIdKey(publicMenuKey)) idKeys.add(publicMenuKey)

  let changed = false
  if (evs.length) {
    for (const idKey of idKeys) {
      const type = priceKeyForEvent(idKey, evs, known)
      if (!type || isEventIdKey(type) || type === idKey) continue
      changed = true

      if (Object.prototype.hasOwnProperty.call(menus, idKey)) {
        const idList = menus[idKey] || []
        const typeExists = Object.prototype.hasOwnProperty.call(menus, type)
        // Never overlay a leftover E012 catalog onto Flohmarkt/Gourmet — that
        // put stale 8/9€ prices back over a just-typed 7/8€ edit and bumped
        // rev so cloud sync treated the old list as newer.
        if (!typeExists) {
          menus[type] = idList
          revs[type] = Math.max(revs[type] || 0, revs[idKey] || 0)
        }
        delete menus[idKey]
      }

      if (prices[idKey]) {
        prices[type] = { ...(prices[idKey] || {}), ...(prices[type] || {}) }
        delete prices[idKey]
      }

      if (hidden[idKey]?.length) {
        hidden[type] = [...new Set([...(hidden[type] || []), ...hidden[idKey]])]
        delete hidden[idKey]
      }

      if (removed[idKey]?.length) {
        removed[type] = [...new Set([...(removed[type] || []), ...removed[idKey]])]
        delete removed[idKey]
      }

      delete revs[idKey]
    }
  }

  const menusAfter = applyMenuRemovals(menus, removed)

  if (isEventIdKey(publicMenuKey) && evs.length) {
    const t = priceKeyForEvent(slice.activeEventId || publicMenuKey, evs, known)
    if (t && !isEventIdKey(t)) {
      publicMenuKey = t
      changed = true
    }
  }

  return {
    eventMenus: menusAfter,
    eventPrices: prices,
    eventTypeHiddenMenu: hidden,
    eventMenuRemovedIds: removed,
    eventMenusRev: revs,
    publicMenuKey,
    changed,
  }
}

/** Apply stall-id → event-type remapping; same reference when nothing moved. */
export function applyEventMenuRehome<T extends StallOpsState>(
  state: T,
  events?: { id: string; name: string; location?: string }[],
): T {
  const next = rehomeEventIdMenuState(state, events)
  if (!next.changed) return state
  return {
    ...state,
    eventMenus: next.eventMenus,
    eventPrices: next.eventPrices,
    eventTypeHiddenMenu: next.eventTypeHiddenMenu,
    eventMenuRemovedIds: next.eventMenuRemovedIds,
    eventMenusRev: next.eventMenusRev,
    publicMenuKey: next.publicMenuKey,
  }
}

export function hasEventIdMenuKeys(state: EventMenuRehomeSlice | undefined): boolean {
  if (!state) return false
  for (const bag of [
    state.eventMenus,
    state.eventPrices,
    state.eventTypeHiddenMenu,
    state.eventMenuRemovedIds,
    state.eventMenusRev,
  ]) {
    if (!bag) continue
    if (Object.keys(bag).some((k) => isEventIdKey(k))) return true
  }
  return isEventIdKey(state.publicMenuKey)
}

/** True when localStorage still has E012-style catalogs that need a write. */
export function rawStallOpsHasEventIdKeys(): boolean {
  try {
    const raw = localStorage.getItem(demoStorageKey(KEY))
    if (!raw) return false
    return hasEventIdMenuKeys(JSON.parse(raw) as EventMenuRehomeSlice)
  } catch {
    return false
  }
}

function normalizeCustomEventTypes(raw: StallOpsState['customEventTypes']): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  const defaults = new Set(
    (DEFAULT_EVENT_TYPES as readonly string[]).map((t) => t.toLowerCase()),
  )
  for (const t of raw) {
    const key = eventTypeKey(String(t || ''))
    if (!key || isEventIdKey(key) || seen.has(key.toLowerCase()) || defaults.has(key.toLowerCase()))
      continue
    seen.add(key.toLowerCase())
    out.push(key)
  }
  return out
}

function normalizeNotifyEmails(raw: StallOpsState['notifyEmails']): TeamNotifyEmails {
  if (!raw || typeof raw !== 'object') return {}
  const out: TeamNotifyEmails = {}
  for (const name of ['Sriram', 'Sneha', 'Jeeva'] as const) {
    const v = String(raw[name] || '')
      .trim()
      .toLowerCase()
    if (v.includes('@')) out[name] = v
  }
  return out
}

function normalizeTodos(raw: StallOpsState['teamTodos']): TeamTodo[] {
  if (!Array.isArray(raw)) return []
  return raw.map((t) => ({
    id: t.id || newId('todo'),
    text: String(t.text || '').trim() || 'Task',
    done: Boolean(t.done),
    assignee:
      t.assignee === 'Jeeva' || t.assignee === 'Sriram' || t.assignee === 'Sneha'
        ? t.assignee
        : '',
    dueYmd: typeof t.dueYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.dueYmd) ? t.dueYmd : '',
    dueTime:
      typeof t.dueTime === 'string' && /^\d{2}:\d{2}$/.test(t.dueTime) ? t.dueTime : undefined,
    reminded24hAt: t.reminded24hAt,
    reminded2hAt: t.reminded2hAt,
    createdAt: t.createdAt || new Date().toISOString(),
    updatedAt:
      typeof t.updatedAt === 'string' && t.updatedAt
        ? t.updatedAt
        : t.createdAt || new Date().toISOString(),
  }))
}

function todoStamp(t: TeamTodo): number {
  return Date.parse(t.updatedAt || t.createdAt || '') || 0
}

/** Union todos by id — newer updatedAt wins so Done items aren’t wiped by stale sync. */
export function mergeTeamTodos(a: TeamTodo[] | undefined, b: TeamTodo[] | undefined): TeamTodo[] {
  const map = new Map<string, TeamTodo>()
  for (const t of [...(a || []), ...(b || [])]) {
    if (!t?.id) continue
    const prev = map.get(t.id)
    if (!prev) {
      map.set(t.id, t)
      continue
    }
    const prevTs = todoStamp(prev)
    const nextTs = todoStamp(t)
    if (nextTs > prevTs) {
      map.set(t.id, t)
    } else if (nextTs === prevTs) {
      // Same age: keep Done / richer reminder state.
      if (t.done && !prev.done) map.set(t.id, t)
      else if (t.done === prev.done) {
        map.set(t.id, {
          ...prev,
          ...t,
          reminded24hAt: t.reminded24hAt || prev.reminded24hAt,
          reminded2hAt: t.reminded2hAt || prev.reminded2hAt,
        })
      }
    }
  }
  return [...map.values()].sort((x, y) => {
    if (x.done !== y.done) return x.done ? 1 : -1
    return `${x.dueYmd}${x.dueTime || ''}`.localeCompare(`${y.dueYmd}${y.dueTime || ''}`)
  })
}

function normalizeGoals(raw: StallOpsState['teamGoals']): TeamGoal[] {
  if (!Array.isArray(raw)) return []
  return raw.map((g) => ({
    id: g.id || newId('goal'),
    title: String(g.title || '').trim() || 'Goal',
    currentNote: String(g.currentNote || ''),
    targetAmount:
      g.targetAmount != null && Number.isFinite(Number(g.targetAmount))
        ? Math.max(0, Number(g.targetAmount))
        : undefined,
    currentAmount:
      g.currentAmount != null && Number.isFinite(Number(g.currentAmount))
        ? Math.max(0, Number(g.currentAmount))
        : undefined,
    milestones: Array.isArray(g.milestones)
      ? g.milestones.map((m) => {
          const due = String(m.dueDate || '').slice(0, 10)
          return {
            id: m.id || newId('ms'),
            label: String(m.label || '').trim() || 'Milestone',
            done: Boolean(m.done),
            targetAmount:
              m.targetAmount != null && Number.isFinite(Number(m.targetAmount))
                ? Math.max(0, Number(m.targetAmount))
                : undefined,
            ...(due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? { dueDate: due } : {}),
          }
        })
      : [],
  }))
}

function normalizeEventStock(
  raw: StallOpsState['eventStock'],
): Record<string, Record<string, number>> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, Record<string, number>> = {}
  for (const [eventId, items] of Object.entries(raw)) {
    if (!items || typeof items !== 'object') continue
    out[eventId] = {}
    for (const [itemId, qty] of Object.entries(items)) {
      const n = Math.max(0, Number(qty) || 0)
      if (n > 0) out[eventId][itemId] = n
    }
  }
  return out
}

const SPOIL_REASONS: SpoilReason[] = ['leftover', 'burnt', 'weather', 'other']

function normalizeSpoilReason(raw: unknown): SpoilReason | undefined {
  return SPOIL_REASONS.includes(raw as SpoilReason) ? (raw as SpoilReason) : undefined
}

function normalizeFoodMade(
  raw: StallOpsState['foodMade'],
): NonNullable<StallOpsState['foodMade']> {
  if (!raw || typeof raw !== 'object') return {}
  const out: NonNullable<StallOpsState['foodMade']> = {}
  for (const [eventId, days] of Object.entries(raw)) {
    const eid = String(eventId || '').trim()
    if (!eid || !days || typeof days !== 'object') continue
    out[eid] = {}
    for (const [day, items] of Object.entries(days)) {
      const d = String(day || '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !items || typeof items !== 'object') continue
      out[eid][d] = {}
      for (const [itemKey, row] of Object.entries(items)) {
        if (!row || typeof row !== 'object') continue
        const made = Math.max(0, Math.round((Number(row.made) || 0) * 100) / 100)
        let used = Math.max(0, Math.round((Number(row.used) || 0) * 100) / 100)
        let spoiled = Math.max(0, Math.round((Number(row.spoiled) || 0) * 100) / 100)
        const carriedIn = Math.max(
          0,
          Math.round((Number(row.carriedIn) || 0) * 100) / 100,
        )
        const name = String(row.name || itemKey).trim().slice(0, 80) || itemKey
        const unit = String(row.unit || 'pcs').trim().slice(0, 24) || 'pcs'
        const spoilReason = normalizeSpoilReason(row.spoilReason)
        if (used + spoiled > made && made > 0) {
          const scale = made / (used + spoiled)
          used = Math.round(used * scale * 100) / 100
          spoiled = Math.round((made - used) * 100) / 100
        }
        if (made <= 0 && used <= 0 && spoiled <= 0 && carriedIn <= 0 && !row.name) continue
        const entry: FoodMadeRow = {
          made,
          used: Math.min(used, made || used),
          name,
          unit,
        }
        if (spoiled > 0) entry.spoiled = spoiled
        if (spoilReason) entry.spoilReason = spoilReason
        if (carriedIn > 0) entry.carriedIn = carriedIn
        out[eid][d][itemKey] = entry
      }
      if (!Object.keys(out[eid][d]).length) delete out[eid][d]
    }
    if (!Object.keys(out[eid]).length) delete out[eid]
  }
  return out
}

function normalizeRecipes(raw: StallOpsState['recipes']): Recipe[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) => ({
      prepItemId: String(r?.prepItemId || '').trim(),
      batchSize: Math.max(0.1, Number(r?.batchSize) || 1),
      unit: String(r?.unit || 'batch').trim().slice(0, 24) || 'batch',
      yields: (r?.yields || [])
        .map((y) => ({
          menuItemId: String(y?.menuItemId || '').trim(),
          portions: Math.max(0, Number(y?.portions) || 0),
        }))
        .filter((y) => y.menuItemId && y.portions > 0),
      ingredients: (r?.ingredients || [])
        .map((ing) => ({
          itemId: String(ing?.itemId || '').trim(),
          qtyPerBatch: Math.max(0, Number(ing?.qtyPerBatch) || 0),
        }))
        .filter((ing) => ing.itemId && ing.qtyPerBatch > 0),
    }))
    .filter((r) => r.prepItemId)
}

function normalizeStockAutoUse(raw: StallOpsState['stockAutoUse']): StockAutoUseRule[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) => ({
      menuItemId: String(r?.menuItemId || '').trim(),
      stockItemId: String(r?.stockItemId || '').trim(),
      qtyPerSale: Math.max(0, Number(r?.qtyPerSale) || 0),
    }))
    .filter((r) => r.menuItemId && r.stockItemId && r.qtyPerSale > 0)
}

function normalizeParticipants(
  raw: StallOpsState['eventParticipants'],
): Record<string, EventParticipant[]> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, EventParticipant[]> = {}
  for (const [eventId, list] of Object.entries(raw)) {
    const id = String(eventId || '').trim()
    if (!id || !Array.isArray(list)) continue
    out[id] = list.filter(
      (n): n is EventParticipant => n === 'Jeeva' || n === 'Sriram' || n === 'Sneha',
    )
  }
  return out
}

function normalizeEventOrderLinks(
  raw: StallOpsState['eventOrderLinks'],
): Record<string, EventOrderLink> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, EventOrderLink> = {}
  for (const [eventId, link] of Object.entries(raw)) {
    const id = String(eventId || '').trim()
    if (!id || !link || typeof link !== 'object') continue
    const menuKey = String(link.menuKey || '').trim().slice(0, 80)
    const label = String(link.label || '').trim().slice(0, 160)
    if (!menuKey && !label) continue
    out[id] = { menuKey, label }
  }
  return out
}

export function normalizeStallOps(raw: Partial<StallOpsState> | null): StallOpsState {
  const base = emptyStallOps()
  if (!raw) return base
  const stock =
    Array.isArray(raw.stock) && raw.stock.length
      ? raw.stock.map((s) => {
          const expiresOn =
            typeof s.expiresOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.expiresOn.trim())
              ? s.expiresOn.trim()
              : undefined
          const kgPerUnit =
            s.kgPerUnit != null && Number.isFinite(Number(s.kgPerUnit)) && Number(s.kgPerUnit) > 0
              ? Number(s.kgPerUnit)
              : undefined
          const portionPerUnit =
            s.portionPerUnit != null &&
            Number.isFinite(Number(s.portionPerUnit)) &&
            Number(s.portionPerUnit) > 0
              ? Number(s.portionPerUnit)
              : undefined
          return {
            id: s.id,
            name: s.name || s.id,
            unit: s.unit || 'pcs',
            lowAt: Number(s.lowAt) || 0,
            bought: Math.max(0, Number(s.bought) || 0),
            used: Math.max(0, Number(s.used) || 0),
            expiresOn,
            kgPerUnit,
            portionPerUnit,
          }
        })
      : base.stock
  const menu = mergeMenu(raw.menu as Partial<MenuItem>[] | undefined)
  const deletedOrderIds = normalizeDeletedOrderIds(raw.deletedOrderIds)
  const deletedSet = new Set(deletedOrderIds)
  const orders = Array.isArray(raw.orders)
    ? pruneExpiredClaims(
        raw.orders
          .map((o) => normalizeOrder(o))
          .filter((o) => !deletedSet.has(o.id)),
      )
    : []
  const prepChecklists: Record<string, PrepTask[]> = {}
  if (raw.prepChecklists && typeof raw.prepChecklists === 'object') {
    for (const [eventId, tasks] of Object.entries(raw.prepChecklists)) {
      if (!Array.isArray(tasks)) continue
      prepChecklists[eventId] = tasks.map((t) => ({
        id: t.id || newId('prep'),
        text: t.text || '',
        done: Boolean(t.done),
        assignee:
          t.assignee === 'Jeeva' || t.assignee === 'Sriram' || t.assignee === 'Sneha'
            ? t.assignee
            : '',
      }))
    }
  }
  const eventBook = normalizeEventBook(raw.eventBook)
  const customEventTypes = normalizeCustomEventTypes(raw.customEventTypes)
  const remappedMenus = rehomeEventIdMenuState({
    eventMenus: applyMenuRemovals(
      normalizeEventMenus(raw.eventMenus),
      normalizeTypeIdLists(raw.eventMenuRemovedIds),
    ),
    eventPrices: normalizeEventPrices(raw.eventPrices),
    eventTypeHiddenMenu: normalizeHiddenMenu(raw.eventTypeHiddenMenu),
    eventMenuRemovedIds: normalizeTypeIdLists(raw.eventMenuRemovedIds),
    eventMenusRev: normalizeMenuRevs(raw.eventMenusRev),
    publicMenuKey: typeof raw.publicMenuKey === 'string' ? raw.publicMenuKey.slice(0, 80) : '',
    activeEventId: typeof raw.activeEventId === 'string' ? raw.activeEventId : '',
    customEventTypes,
    eventBook,
  })
  return {
    stock,
    menu,
    orders,
    deletedOrderIds,
    activeEventId: typeof raw.activeEventId === 'string' ? raw.activeEventId : '',
    publicMenuKey: remappedMenus.publicMenuKey,
    publicMenuLabel:
      typeof raw.publicMenuLabel === 'string' ? raw.publicMenuLabel.slice(0, 160) : '',
    eventOrderLinks: normalizeEventOrderLinks(raw.eventOrderLinks),
    eventPrices: remappedMenus.eventPrices,
    eventTypeHiddenMenu: remappedMenus.eventTypeHiddenMenu,
    eventMenus: remappedMenus.eventMenus,
    eventMenusRev: remappedMenus.eventMenusRev,
    eventMenuRemovedIds: remappedMenus.eventMenuRemovedIds,
    customEventTypes,
    prepChecklists,
    eventParticipants: normalizeParticipants(raw.eventParticipants),
    paypalQrDataUrl:
      typeof raw.paypalQrDataUrl === 'string' && raw.paypalQrDataUrl.startsWith('data:image/')
        ? raw.paypalQrDataUrl
        : '',
    paypalQrUpdatedAt:
      typeof raw.paypalQrUpdatedAt === 'string' ? raw.paypalQrUpdatedAt.slice(0, 40) : '',
    teamTodos: normalizeTodos(raw.teamTodos),
    teamGoals: normalizeGoals(raw.teamGoals),
    eventStock: normalizeEventStock(raw.eventStock),
    foodMade: normalizeFoodMade(raw.foodMade),
    recipes: normalizeRecipes(raw.recipes),
    stockAutoUse: normalizeStockAutoUse(raw.stockAutoUse),
    stockAutoUseApplied: Array.isArray(raw.stockAutoUseApplied)
      ? [...new Set(raw.stockAutoUseApplied.map((id) => String(id || '').trim()).filter(Boolean))].slice(
          0,
          2000,
        )
      : [],
    e012CatchupV1:
      typeof raw.e012CatchupV1 === 'string' && raw.e012CatchupV1.trim()
        ? raw.e012CatchupV1.trim().slice(0, 40)
        : undefined,
    notifyEmails: normalizeNotifyEmails(raw.notifyEmails),
    teamChat: normalizeTeamChat(raw.teamChat),
    announcements: normalizeAnnouncements(raw.announcements),
    businessCards: normalizeBusinessCards(raw.businessCards),
    eventBook,
    calendarNotes: normalizeCalendarNotes(raw.calendarNotes),
  }
}

const TAB_EVENT_KEY = 'nasta-tab-active-event-id'

function readTabActiveEventId(): string | undefined {
  try {
    const v = sessionStorage.getItem(demoStorageKey(TAB_EVENT_KEY))
    if (v === null) return undefined
    return v
  } catch {
    return undefined
  }
}

function writeTabActiveEventId(id: string) {
  try {
    sessionStorage.setItem(demoStorageKey(TAB_EVENT_KEY), String(id || ''))
  } catch {
    /* private mode */
  }
}

export function loadStallOps(): StallOpsState {
  try {
    const raw = localStorage.getItem(demoStorageKey(KEY))
    const ops = raw ? normalizeStallOps(JSON.parse(raw) as StallOpsState) : emptyStallOps()
    const tab = readTabActiveEventId()
    if (tab !== undefined) return { ...ops, activeEventId: tab }
    if (ops.activeEventId) writeTabActiveEventId(ops.activeEventId)
    return ops
  } catch {
    return emptyStallOps()
  }
}

/** Always the live POS blob — ignores demo sandbox prefix. */
export function loadLiveStallOps(): StallOpsState {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? normalizeStallOps(JSON.parse(raw) as StallOpsState) : emptyStallOps()
  } catch {
    return emptyStallOps()
  }
}

export function saveStallOpsLocal(state: StallOpsState) {
  writeTabActiveEventId(state.activeEventId || '')
  localStorage.setItem(demoStorageKey(KEY), JSON.stringify(state))
}

export function soldCounts(orders: StallOrder[]): { name: string; qty: number; revenue: number }[] {
  const map = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const o of orders.filter((x) => x.status === 'completed' && !x.voided)) {
    for (const l of o.lines) {
      const key = lineKey(l.menuItemId, l.drink)
      const cur = map.get(key) || { name: l.name, qty: 0, revenue: 0 }
      cur.qty += l.qty
      cur.revenue += l.qty * l.price
      cur.name = l.name
      map.set(key, cur)
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty)
}

/** Sold qty by menu line key for one stall day (Germany calendar). */
export function soldCountsForEventDay(
  orders: StallOrder[],
  eventId: string,
  dayYmd: string,
): { key: string; menuItemId: string; name: string; qty: number; revenue: number }[] {
  const eid = String(eventId || '').trim()
  const day = String(dayYmd || '').slice(0, 10)
  if (!eid || !day) return []
  const map = new Map<
    string,
    { key: string; menuItemId: string; name: string; qty: number; revenue: number }
  >()
  for (const o of orders) {
    if (o.status !== 'completed' || o.voided) continue
    if (String(o.eventId || '').trim() !== eid) continue
    const when = germanyYmd(new Date(o.completedAt || o.createdAt))
    if (when !== day) continue
    for (const l of o.lines) {
      const key = lineKey(l.menuItemId, l.drink)
      const cur = map.get(key) || {
        key,
        menuItemId: l.menuItemId,
        name: l.name,
        qty: 0,
        revenue: 0,
      }
      cur.qty += l.qty
      cur.revenue += l.qty * l.price
      cur.name = l.name
      map.set(key, cur)
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty)
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function defaultPrepChecklist(): PrepTask[] {
  return DEFAULT_PREP_TASKS.map((t) => ({ ...t, id: newId('prep') }))
}

/**
 * Next Customer N for today (Germany date). Resets to 1 each new day.
 * When `stallEventId` is set, numbering is per stall so two same-day events
 * each get their own Customer 1, 2, …
 */
export function nextCustomerNumber(
  orders: StallOrder[],
  now = new Date(),
  stallEventId?: string,
): number {
  const today = germanyTodayYmd(now)
  const scope = String(stallEventId || '').trim()
  let max = 0
  for (const o of orders) {
    if (scope && String(o.eventId || '').trim() !== scope) continue
    const day = germanyYmd(new Date(o.createdAt))
    if (day !== today) continue
    const m = /^Customer\s+(\d+)$/i.exec(o.label.trim())
    if (m) max = Math.max(max, Number(m[1]) || 0)
  }
  return max + 1
}

export function customerLabel(n: number): string {
  return `Customer ${n}`
}

/** Parse “Customer 12” → 12 (0 if not a numbered ticket). */
export function parseCustomerNumber(label: string): number {
  const m = /^Customer\s+(\d+)$/i.exec(String(label || '').trim())
  return m ? Number(m[1]) || 0 : 0
}

/** Kitchen-friendly: Customer 1, 2, 3… then by time. */
export function sortOrdersByCustomer(orders: StallOrder[]): StallOrder[] {
  return [...orders].sort((a, b) => {
    const na = parseCustomerNumber(a.label)
    const nb = parseCustomerNumber(b.label)
    if (na > 0 && nb > 0 && na !== nb) return na - nb
    if (na > 0 && nb <= 0) return -1
    if (na <= 0 && nb > 0) return 1
    return a.createdAt.localeCompare(b.createdAt)
  })
}

/** Totals view: group by stall, then Customer 1, 2, 3… within each stall. */
export function sortOrdersByEventThenCustomer(orders: StallOrder[]): StallOrder[] {
  return [...orders].sort((a, b) => {
    const ea = String(a.eventId || '').trim() || '\uffff'
    const eb = String(b.eventId || '').trim() || '\uffff'
    if (ea !== eb) return ea.localeCompare(eb, undefined, { numeric: true })
    const na = parseCustomerNumber(a.label)
    const nb = parseCustomerNumber(b.label)
    if (na > 0 && nb > 0 && na !== nb) return na - nb
    if (na > 0 && nb <= 0) return -1
    if (na <= 0 && nb > 0) return 1
    return a.createdAt.localeCompare(b.createdAt)
  })
}

/** Split paid tickets into event groups, each sorted by customer number. */
export function groupOrdersByEvent(orders: StallOrder[]): { eventId: string; orders: StallOrder[] }[] {
  const map = new Map<string, StallOrder[]>()
  for (const o of sortOrdersByEventThenCustomer(orders)) {
    const key = String(o.eventId || '').trim() || 'unassigned'
    const list = map.get(key) || []
    list.push(o)
    map.set(key, list)
  }
  return [...map.entries()].map(([eventId, list]) => ({
    eventId,
    orders: sortOrdersByCustomer(list),
  }))
}

/** Gaps in Customer 1…max among paid tickets (e.g. #63 exists but only 62 paid). */
export function missingCustomerNumbers(orders: StallOrder[]): number[] {
  const nums = new Set(
    orders.map((o) => parseCustomerNumber(o.label)).filter((n) => n > 0),
  )
  if (!nums.size) return []
  const max = Math.max(...nums)
  const missing: number[] = []
  for (let i = 1; i <= max; i++) {
    if (!nums.has(i)) missing.push(i)
  }
  return missing
}

export function slugId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `item-${Date.now()}`
  )
}
