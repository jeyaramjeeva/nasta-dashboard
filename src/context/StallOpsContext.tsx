import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { fetchStallOps, saveStallOpsCloud } from '../lib/cloudExtras'
import { flushAllOfflineOps, pushLocalStallOpsNow } from '../lib/flushOffline'
import {
  emptyEventBook,
  newEventId,
  normalizeEventBook,
  type CalendarNote,
  type EventBook,
} from '../lib/eventBook'
import { normalizeEventStatus } from '../lib/eventStatus'
import type { EventRow } from '../types'
import { enqueueOffline, offlineQueueCount } from '../lib/offlineQueue'
import { canDevelop, canManageStallEvents } from '../lib/authAllowlist'
import { isDemoMode } from '../lib/demoMode'
import {
  applyEventMenuRehome,
  rawStallOpsHasEventIdKeys,
  claimOrderByCode,
  consolidateEventTypeMaps,
  customerLabel,
  detectOrderConflicts,
  emptyStallOps,
  eventTypeKey,
  isEventIdKey,
  isLowStock,
  lineDeliveredQty,
  loadStallOps,
  menuForEventType,
  mergeEventMenuState,
  mergeEventPriceMaps,
  mergeMenuListsPreferLocal,
  mergeStallOrderBags,
  mergeStockItems,
  mergeTeamTodos,
  newId,
  nextCustomerNumber,
  orderFullyDelivered,
  orderTotal,
  preferPaypalQr,
  remainingOf,
  saveStallOpsLocal,
  seedMenuForEventType,
  slugId,
  stampCompletedAt,
  isCatchUpCompletion,
  touchOrder,
  withDeletedOrder,
  defaultPrepChecklist,
  type EventParticipant,
  type EventPriceOverride,
  type FoodMadeRow,
  type GoalMilestone,
  type MenuItem,
  type OrderConflict,
  type OrderLine,
  type PayMethod,
  type PrepAssignee,
  type PrepTask,
  type Recipe,
  type SpoilReason,
  type StallOpsState,
  type StallOrder,
  type StockAutoUseRule,
  type StockItem,
  type TeamAnnouncement,
  type TeamChatMessage,
  type TeamGoal,
  type TeamMemberName,
  type TeamNotifyEmails,
  type TeamTodo,
  type BusinessCard,
} from '../lib/stallOps'
import {
  autoUseQtyForOrder,
  mergeRecipes,
  mergeStockAutoUse,
  nextYmd,
  remainingFood,
  reverseAutoUseForOrder,
} from '../lib/stallRecipes'
import { isCloudConfigured } from '../lib/supabase'
import { isGuestName } from '../lib/guestAuth'
import { repairE012Catchup, type RepairOps } from '../../api/_lib/repairE012Catchup'
import { useAuth } from './AuthContext'

function applyE012Catchup(ops: StallOpsState, userName: string | undefined): StallOpsState {
  if (!userName || isGuestName(userName)) return ops
  const { next, summary } = repairE012Catchup(ops as unknown as RepairOps)
  if (!summary.changed) return ops
  return {
    ...ops,
    orders: (next.orders as StallOpsState['orders']) || ops.orders,
    e012CatchupV1: next.e012CatchupV1 || ops.e012CatchupV1,
  }
}

interface StallOpsContextValue {
  stock: StockItem[]
  menu: MenuItem[]
  orders: StallOrder[]
  recipes: Recipe[]
  setRecipe: (prepItemId: string, patch: Partial<Recipe>) => void
  stockAutoUse: StockAutoUseRule[]
  setStockAutoUse: (rules: StockAutoUseRule[]) => void
  activeEventId: string
  /** Event-type key currently shown on public `/order`. */
  publicMenuKey: string
  publicMenuLabel: string
  eventPrices: Record<string, Record<string, EventPriceOverride>>
  /** Event type → hidden menu item ids for New order. */
  eventTypeHiddenMenu: Record<string, string[]>
  /** Full menu per event type (saved separately). */
  eventMenus: Record<string, MenuItem[]>
  customEventTypes: string[]
  lowStock: StockItem[]
  syncing: boolean
  buyStock: (itemId: string, qty: number) => void
  useStock: (itemId: string, qty: number) => void
  setStockLowAt: (itemId: string, lowAt: number) => void
  addStockItem: (name: string, unit?: string, lowAt?: number) => void
  /** Edit name / unit / quantities / expiry / converters on a warehouse row. */
  updateStockItem: (
    itemId: string,
    patch: Partial<
      Pick<
        StockItem,
        'name' | 'unit' | 'bought' | 'used' | 'lowAt' | 'expiresOn' | 'kgPerUnit' | 'portionPerUnit'
      >
    >,
  ) => void
  removeStockItem: (itemId: string) => void
  foodMade: NonNullable<StallOpsState['foodMade']>
  setFoodMadeQty: (
    eventId: string,
    dayYmd: string,
    itemKey: string,
    patch: Partial<Pick<FoodMadeRow, 'made' | 'used' | 'spoiled' | 'spoilReason' | 'carriedIn' | 'name' | 'unit'>>,
  ) => void
  clearFoodMadeItem: (itemKey: string) => void
  carryFoodToNextDay: (eventId: string, fromDayYmd: string, toDayYmd?: string) => void
  setMenuPrice: (id: string, price: number) => void
  setComboDefaultPrices: (id: string, chai: number, lassi: number) => void
  /** Patch combo/single fields (contents, costs, name, …). */
  updateMenuItem: (id: string, patch: Partial<MenuItem>) => void
  /** Set food cost €/serving on base menu + every event-type menu copy. */
  setMenuFoodCost: (
    id: string,
    foodCost: number,
    drinkCosts?: { chai?: number; lassi?: number },
  ) => void
  /** Set / clear dish photo on base menu (synced to /order). */
  setMenuImageUrl: (id: string, imageUrl: string) => Promise<void>
  /** Force-push local menu (photos) to cloud for the customer /order page. */
  pushMenuPhotosToCloud: () => Promise<void>
  removeMenuItem: (id: string) => void
  moveMenuItem: (id: string, direction: 'up' | 'down') => void
  /** Price key = event type (Flohmarkt, Streetfood Festival, Gourmet, …). */
  setEventPrice: (eventType: string, itemId: string, patch: EventPriceOverride) => void
  clearEventPrices: (eventType: string) => void
  copyEventPrices: (fromType: string, toType: string) => boolean
  setMenuHiddenForEventType: (eventType: string, itemId: string, hidden: boolean) => void
  addMenuItem: (name: string, price: number) => void
  /** Ensure a saved catalog exists for this type (seeds from defaults + legacy overrides). */
  ensureEventMenu: (eventType: string) => void
  /** Move leftover E012-style catalogs onto Flohmarkt / Gourmet / … */
  rehomeLegacyEventMenus: (
    events: { id: string; name: string; location?: string }[],
  ) => void
  /**
   * Replace an event-type catalog with the guest `/order` menu (includes cloud
   * public-menu overrides) so New order matches what customers see.
   */
  syncEventMenuFromPublic: (eventType: string, items: MenuItem[]) => boolean
  addCustomEventType: (name: string) => boolean
  updateEventMenuItem: (eventType: string, itemId: string, patch: Partial<MenuItem>) => void
  removeEventMenuItem: (eventType: string, itemId: string) => void
  moveEventMenuItem: (eventType: string, itemId: string, direction: 'up' | 'down') => void
  addEventMenuItem: (
    eventType: string,
    name: string,
    price: number,
    kind?: 'single' | 'combo',
  ) => void
  copyEventMenu: (fromType: string, toType: string) => boolean
  clearEventMenu: (eventType: string) => void
  setActiveEventId: (
    eventId: string,
    opts?: { menuKey?: string; label?: string },
  ) => void
  /** Auto Customer 1, 2, … (resets each Germany calendar day). */
  nextCustomer: number
  createOrder: (lines: OrderLine[]) => void
  /** Activate a customer QR order by 4-digit claim code. */
  claimCustomerOrder: (code: string) => Promise<{ ok: boolean; error?: string; order?: StallOrder }>
  awaitingClaim: StallOrder[]
  updatePendingOrder: (id: string, lines: OrderLine[]) => void
  setOrderLineDelivered: (orderId: string, lineIndex: number, deliveredQty: number) => void
  markAllLinesDelivered: (orderId: string) => void
  completeOrder: (id: string, paid: number, tip?: number, payMethod?: PayMethod) => void
  /**
   * Take cash/PayPal now but keep the ticket in Pending until food is handed over.
   */
  markOrderPaid: (id: string, paid: number, tip?: number, payMethod?: PayMethod) => void
  reopenOrder: (id: string) => void
  deleteOrder: (id: string) => void
  voidOrder: (id: string, reason: string) => void
  orderConflicts: OrderConflict[]
  resolveOrderConflict: (orderId: string, keep: 'mine' | 'theirs') => void
  dismissOrderConflict: (orderId: string) => void
  prepChecklists: Record<string, PrepTask[]>
  eventParticipants: Record<string, EventParticipant[]>
  setEventParticipants: (eventId: string, people: EventParticipant[]) => void
  paypalQrDataUrl: string
  setPaypalQrDataUrl: (dataUrl: string) => void
  teamTodos: TeamTodo[]
  addTeamTodo: (input: {
    text: string
    assignee: PrepAssignee
    dueYmd: string
    dueTime?: string
  }) => void
  updateTeamTodo: (id: string, patch: Partial<TeamTodo>) => void
  deleteTeamTodo: (id: string) => void
  teamGoals: TeamGoal[]
  upsertTeamGoal: (goal: TeamGoal) => void
  deleteTeamGoal: (id: string) => void
  setGoalMilestone: (goalId: string, milestoneId: string, patch: Partial<GoalMilestone>) => void
  addGoalMilestone: (
    goalId: string,
    label: string,
    targetAmount?: number,
    dueDate?: string,
  ) => void
  eventStock: Record<string, Record<string, number>>
  setEventStockQty: (eventId: string, itemId: string, qty: number) => void
  notifyEmails: TeamNotifyEmails
  setNotifyEmail: (name: TeamMemberName, email: string) => void
  teamChat: TeamChatMessage[]
  postTeamChat: (text: string) => void
  announcements: TeamAnnouncement[]
  postAnnouncement: (title: string, body: string, pinned?: boolean) => void
  deleteAnnouncement: (id: string) => void
  businessCards: BusinessCard[]
  upsertBusinessCard: (card: Partial<BusinessCard> & { id?: string }) => string
  deleteBusinessCard: (id: string) => void
  eventBook: EventBook
  calendarNotes: CalendarNote[]
  upsertAppEvent: (input: Partial<EventRow> & { id?: string }) => string
  patchEvent: (id: string, patch: Partial<EventRow>) => void
  /** Exact public map pin — Developer only. */
  setEventMapsQuery: (id: string, mapsQuery: string) => void
  removeAppEvent: (id: string) => void
  addCalendarNote: (date: string, title: string, note?: string) => void
  deleteCalendarNote: (id: string) => void
  ensurePrepChecklist: (eventId: string) => void
  setPrepTask: (
    eventId: string,
    taskId: string,
    patch: Partial<Pick<PrepTask, 'done' | 'assignee' | 'text'>>,
  ) => void
  addPrepTask: (eventId: string, text: string, assignee?: PrepAssignee) => void
  refreshStallOps: () => Promise<void>
}

const StallOpsContext = createContext<StallOpsContextValue | null>(null)

export function StallOpsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const cloud = isCloudConfigured() && !isDemoMode()
  const [state, setState] = useState<StallOpsState>(() => {
    if (!isDemoMode()) return loadStallOps()
    const loaded = loadStallOps()
    if (loaded.orders.length || loaded.stock.some((s) => s.bought > 0)) return loaded
    const seeded = emptyStallOps()
    seeded.stock = seeded.stock.map((s) =>
      s.id === 'plates'
        ? { ...s, bought: 100 }
        : s.id === 'lassi-cup' || s.id === 'chai-cup'
          ? { ...s, bought: 40 }
          : s.id === 'cauli-packet' || s.id === 'salad-packet'
            ? { ...s, bought: 10 }
            : s,
    )
    saveStallOpsLocal(seeded)
    return seeded
  })
  const [syncing, setSyncing] = useState(false)
  const [orderConflicts, setOrderConflicts] = useState<OrderConflict[]>([])
  const cloudSaveTimer = useRef(0)

  const persist = useCallback(
    (next: StallOpsState) => {
      const consolidated = consolidateEventTypeMaps(
        next.eventMenus,
        next.eventPrices,
        next.eventTypeHiddenMenu,
        next.eventMenuRemovedIds,
        next.eventMenusRev,
      )
      const clean: StallOpsState = applyEventMenuRehome({
        ...next,
        eventMenus: consolidated.eventMenus,
        eventPrices: consolidated.eventPrices,
        eventTypeHiddenMenu: consolidated.eventTypeHiddenMenu,
        eventMenuRemovedIds: consolidated.eventMenuRemovedIds,
        eventMenusRev: consolidated.eventMenusRev,
      })
      setState(clean)
      saveStallOpsLocal(clean)
      try {
        window.dispatchEvent(new Event('nasta-event-book'))
      } catch {
        /* ignore */
      }
      if (!cloud || !user) return
      if (!navigator.onLine) {
        enqueueOffline({ kind: 'stall_ops', payload: clean })
        return
      }
      window.clearTimeout(cloudSaveTimer.current)
      cloudSaveTimer.current = window.setTimeout(() => {
        const latest = loadStallOps()
        void saveStallOpsCloud(latest).catch(() => {
          enqueueOffline({ kind: 'stall_ops', payload: latest })
        })
      }, 700)
    },
    [cloud, user],
  )

  /** Always patch from localStorage so rapid create/delete can’t drop tombstones. */
  const patchStallOps = useCallback(
    (fn: (prev: StallOpsState) => StallOpsState) => {
      persist(fn(loadStallOps()))
    },
    [persist],
  )

  const refreshStallOps = useCallback(async () => {
    if (!cloud || !user) {
      const local = loadStallOps()
      const next = applyE012Catchup(local, user?.name)
      if (next !== local && user) persist(next)
      else {
        setState(next)
        setOrderConflicts([])
      }
      return
    }
    setSyncing(true)
    try {
      const remote = await fetchStallOps()
      if (remote) {
        // Merge local+remote so claim/pending ticks and participant toggles
        // aren’t wiped by a slow cloud round-trip.
        const local = loadStallOps()
        const mergedMenu = mergeMenuListsPreferLocal(remote.menu, local.menu, {
          appendMissingFromRemote: true,
        })
        const conflicts = detectOrderConflicts(local.orders || [], remote.orders || [])
        setOrderConflicts(conflicts)
        const orderBag = mergeStallOrderBags(
          {
            orders: remote.orders || [],
            deletedOrderIds: remote.deletedOrderIds || [],
          },
          {
            orders: local.orders || [],
            deletedOrderIds: local.deletedOrderIds || [],
          },
        )
        // Keep this device's stall selection — remote activeEventId is shared
        // cloud state and would flip Pending between same-day events on refresh.
        const localStall = String(local.activeEventId || '').trim()
        // Remote wins timestamp ties so a stale browser can’t overwrite cloud.
        const paypalQr = preferPaypalQr(local, remote, 'b')
        const merged: StallOpsState = {
          ...remote,
          menu: mergedMenu.length ? mergedMenu : local.menu,
          eventPrices: mergeEventPriceMaps(remote.eventPrices, local.eventPrices),
          orders: orderBag.orders,
          deletedOrderIds: orderBag.deletedOrderIds,
          teamTodos: mergeTeamTodos(remote.teamTodos, local.teamTodos),
          activeEventId: localStall || remote.activeEventId || '',
          publicMenuKey: localStall
            ? local.publicMenuKey || remote.publicMenuKey || ''
            : remote.publicMenuKey || local.publicMenuKey || '',
          publicMenuLabel: localStall
            ? local.publicMenuLabel || remote.publicMenuLabel || ''
            : remote.publicMenuLabel || local.publicMenuLabel || '',
          eventOrderLinks: {
            ...(remote.eventOrderLinks || {}),
            ...(local.eventOrderLinks || {}),
          },
          eventParticipants: {
            ...(remote.eventParticipants || {}),
            ...(local.eventParticipants || {}),
          },
          recipes: mergeRecipes([...(remote.recipes || []), ...(local.recipes || [])]),
          stock: mergeStockItems(remote.stock, local.stock),
          stockAutoUseApplied: [
            ...new Set([
              ...(remote.stockAutoUseApplied || []),
              ...(local.stockAutoUseApplied || []),
            ]),
          ].slice(0, 2000),
          stockAutoUse: mergeStockAutoUse([
            ...(remote.stockAutoUse || []),
            ...(local.stockAutoUse || []),
          ]),
          paypalQrDataUrl: paypalQr.paypalQrDataUrl,
          paypalQrUpdatedAt: paypalQr.paypalQrUpdatedAt,
        }
        const catalog = mergeEventMenuState(remote, local)
        const consolidated = consolidateEventTypeMaps(
          catalog.eventMenus,
          merged.eventPrices,
          merged.eventTypeHiddenMenu,
          catalog.eventMenuRemovedIds,
          catalog.eventMenusRev,
        )
        const clean: StallOpsState = applyEventMenuRehome({
          ...merged,
          eventMenus: consolidated.eventMenus,
          eventPrices: consolidated.eventPrices,
          eventTypeHiddenMenu: consolidated.eventTypeHiddenMenu,
          eventMenuRemovedIds: consolidated.eventMenuRemovedIds,
          eventMenusRev: consolidated.eventMenusRev,
        })
        const repaired = applyE012Catchup(clean, user.name)
        if (repaired !== clean) {
          persist(repaired)
        } else {
          saveStallOpsLocal(clean)
          setState(clean)
        }
      } else {
        const local = applyE012Catchup(loadStallOps(), user.name)
        await saveStallOpsCloud(local).catch(() => undefined)
        setState(local)
        setOrderConflicts([])
      }
    } finally {
      setSyncing(false)
    }
  }, [cloud, persist, user])

  useEffect(() => {
    void refreshStallOps()
  }, [refreshStallOps])

  useEffect(() => {
    const on = async () => {
      await flushAllOfflineOps()
      void offlineQueueCount()
      await refreshStallOps()
    }
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [refreshStallOps])

  const patchStock = useCallback(
    (fn: (stock: StockItem[]) => StockItem[]) => {
      persist({ ...state, stock: fn(state.stock) })
    },
    [persist, state],
  )

  const buyStock = useCallback(
    (itemId: string, qty: number) => {
      if (qty <= 0) return
      patchStock((stock) =>
        stock.map((s) => (s.id === itemId ? { ...s, bought: s.bought + qty } : s)),
      )
    },
    [patchStock],
  )

  const useStock = useCallback(
    (itemId: string, qty: number) => {
      if (qty <= 0) return
      patchStock((stock) =>
        stock.map((s) => {
          if (s.id !== itemId) return s
          const rem = remainingOf(s)
          const take = Math.min(qty, rem)
          return { ...s, used: s.used + take }
        }),
      )
    },
    [patchStock],
  )

  const setStockLowAt = useCallback(
    (itemId: string, lowAt: number) => {
      patchStock((stock) =>
        stock.map((s) => (s.id === itemId ? { ...s, lowAt: Math.max(0, lowAt) } : s)),
      )
    },
    [patchStock],
  )

  const addStockItem = useCallback(
    (name: string, unit = 'pcs', lowAt = 3) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const id = slugId(trimmed)
      if (state.stock.some((s) => s.id === id || s.name.toLowerCase() === trimmed.toLowerCase())) {
        return
      }
      persist({
        ...state,
        stock: [
          ...state.stock,
          { id, name: trimmed, unit, lowAt, bought: 0, used: 0 },
        ],
      })
    },
    [persist, state],
  )

  const updateStockItem = useCallback(
    (
      itemId: string,
      patch: Partial<
        Pick<
          StockItem,
          'name' | 'unit' | 'bought' | 'used' | 'lowAt' | 'expiresOn' | 'kgPerUnit' | 'portionPerUnit'
        >
      >,
    ) => {
      patchStock((stock) =>
        stock.map((s) => {
          if (s.id !== itemId) return s
          const next = { ...s }
          if (patch.name != null) {
            const n = String(patch.name).trim()
            if (n) next.name = n
          }
          if (patch.unit != null) {
            const u = String(patch.unit).trim()
            if (u) next.unit = u
          }
          if (patch.bought != null && Number.isFinite(Number(patch.bought))) {
            next.bought = Math.max(0, Number(patch.bought))
          }
          if (patch.used != null && Number.isFinite(Number(patch.used))) {
            next.used = Math.max(0, Number(patch.used))
          }
          if (patch.lowAt != null && Number.isFinite(Number(patch.lowAt))) {
            next.lowAt = Math.max(0, Number(patch.lowAt))
          }
          if (patch.expiresOn != null) {
            const expiresOn = String(patch.expiresOn).trim()
            next.expiresOn = /^\d{4}-\d{2}-\d{2}$/.test(expiresOn) ? expiresOn : undefined
          }
          if (patch.kgPerUnit != null && Number.isFinite(Number(patch.kgPerUnit))) {
            const kgPerUnit = Number(patch.kgPerUnit)
            next.kgPerUnit = kgPerUnit > 0 ? kgPerUnit : undefined
          }
          if (patch.portionPerUnit != null && Number.isFinite(Number(patch.portionPerUnit))) {
            const portionPerUnit = Number(patch.portionPerUnit)
            next.portionPerUnit = portionPerUnit > 0 ? portionPerUnit : undefined
          }
          if (next.used > next.bought) next.used = next.bought
          return next
        }),
      )
    },
    [patchStock],
  )

  const removeStockItem = useCallback(
    (itemId: string) => {
      const prevStock = { ...(state.eventStock || {}) }
      for (const eid of Object.keys(prevStock)) {
        if (prevStock[eid]?.[itemId] == null) continue
        const copy = { ...prevStock[eid] }
        delete copy[itemId]
        prevStock[eid] = copy
      }
      persist({
        ...state,
        stock: state.stock.filter((s) => s.id !== itemId),
        eventStock: prevStock,
      })
    },
    [persist, state],
  )

  const setFoodMadeQty = useCallback(
    (
      eventId: string,
      dayYmd: string,
      itemKey: string,
      patch: Partial<
        Pick<FoodMadeRow, 'made' | 'used' | 'spoiled' | 'spoilReason' | 'carriedIn' | 'name' | 'unit'>
      >,
    ) => {
      const eid = String(eventId || '').trim()
      const day = String(dayYmd || '').slice(0, 10)
      const key = String(itemKey || '').trim()
      if (!eid || !day || !key) return
      const root = { ...(state.foodMade || {}) }
      const byDay = { ...(root[eid] || {}) }
      const items = { ...(byDay[day] || {}) }
      const prev: FoodMadeRow = items[key] || { made: 0, used: 0, name: key, unit: 'pcs' }
      const made =
        patch.made != null
          ? Math.max(0, Math.round((Number(patch.made) || 0) * 100) / 100)
          : prev.made
      let used =
        patch.used != null
          ? Math.max(0, Math.round((Number(patch.used) || 0) * 100) / 100)
          : prev.used
      let spoiled =
        patch.spoiled != null
          ? Math.max(0, Math.round((Number(patch.spoiled) || 0) * 100) / 100)
          : Math.max(0, Number(prev.spoiled) || 0)
      if (used + spoiled > made) {
        spoiled = Math.max(0, made - used)
        used = Math.min(used, made)
      }
      const carriedIn =
        patch.carriedIn != null
          ? Math.max(0, Math.round((Number(patch.carriedIn) || 0) * 100) / 100)
          : Math.max(0, Number(prev.carriedIn) || 0)
      const spoilReason: SpoilReason | undefined =
        patch.spoilReason != null ? patch.spoilReason : prev.spoilReason
      const name =
        patch.name != null
          ? String(patch.name).trim().slice(0, 80) || prev.name
          : prev.name
      const unit =
        patch.unit != null
          ? String(patch.unit).trim().slice(0, 24) || prev.unit
          : prev.unit
      if (made <= 0 && used <= 0 && spoiled <= 0 && carriedIn <= 0) delete items[key]
      else {
        items[key] = {
          made,
          used,
          name,
          unit,
          ...(spoiled > 0 ? { spoiled } : {}),
          ...(spoilReason ? { spoilReason } : {}),
          ...(carriedIn > 0 ? { carriedIn } : {}),
        }
      }
      if (Object.keys(items).length) byDay[day] = items
      else delete byDay[day]
      if (Object.keys(byDay).length) root[eid] = byDay
      else delete root[eid]
      persist({ ...state, foodMade: root })
    },
    [persist, state],
  )

  const carryFoodToNextDay = useCallback(
    (eventId: string, fromDayYmd: string, toDayYmd?: string) => {
      const event = String(eventId || '').trim()
      const fromDay = String(fromDayYmd || '').slice(0, 10)
      const toDay = String(toDayYmd || nextYmd(fromDay)).slice(0, 10)
      if (
        !event ||
        !/^\d{4}-\d{2}-\d{2}$/.test(fromDay) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(toDay) ||
        fromDay === toDay
      ) {
        return
      }
      patchStallOps((prev) => {
        const fromItems = prev.foodMade?.[event]?.[fromDay] || {}
        const carries = Object.entries(fromItems)
          .map(([key, row]) => [key, row, remainingFood(row)] as const)
          .filter(([, , qty]) => qty > 0)
        if (!carries.length) return prev
        const foodMade = { ...(prev.foodMade || {}) }
        const byDay = { ...(foodMade[event] || {}) }
        const items = { ...(byDay[toDay] || {}) }
        for (const [key, row, qty] of carries) {
          const target = items[key] || { made: 0, used: 0, name: row.name, unit: row.unit }
          items[key] = {
            ...target,
            made: Math.round((target.made + qty) * 100) / 100,
            carriedIn: Math.round(((target.carriedIn || 0) + qty) * 100) / 100,
          }
        }
        byDay[toDay] = items
        foodMade[event] = byDay
        return { ...prev, foodMade }
      })
    },
    [patchStallOps],
  )

  const setRecipe = useCallback(
    (prepItemId: string, patch: Partial<Recipe>) => {
      const id = String(prepItemId || '').trim()
      if (!id) return
      patchStallOps((prev) => {
        const recipes = mergeRecipes(prev.recipes)
        const existing = recipes.find((recipe) => recipe.prepItemId === id)
        const next: Recipe = {
          ...(existing || { prepItemId: id, batchSize: 1, unit: 'batch', yields: [] }),
          ...patch,
          prepItemId: id,
        }
        return {
          ...prev,
          recipes: recipes.map((recipe) => (recipe.prepItemId === id ? next : recipe)),
        }
      })
    },
    [patchStallOps],
  )

  const setStockAutoUse = useCallback(
    (rules: StockAutoUseRule[]) => {
      patchStallOps((prev) => ({ ...prev, stockAutoUse: mergeStockAutoUse(rules) }))
    },
    [patchStallOps],
  )

  const clearFoodMadeItem = useCallback(
    (itemKey: string) => {
      const key = String(itemKey || '').trim()
      if (!key) return
      const root = { ...(state.foodMade || {}) }
      let touched = false
      for (const eid of Object.keys(root)) {
        const byDay = { ...(root[eid] || {}) }
        for (const day of Object.keys(byDay)) {
          if (byDay[day]?.[key] == null) continue
          const items = { ...byDay[day] }
          delete items[key]
          touched = true
          if (Object.keys(items).length) byDay[day] = items
          else delete byDay[day]
        }
        if (Object.keys(byDay).length) root[eid] = byDay
        else delete root[eid]
      }
      if (touched) persist({ ...state, foodMade: root })
    },
    [persist, state],
  )

  const setMenuPrice = useCallback(
    (id: string, price: number) => {
      const p = Math.max(0, price)
      persist({
        ...state,
        menu: state.menu.map((m) =>
          m.id === id
            ? m.kind === 'combo'
              ? { ...m, price: p, priceWithChai: p }
              : { ...m, price: p }
            : m,
        ),
      })
    },
    [persist, state],
  )

  const setComboDefaultPrices = useCallback(
    (id: string, chai: number, lassi: number) => {
      const c = Math.max(0, chai)
      const l = Math.max(0, lassi)
      persist({
        ...state,
        menu: state.menu.map((m) =>
          m.id === id && m.kind === 'combo'
            ? { ...m, price: c, priceWithChai: c, priceWithLassi: l }
            : m,
        ),
      })
    },
    [persist, state],
  )

  const updateMenuItem = useCallback(
    (id: string, patch: Partial<MenuItem>) => {
      persist({
        ...state,
        menu: state.menu.map((m) => {
          if (m.id !== id) return m
          const next = { ...m, ...patch, id: m.id, kind: m.kind }
          if (patch.contents != null) {
            next.contents = String(patch.contents).trim() || undefined
          }
          if (patch.foodCost != null) next.foodCost = Math.max(0, Number(patch.foodCost) || 0)
          if (patch.drinkCostChai != null) {
            next.drinkCostChai = Math.max(0, Number(patch.drinkCostChai) || 0)
          }
          if (patch.drinkCostLassi != null) {
            next.drinkCostLassi = Math.max(0, Number(patch.drinkCostLassi) || 0)
          }
          if (patch.imageUrl != null) {
            const img = String(patch.imageUrl).trim()
            next.imageUrl =
              !img
                ? undefined
                : img.startsWith('data:image/') || /^https?:\/\//i.test(img)
                  ? img
                  : m.imageUrl
          }
          if (patch.name != null) next.name = String(patch.name).trim() || m.name
          if (patch.price != null) next.price = Math.max(0, Number(patch.price) || 0)
          if (patch.priceWithChai != null) {
            next.priceWithChai = Math.max(0, Number(patch.priceWithChai) || 0)
          }
          if (patch.priceWithLassi != null) {
            next.priceWithLassi = Math.max(0, Number(patch.priceWithLassi) || 0)
          }
          if (patch.hidden != null) next.hidden = Boolean(patch.hidden)
          return next
        }),
      })
    },
    [persist, state],
  )

  const setMenuFoodCost = useCallback(
    (id: string, foodCost: number, drinkCosts?: { chai?: number; lassi?: number }) => {
      if (!id) return
      const cost = Math.max(0, Math.round((Number(foodCost) || 0) * 100) / 100)
      const chai =
        drinkCosts?.chai != null
          ? Math.max(0, Math.round((Number(drinkCosts.chai) || 0) * 100) / 100)
          : undefined
      const lassi =
        drinkCosts?.lassi != null
          ? Math.max(0, Math.round((Number(drinkCosts.lassi) || 0) * 100) / 100)
          : undefined
      const patchItem = (m: MenuItem): MenuItem => {
        if (m.id !== id) return m
        return {
          ...m,
          foodCost: cost,
          ...(chai != null ? { drinkCostChai: chai } : {}),
          ...(lassi != null ? { drinkCostLassi: lassi } : {}),
        }
      }
      const eventMenus = { ...(state.eventMenus || {}) }
      for (const [key, list] of Object.entries(eventMenus)) {
        if (!list?.length) continue
        eventMenus[key] = list.map(patchItem)
      }
      persist({
        ...state,
        menu: state.menu.map(patchItem),
        eventMenus,
      })
    },
    [persist, state],
  )

  const setMenuImageUrl = useCallback(
    async (id: string, imageUrl: string) => {
      if (!id) return
      const raw = String(imageUrl || '').trim()
      const nextUrl =
        !raw
          ? ''
          : raw.startsWith('data:image/') || /^https?:\/\//i.test(raw)
            ? raw
            : null
      if (nextUrl === null) return
      // Photos live on the base menu only — /order merges them onto the event catalog.
      // Keeping copies out of every eventMenus[] keeps the cloud payload small enough to sync.
      const eventMenus: StallOpsState['eventMenus'] = { ...(state.eventMenus || {}) }
      for (const [key, list] of Object.entries(eventMenus)) {
        if (!list?.length) continue
        eventMenus[key] = list.map((m) => {
          if (!m.imageUrl) return m
          const { imageUrl: _drop, ...rest } = m
          return rest as MenuItem
        })
      }
      const next: StallOpsState = {
        ...state,
        menu: state.menu.map((m) =>
          m.id === id ? { ...m, imageUrl: nextUrl || undefined } : m,
        ),
        eventMenus,
      }
      setState(next)
      saveStallOpsLocal(next)
      if (cloud && user && navigator.onLine) {
        try {
          await saveStallOpsCloud(next)
        } catch (e) {
          enqueueOffline({ kind: 'stall_ops', payload: next })
          throw new Error(
            e instanceof Error
              ? `Photo saved here, but cloud sync failed (${e.message}). Tap “Sync now” at the top, then refresh /order.`
              : 'Photo saved here, but cloud sync failed. Tap “Sync now”, then refresh /order.',
          )
        }
      } else if (cloud && user) {
        enqueueOffline({ kind: 'stall_ops', payload: next })
        throw new Error(
          'You are offline — photo saved on this device only. Go online and tap Sync now.',
        )
      }
    },
    [cloud, state, user],
  )

  const pushMenuPhotosToCloud = useCallback(async () => {
    if (!cloud || !user) throw new Error('Sign in with cloud sync to push photos.')
    if (!navigator.onLine) throw new Error('Go online first, then push photos.')
    await pushLocalStallOpsNow()
    await refreshStallOps()
  }, [cloud, refreshStallOps, user])

  const removeMenuItem = useCallback(
    (id: string) => {
      persist({
        ...state,
        menu: state.menu.map((m) => (m.id === id ? { ...m, hidden: true } : m)),
      })
    },
    [persist, state],
  )

  const moveMenuItem = useCallback(
    (id: string, direction: 'up' | 'down') => {
      const visible = state.menu.filter((m) => !m.hidden)
      const vIdx = visible.findIndex((m) => m.id === id)
      if (vIdx < 0) return
      const swapWith = direction === 'up' ? vIdx - 1 : vIdx + 1
      if (swapWith < 0 || swapWith >= visible.length) return
      const aId = visible[vIdx]!.id
      const bId = visible[swapWith]!.id
      const ai = state.menu.findIndex((m) => m.id === aId)
      const bi = state.menu.findIndex((m) => m.id === bId)
      if (ai < 0 || bi < 0) return
      const next = [...state.menu]
      const a = next[ai]!
      const b = next[bi]!
      next[ai] = b
      next[bi] = a
      persist({ ...state, menu: next })
    },
    [persist, state],
  )

  const setEventPrice = useCallback(
    (eventType: string, itemId: string, patch: EventPriceOverride) => {
      const key = eventTypeKey(eventType)
      if (!key || isEventIdKey(key)) return
      const prevEv = state.eventPrices?.[key] || {}
      const prevItem = prevEv[itemId] || {}
      const nextItem: EventPriceOverride = { ...prevItem }
      if (patch.price !== undefined) nextItem.price = Math.max(0, patch.price)
      if (patch.priceWithChai !== undefined) {
        nextItem.priceWithChai = Math.max(0, patch.priceWithChai)
      }
      if (patch.priceWithLassi !== undefined) {
        nextItem.priceWithLassi = Math.max(0, patch.priceWithLassi)
      }
      persist({
        ...state,
        eventPrices: {
          ...(state.eventPrices || {}),
          [key]: { ...prevEv, [itemId]: nextItem },
        },
      })
    },
    [persist, state],
  )

  const clearEventPrices = useCallback(
    (eventType: string) => {
      const key = eventType.trim()
      if (!key) return
      const next = { ...(state.eventPrices || {}) }
      delete next[key]
      persist({ ...state, eventPrices: next })
    },
    [persist, state],
  )

  const copyEventPrices = useCallback(
    (fromType: string, toType: string) => {
      const from = fromType.trim()
      const to = toType.trim()
      if (!from || !to || from === to) return false
      const src = state.eventPrices?.[from]
      if (!src || !Object.keys(src).length) return false
      persist({
        ...state,
        eventPrices: {
          ...(state.eventPrices || {}),
          [to]: { ...src },
        },
      })
      return true
    },
    [persist, state],
  )

  const setMenuHiddenForEventType = useCallback(
    (eventType: string, itemId: string, hidden: boolean) => {
      const key = eventType.trim()
      if (!key || !itemId) return
      const prev = state.eventTypeHiddenMenu?.[key] || []
      const set = new Set(prev)
      if (hidden) set.add(itemId)
      else set.delete(itemId)
      persist({
        ...state,
        eventTypeHiddenMenu: {
          ...(state.eventTypeHiddenMenu || {}),
          [key]: [...set],
        },
      })
    },
    [persist, state],
  )

  const addMenuItem = useCallback(
    (name: string, price: number) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const id = slugId(trimmed)
      if (state.menu.some((m) => m.id === id)) return
      persist({
        ...state,
        menu: [
          ...state.menu,
          { id, name: trimmed, kind: 'single', price: Math.max(0, price) },
        ],
      })
    },
    [persist, state],
  )

  const rehomeLegacyEventMenus = useCallback(
    (events: { id: string; name: string; location?: string }[]) => {
      const prev = loadStallOps()
      const next = applyEventMenuRehome(prev, events)
      if (next === prev && !rawStallOpsHasEventIdKeys()) return
      persist(next)
    },
    [persist],
  )

  const ensureEventMenu = useCallback(
    (eventType: string) => {
      const key = eventTypeKey(eventType)
      if (!key || isEventIdKey(key)) return
      // Always read latest local (post-sync) — never spread a stale React `state`
      // or we overwrite the cloud Gourmet/Flohmarkt catalog with an old copy.
      patchStallOps((prev) => {
        const consolidated = consolidateEventTypeMaps(
          prev.eventMenus,
          prev.eventPrices,
          prev.eventTypeHiddenMenu,
          prev.eventMenuRemovedIds,
          prev.eventMenusRev,
        )
        const existing = consolidated.eventMenus[key]
        const alreadySaved = Array.isArray(prev.eventMenus?.[key]) || Array.isArray(existing)
        if (alreadySaved) {
          if (!consolidated.changed) return prev
          return {
            ...prev,
            eventMenus: consolidated.eventMenus,
            eventPrices: consolidated.eventPrices,
            eventTypeHiddenMenu: consolidated.eventTypeHiddenMenu,
            eventMenuRemovedIds: consolidated.eventMenuRemovedIds,
            eventMenusRev: consolidated.eventMenusRev,
          }
        }
        const drop = new Set(consolidated.eventMenuRemovedIds[key] || [])
        const seeded = seedMenuForEventType(
          prev.menu,
          key,
          consolidated.eventPrices,
          consolidated.eventTypeHiddenMenu,
        ).filter((m) => !drop.has(m.id))
        return {
          ...prev,
          eventMenus: { ...consolidated.eventMenus, [key]: seeded },
          eventPrices: consolidated.eventPrices,
          eventTypeHiddenMenu: consolidated.eventTypeHiddenMenu,
          eventMenuRemovedIds: consolidated.eventMenuRemovedIds,
          eventMenusRev: consolidated.eventMenusRev,
        }
      })
    },
    [patchStallOps],
  )

  const syncEventMenuFromPublic = useCallback(
    (eventType: string, items: MenuItem[]) => {
      const key = eventTypeKey(eventType)
      if (!key || isEventIdKey(key) || !items.length) return false
      // Guest /order may still carry stale price patches. Never replace this
      // type’s catalog or prices — Menu prices + New order are the source of truth.
      let changed = false
      patchStallOps((prev) => {
        const prevList = prev.eventMenus?.[key]
        if (!Array.isArray(prevList) || !prevList.length) return prev
        const pubById = new Map(items.map((m) => [String(m.id), m]))
        const nextList = prevList.map((m) => {
          const pub = pubById.get(m.id)
          if (!pub) return m
          const imageUrl = pub.imageUrl || m.imageUrl
          const soldOut = Boolean(pub.soldOut)
          const hideFromCustomer = Boolean(pub.hideFromCustomer)
          if (
            imageUrl === m.imageUrl &&
            soldOut === Boolean(m.soldOut) &&
            hideFromCustomer === Boolean(m.hideFromCustomer)
          ) {
            return m
          }
          changed = true
          return { ...m, imageUrl, soldOut, hideFromCustomer }
        })
        if (!changed) return prev
        return {
          ...prev,
          eventMenus: { ...(prev.eventMenus || {}), [key]: nextList },
        }
      })
      return changed
    },
    [patchStallOps],
  )

  const addCustomEventType = useCallback(
    (name: string) => {
      const key = eventTypeKey(name)
      if (!key || isEventIdKey(key)) return false
      let ok = false
      patchStallOps((prev) => {
        const customs = prev.customEventTypes || []
        if (customs.some((t) => t.toLowerCase() === key.toLowerCase())) {
          ok = true
          return prev
        }
        const seeded = seedMenuForEventType(
          prev.menu,
          key,
          prev.eventPrices,
          prev.eventTypeHiddenMenu,
        )
        ok = true
        return {
          ...prev,
          customEventTypes: [...customs, key],
          eventMenus: { ...(prev.eventMenus || {}), [key]: seeded },
        }
      })
      if (ok) ensureEventMenu(key)
      return ok
    },
    [patchStallOps, ensureEventMenu],
  )

  const patchEventMenuList = useCallback(
    (eventType: string, updater: (list: MenuItem[]) => MenuItem[]) => {
      const key = eventTypeKey(eventType)
      if (!key || isEventIdKey(key)) return
      // Latest localStorage — a poll must not overwrite a price we just typed.
      patchStallOps((prev) => {
        const current = Array.isArray(prev.eventMenus?.[key])
          ? prev.eventMenus[key]!
          : seedMenuForEventType(
              prev.menu,
              key,
              prev.eventPrices,
              prev.eventTypeHiddenMenu,
            ).filter((m) => !(prev.eventMenuRemovedIds?.[key] || []).includes(m.id))
        const nextList = updater(current.map((m) => ({ ...m })))
        const prevIds = new Set(current.map((m) => m.id))
        const nextIds = new Set(nextList.map((m) => m.id))
        const removed = { ...(prev.eventMenuRemovedIds || {}) }
        const gone = [...prevIds].filter((id) => !nextIds.has(id))
        const back = [...nextIds].filter((id) => !prevIds.has(id))
        if (gone.length) {
          removed[key] = [...new Set([...(removed[key] || []), ...gone])]
        }
        if (back.length && removed[key]?.length) {
          const drop = new Set(back)
          removed[key] = removed[key]!.filter((id) => !drop.has(id))
        }
        return {
          ...prev,
          eventMenus: {
            ...(prev.eventMenus || {}),
            [key]: nextList,
          },
          eventMenusRev: {
            ...(prev.eventMenusRev || {}),
            [key]: Date.now(),
          },
          eventMenuRemovedIds: removed,
        }
      })
    },
    [patchStallOps],
  )

  const updateEventMenuItem = useCallback(
    (eventType: string, itemId: string, patch: Partial<MenuItem>) => {
      patchEventMenuList(eventType, (list) =>
        list.map((m) => {
          if (m.id !== itemId) return m
          const next = { ...m, ...patch, id: m.id, kind: patch.kind || m.kind }
          if (patch.contents != null) {
            next.contents = String(patch.contents).trim() || undefined
          }
          if (patch.foodCost != null) next.foodCost = Math.max(0, Number(patch.foodCost) || 0)
          if (patch.drinkCostChai != null) {
            next.drinkCostChai = Math.max(0, Number(patch.drinkCostChai) || 0)
          }
          if (patch.drinkCostLassi != null) {
            next.drinkCostLassi = Math.max(0, Number(patch.drinkCostLassi) || 0)
          }
          if (patch.name != null) next.name = String(patch.name).trim() || m.name
          if (patch.price != null) next.price = Math.max(0, Number(patch.price) || 0)
          if (patch.priceWithChai != null) {
            next.priceWithChai = Math.max(0, Number(patch.priceWithChai) || 0)
            if (next.kind === 'combo') next.price = next.priceWithChai
          }
          if (patch.priceWithLassi != null) {
            next.priceWithLassi = Math.max(0, Number(patch.priceWithLassi) || 0)
          }
          if (patch.hidden != null) next.hidden = Boolean(patch.hidden)
          if (patch.hideFromCustomer != null) next.hideFromCustomer = Boolean(patch.hideFromCustomer)
          if (patch.vegan != null) next.vegan = Boolean(patch.vegan)
          if (patch.vegetarian != null) next.vegetarian = Boolean(patch.vegetarian)
          if (patch.glutenFree != null) next.glutenFree = Boolean(patch.glutenFree)
          if (patch.description != null) {
            next.description = String(patch.description).trim() || undefined
          }
          if (patch.ingredients != null) {
            next.ingredients = String(patch.ingredients).trim() || undefined
          }
          if (patch.nameDe != null) next.nameDe = String(patch.nameDe).trim() || undefined
          if (patch.contentsDe != null) {
            next.contentsDe = String(patch.contentsDe).trim() || undefined
          }
          if (patch.descriptionDe != null) {
            next.descriptionDe = String(patch.descriptionDe).trim() || undefined
          }
          if (patch.ingredientsDe != null) {
            next.ingredientsDe = String(patch.ingredientsDe).trim() || undefined
          }
          if (patch.imageUrl != null) {
            const img = String(patch.imageUrl).trim()
            next.imageUrl =
              !img
                ? undefined
                : img.startsWith('data:image/') || /^https?:\/\//i.test(img)
                  ? img
                  : m.imageUrl
          }
          return next
        }),
      )
    },
    [patchEventMenuList],
  )

  const removeEventMenuItem = useCallback(
    (eventType: string, itemId: string) => {
      patchEventMenuList(eventType, (list) => list.filter((m) => m.id !== itemId))
    },
    [patchEventMenuList],
  )

  const moveEventMenuItem = useCallback(
    (eventType: string, itemId: string, direction: 'up' | 'down') => {
      patchEventMenuList(eventType, (list) => {
        const visible = list.filter((m) => !m.hidden)
        const vIdx = visible.findIndex((m) => m.id === itemId)
        if (vIdx < 0) return list
        const swapWith = direction === 'up' ? vIdx - 1 : vIdx + 1
        if (swapWith < 0 || swapWith >= visible.length) return list
        const aId = visible[vIdx]!.id
        const bId = visible[swapWith]!.id
        const ai = list.findIndex((m) => m.id === aId)
        const bi = list.findIndex((m) => m.id === bId)
        if (ai < 0 || bi < 0) return list
        const next = [...list]
        const a = next[ai]!
        const b = next[bi]!
        next[ai] = b
        next[bi] = a
        return next
      })
    },
    [patchEventMenuList],
  )

  const addEventMenuItem = useCallback(
    (
      eventType: string,
      name: string,
      price: number,
      kind: 'single' | 'combo' = 'single',
    ) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const key = eventTypeKey(eventType)
      if (!key) return
      const idBase = slugId(trimmed)
      patchEventMenuList(key, (list) => {
        let id = idBase
        let n = 2
        while (list.some((m) => m.id === id)) {
          id = `${idBase}-${n}`
          n += 1
        }
        const p = Math.max(0, price)
        const item: MenuItem =
          kind === 'combo'
            ? {
                id,
                name: trimmed,
                kind: 'combo',
                price: p,
                priceWithChai: p,
                priceWithLassi: p,
                contents: '',
              }
            : { id, name: trimmed, kind: 'single', price: p }
        return [...list, item]
      })
    },
    [patchEventMenuList],
  )

  const copyEventMenu = useCallback(
    (fromType: string, toType: string) => {
      const from = eventTypeKey(fromType)
      const to = eventTypeKey(toType)
      if (!from || !to || from === to || isEventIdKey(from) || isEventIdKey(to)) return false
      let ok = false
      patchStallOps((prev) => {
        const src = menuForEventType(
          from,
          prev.eventMenus,
          prev.menu,
          prev.eventPrices,
          prev.eventTypeHiddenMenu,
        )
        if (!src.length) return prev
        ok = true
        const removed = { ...(prev.eventMenuRemovedIds || {}) }
        delete removed[to]
        return {
          ...prev,
          eventMenus: {
            ...(prev.eventMenus || {}),
            [to]: src.map((m) => ({ ...m })),
          },
          eventMenusRev: { ...(prev.eventMenusRev || {}), [to]: Date.now() },
          eventMenuRemovedIds: removed,
        }
      })
      return ok
    },
    [patchStallOps],
  )

  const clearEventMenu = useCallback(
    (eventType: string) => {
      const key = eventTypeKey(eventType)
      if (!key || isEventIdKey(key)) return
      patchStallOps((prev) => {
        const nextMenus = { ...(prev.eventMenus || {}) }
        delete nextMenus[key]
        const nextPrices = { ...(prev.eventPrices || {}) }
        delete nextPrices[key]
        const nextRemoved = { ...(prev.eventMenuRemovedIds || {}) }
        delete nextRemoved[key]
        const nextRev = { ...(prev.eventMenusRev || {}) }
        delete nextRev[key]
        return {
          ...prev,
          eventMenus: nextMenus,
          eventPrices: nextPrices,
          eventMenuRemovedIds: nextRemoved,
          eventMenusRev: nextRev,
        }
      })
    },
    [patchStallOps],
  )

  const nextCustomer = useMemo(
    () => nextCustomerNumber(state.orders, new Date(), state.activeEventId),
    [state.orders, state.activeEventId],
  )

  const setActiveEventId = useCallback(
    (eventId: string, opts?: { menuKey?: string; label?: string }) => {
      const id = String(eventId || '').trim()
      const menuKey =
        opts?.menuKey != null ? String(opts.menuKey).trim().slice(0, 80) : undefined
      const label =
        opts?.label != null ? String(opts.label).trim().slice(0, 160) : undefined
      patchStallOps((prev) => {
        const nextKey = id ? (menuKey ?? prev.publicMenuKey ?? '') : ''
        const nextLabel = id ? (label ?? prev.publicMenuLabel ?? '') : ''
        const eventOrderLinks = { ...(prev.eventOrderLinks || {}) }
        if (id && (nextKey || nextLabel)) {
          eventOrderLinks[id] = {
            menuKey: nextKey,
            label: nextLabel,
          }
        }
        return {
          ...prev,
          activeEventId: id,
          publicMenuKey: nextKey,
          publicMenuLabel: nextLabel,
          eventOrderLinks,
        }
      })
    },
    [patchStallOps],
  )

  const createOrder = useCallback(
    (lines: OrderLine[]) => {
      const clean = lines.filter((l) => l.qty > 0)
      if (!clean.length) return
      patchStallOps((prev) => {
        const eid = String(prev.activeEventId || '').trim() || undefined
        const n = nextCustomerNumber(prev.orders, new Date(), eid)
        const now = new Date().toISOString()
        const order: StallOrder = {
          id: newId('ord'),
          label: customerLabel(n),
          status: 'pending',
          lines: clean,
          createdAt: now,
          updatedAt: now,
          eventId: eid,
          source: 'pos',
        }
        return { ...prev, orders: [order, ...prev.orders] }
      })
    },
    [patchStallOps],
  )

  const awaitingClaim = useMemo(() => {
    const eid = String(state.activeEventId || '').trim()
    return state.orders
      .filter((o) => {
        if (o.status !== 'awaiting_claim' || o.voided) return false
        if (!eid) return true
        // Strict: only this stall — no orphan tickets without eventId.
        return String(o.eventId || '').trim() === eid
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [state.orders, state.activeEventId])

  const claimCustomerOrder = useCallback(
    async (code: string) => {
      await refreshStallOps()
      const latest = loadStallOps()
      const result = claimOrderByCode(latest.orders, code, latest.activeEventId)
      if (result.error || !result.claimed) {
        return { ok: false, error: result.error || 'Code not found' }
      }
      persist({ ...latest, orders: result.orders })
      return { ok: true, order: result.claimed }
    },
    [persist, refreshStallOps],
  )

  const updatePendingOrder = useCallback(
    (id: string, lines: OrderLine[]) => {
      patchStallOps((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => {
          if (o.id !== id || o.status !== 'pending') return o
          return touchOrder(o, { lines: lines.filter((l) => l.qty > 0) })
        }),
      }))
    },
    [patchStallOps],
  )

  const setOrderLineDelivered = useCallback(
    (orderId: string, lineIndex: number, deliveredQty: number) => {
      patchStallOps((prev) => ({
        ...prev,
        orders: prev.orders.map((order) => {
          if (order.id !== orderId || order.status !== 'pending') return order
          const lines = order.lines.map((line, index) =>
            index === lineIndex
              ? {
                  ...line,
                  deliveredQty: Math.max(
                    0,
                    Math.min(Math.max(0, Number(line.qty) || 0), Math.round(Number(deliveredQty) || 0)),
                  ),
                }
              : line,
          )
          return touchOrder(order, { lines })
        }),
      }))
    },
    [patchStallOps],
  )

  const markAllLinesDelivered = useCallback(
    (orderId: string) => {
      patchStallOps((prev) => ({
        ...prev,
        orders: prev.orders.map((order) => {
          if (order.id !== orderId || order.status !== 'pending') return order
          const lines = order.lines.map((line) => ({
            ...line,
            deliveredQty: lineDeliveredQty({ ...line, deliveredQty: line.qty }),
          }))
          if (!orderFullyDelivered({ ...order, lines })) return order
          return touchOrder(order, { lines })
        }),
      }))
    },
    [patchStallOps],
  )

  const completeOrder = useCallback(
    (id: string, paid: number, tip = 0, payMethod: PayMethod = 'cash') => {
      const latest = loadStallOps()
      const order = latest.orders.find((o) => o.id === id)
      if (!order) return
      const total = orderTotal(order.lines)
      const paidSafe =
        payMethod === 'paypal'
          ? total
          : Math.max(0, Math.round(paid * 100) / 100)
      const tipSafe = Math.max(0, Math.round(tip * 100) / 100)
      const change =
        payMethod === 'paypal'
          ? 0
          : Math.round((paidSafe - total - tipSafe) * 100) / 100
      const nowDate = new Date()
      const doneAt = stampCompletedAt(order.createdAt, nowDate)
      const catchUp = isCatchUpCompletion(order.createdAt, nowDate)
      patchStallOps((prev) => {
        const rules = mergeStockAutoUse(prev.stockAutoUse)
        const applied = new Set(prev.stockAutoUseApplied || [])
        const shouldApplyAutoUse = !catchUp && !applied.has(id)
        const qtyByStock = shouldApplyAutoUse ? autoUseQtyForOrder(order, rules) : {}
        if (shouldApplyAutoUse) applied.add(id)
        return {
          ...prev,
          orders: prev.orders.map((o) =>
            o.id === id
              ? touchOrder(o, {
                  status: 'completed',
                  completedAt: doneAt,
                  paid: paidSafe,
                  tip: tipSafe > 0 ? tipSafe : undefined,
                  change,
                  payMethod,
                  paidAt: o.paidAt && !catchUp ? o.paidAt : doneAt,
                  lines: (o.lines || []).map((line) => ({
                    ...line,
                    deliveredQty: Math.max(0, Number(line.qty) || 0),
                  })),
                })
              : o,
          ),
          stock: shouldApplyAutoUse
            ? prev.stock.map((item) => {
                const requested = qtyByStock[item.id] || 0
                if (requested <= 0) return item
                return { ...item, used: item.used + Math.min(requested, remainingOf(item)) }
              })
            : prev.stock,
          stockAutoUseApplied: [...applied],
        }
      })
    },
    [patchStallOps],
  )

  const markOrderPaid = useCallback(
    (id: string, paid: number, tip = 0, payMethod: PayMethod = 'cash') => {
      const latest = loadStallOps()
      const order = latest.orders.find((o) => o.id === id)
      if (!order || order.status !== 'pending' || order.voided) return
      const total = orderTotal(order.lines)
      const paidSafe =
        payMethod === 'paypal'
          ? total
          : Math.max(0, Math.round(paid * 100) / 100)
      const tipSafe = Math.max(0, Math.round(tip * 100) / 100)
      const change =
        payMethod === 'paypal'
          ? 0
          : Math.round((paidSafe - total - tipSafe) * 100) / 100
      const nowDate = new Date()
      const paidAt = stampCompletedAt(order.createdAt, nowDate)
      patchStallOps((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === id
            ? touchOrder(o, {
                status: 'pending',
                paid: paidSafe,
                tip: tipSafe > 0 ? tipSafe : undefined,
                change,
                payMethod,
                paidAt,
              })
            : o,
        ),
      }))
    },
    [patchStallOps],
  )

  const setEventParticipants = useCallback(
    (eventId: string, people: EventParticipant[]) => {
      const id = String(eventId || '').trim()
      if (!id) return
      setState((prev) => {
        const next: StallOpsState = {
          ...prev,
          eventParticipants: {
            ...(prev.eventParticipants || {}),
            [id]: people,
          },
        }
        saveStallOpsLocal(next)
        if (cloud && user) {
          if (!navigator.onLine) {
            enqueueOffline({ kind: 'stall_ops', payload: next })
          } else {
            void saveStallOpsCloud(next).catch(() => {
              enqueueOffline({ kind: 'stall_ops', payload: next })
            })
          }
        }
        return next
      })
    },
    [cloud, user],
  )

  const setPaypalQrDataUrl = useCallback(
    (dataUrl: string) => {
      const next = dataUrl.trim()
      const now = new Date().toISOString()
      patchStallOps((prev) => {
        const url =
          next.startsWith('data:image/') || next === ''
            ? next
            : prev.paypalQrDataUrl || ''
        return {
          ...prev,
          paypalQrDataUrl: url,
          paypalQrUpdatedAt: now,
        }
      })
    },
    [patchStallOps],
  )

  const addTeamTodo = useCallback(
    (input: { text: string; assignee: PrepAssignee; dueYmd: string; dueTime?: string }) => {
      const text = input.text.trim()
      if (!text || !input.dueYmd) return
      const now = new Date().toISOString()
      const todo: TeamTodo = {
        id: newId('todo'),
        text,
        done: false,
        assignee: input.assignee,
        dueYmd: input.dueYmd,
        dueTime: input.dueTime,
        createdAt: now,
        updatedAt: now,
      }
      persist({ ...state, teamTodos: [todo, ...(state.teamTodos || [])] })
    },
    [persist, state],
  )

  const updateTeamTodo = useCallback(
    (id: string, patch: Partial<TeamTodo>) => {
      persist({
        ...state,
        teamTodos: (state.teamTodos || []).map((t) => {
          if (t.id !== id) return t
          const next: TeamTodo = {
            ...t,
            ...patch,
            id,
            updatedAt: new Date().toISOString(),
          }
          if ('reminded24hAt' in patch && patch.reminded24hAt == null) delete next.reminded24hAt
          if ('reminded2hAt' in patch && patch.reminded2hAt == null) delete next.reminded2hAt
          if (patch.dueTime !== undefined && !patch.dueTime) delete next.dueTime
          if (patch.text != null) next.text = String(patch.text).trim() || t.text
          if (patch.dueYmd != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(patch.dueYmd))) {
            next.dueYmd = t.dueYmd
          }
          return next
        }),
      })
    },
    [persist, state],
  )

  const deleteTeamTodo = useCallback(
    (id: string) => {
      persist({
        ...state,
        teamTodos: (state.teamTodos || []).filter((t) => t.id !== id),
      })
    },
    [persist, state],
  )

  const upsertTeamGoal = useCallback(
    (goal: TeamGoal) => {
      const list = state.teamGoals || []
      const idx = list.findIndex((g) => g.id === goal.id)
      const next =
        idx >= 0 ? list.map((g, i) => (i === idx ? goal : g)) : [...list, goal]
      persist({ ...state, teamGoals: next })
    },
    [persist, state],
  )

  const deleteTeamGoal = useCallback(
    (id: string) => {
      persist({
        ...state,
        teamGoals: (state.teamGoals || []).filter((g) => g.id !== id),
      })
    },
    [persist, state],
  )

  const setGoalMilestone = useCallback(
    (goalId: string, milestoneId: string, patch: Partial<GoalMilestone>) => {
      persist({
        ...state,
        teamGoals: (state.teamGoals || []).map((g) => {
          if (g.id !== goalId) return g
          return {
            ...g,
            milestones: g.milestones.map((m) => {
              if (m.id !== milestoneId) return m
              const next = { ...m, ...patch, id: m.id }
              if (patch.dueDate !== undefined) {
                const due = String(patch.dueDate || '').slice(0, 10)
                if (/^\d{4}-\d{2}-\d{2}$/.test(due)) next.dueDate = due
                else delete next.dueDate
              }
              return next
            }),
          }
        }),
      })
    },
    [persist, state],
  )

  const addGoalMilestone = useCallback(
    (goalId: string, label: string, targetAmount?: number, dueDate?: string) => {
      const trimmed = label.trim()
      if (!trimmed) return
      const due = String(dueDate || '').slice(0, 10)
      const dueOk = /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : undefined
      persist({
        ...state,
        teamGoals: (state.teamGoals || []).map((g) =>
          g.id === goalId
            ? {
                ...g,
                milestones: [
                  ...g.milestones,
                  {
                    id: newId('ms'),
                    label: trimmed,
                    done: false,
                    targetAmount,
                    ...(dueOk ? { dueDate: dueOk } : {}),
                  },
                ],
              }
            : g,
        ),
      })
    },
    [persist, state],
  )

  const setEventStockQty = useCallback(
    (eventId: string, itemId: string, qty: number) => {
      if (!eventId || !itemId) return
      const n = Math.max(0, Math.round(qty))
      const prev = { ...(state.eventStock || {}) }
      const row = { ...(prev[eventId] || {}) }
      if (n <= 0) delete row[itemId]
      else row[itemId] = n
      if (Object.keys(row).length === 0) delete prev[eventId]
      else prev[eventId] = row
      persist({ ...state, eventStock: prev })
    },
    [persist, state],
  )

  const setNotifyEmail = useCallback(
    (name: TeamMemberName, email: string) => {
      const trimmed = email.trim().toLowerCase()
      const next = { ...(state.notifyEmails || {}) }
      if (!trimmed) delete next[name]
      else next[name] = trimmed
      persist({ ...state, notifyEmails: next })
    },
    [persist, state],
  )

  const postTeamChat = useCallback(
    (text: string) => {
      const trimmed = text.trim().slice(0, 1000)
      if (!trimmed) return
      const msg: TeamChatMessage = {
        id: newId('chat'),
        from: user?.name || 'Team',
        text: trimmed,
        createdAt: new Date().toISOString(),
      }
      persist({
        ...state,
        teamChat: [msg, ...(state.teamChat || [])].slice(0, 300),
      })
    },
    [persist, state, user?.name],
  )

  const postAnnouncement = useCallback(
    (title: string, body: string, pinned = false) => {
      const t = title.trim().slice(0, 120) || 'Announcement'
      const b = body.trim().slice(0, 2000)
      if (!b) return
      const ann: TeamAnnouncement = {
        id: newId('ann'),
        title: t,
        body: b,
        from: user?.name || 'Team',
        createdAt: new Date().toISOString(),
        pinned,
      }
      persist({
        ...state,
        announcements: [ann, ...(state.announcements || [])].slice(0, 80),
      })
    },
    [persist, state, user?.name],
  )

  const deleteAnnouncement = useCallback(
    (id: string) => {
      persist({
        ...state,
        announcements: (state.announcements || []).filter((a) => a.id !== id),
      })
    },
    [persist, state],
  )

  const upsertBusinessCard = useCallback(
    (card: Partial<BusinessCard> & { id?: string }) => {
      const now = new Date().toISOString()
      const id = String(card.id || newId('card'))
      const prev = (state.businessCards || []).find((c) => c.id === id)
      const next: BusinessCard = {
        id,
        name: String(card.name ?? prev?.name ?? 'Contact').trim().slice(0, 120) || 'Contact',
        company: card.company !== undefined ? card.company?.trim().slice(0, 120) : prev?.company,
        role: card.role !== undefined ? card.role?.trim().slice(0, 80) : prev?.role,
        phone: card.phone !== undefined ? card.phone?.trim().slice(0, 40) : prev?.phone,
        email: card.email !== undefined ? card.email?.trim().slice(0, 120) : prev?.email,
        notes: card.notes !== undefined ? card.notes?.trim().slice(0, 1000) : prev?.notes,
        extractedText:
          card.extractedText !== undefined
            ? card.extractedText?.trim().slice(0, 4000)
            : prev?.extractedText,
        frontImageUrl:
          card.frontImageUrl !== undefined ? card.frontImageUrl : prev?.frontImageUrl,
        backImageUrl: card.backImageUrl !== undefined ? card.backImageUrl : prev?.backImageUrl,
        eventId: card.eventId !== undefined ? card.eventId : prev?.eventId,
        createdAt: prev?.createdAt || now,
        updatedAt: now,
      }
      const rest = (state.businessCards || []).filter((c) => c.id !== id)
      persist({ ...state, businessCards: [next, ...rest].slice(0, 200) })
      return id
    },
    [persist, state],
  )

  const deleteBusinessCard = useCallback(
    (id: string) => {
      persist({
        ...state,
        businessCards: (state.businessCards || []).filter((c) => c.id !== id),
      })
    },
    [persist, state],
  )


  const upsertAppEvent = useCallback(
    (input: Partial<EventRow> & { id?: string }) => {
      if (!canManageStallEvents(user)) return ''
      const book = normalizeEventBook(state.eventBook || emptyEventBook())
      const startDate = input.startDate ? String(input.startDate).slice(0, 10) : null
      const endDate = input.endDate ? String(input.endDate).slice(0, 10) : startDate
      const id = String(input.id || newEventId(input.location || '', startDate)).trim()
      const existingExtra = book.extras.find((e) => e.id === id)
      // mapsQuery is Developer-only (setEventMapsQuery) — preserve existing pin.
      const mapsQuery = String(existingExtra?.mapsQuery || '').trim()
      const row: EventRow = {
        id,
        name: String(input.name || existingExtra?.name || 'Stall').trim() || 'Stall',
        location: String(input.location ?? existingExtra?.location ?? '').trim(),
        ...(mapsQuery ? { mapsQuery } : {}),
        startDate: startDate ?? existingExtra?.startDate ?? null,
        endDate: endDate ?? existingExtra?.endDate ?? null,
        month: (startDate || existingExtra?.startDate || '').slice(0, 7) || null,
        days: Number(input.days) || existingExtra?.days || 1,
        fee: Number(input.fee ?? existingExtra?.fee) || 0,
        status: normalizeEventStatus(input.status || existingExtra?.status || 'Applied'),
      }
      if (row.startDate && row.endDate) {
        const diff =
          Math.round(
            (new Date(row.endDate + 'T12:00:00').getTime() -
              new Date(row.startDate + 'T12:00:00').getTime()) /
              86400000,
          ) + 1
        if (diff > 0) row.days = diff
      }
      const extras = [...book.extras.filter((e) => e.id !== id), row].slice(0, 200)
      const patches = { ...book.patches }
      delete patches[id]
      persist({ ...state, eventBook: { extras, patches } })
      return id
    },
    [persist, state, user],
  )

  const patchEvent = useCallback(
    (id: string, patch: Partial<EventRow>) => {
      if (!canManageStallEvents(user)) return
      const eid = String(id || '').trim()
      if (!eid) return
      // Strip map pin — Developer uses setEventMapsQuery only.
      const { mapsQuery: _mq, ...safePatch } = patch
      const book = normalizeEventBook(state.eventBook || emptyEventBook())
      const inExtras = book.extras.some((e) => e.id === eid)
      if (inExtras) {
        const extras = book.extras.map((e) => {
          if (e.id !== eid) return e
          return {
            ...e,
            ...safePatch,
            id: eid,
            mapsQuery: e.mapsQuery,
            status: safePatch.status != null ? normalizeEventStatus(safePatch.status) : e.status,
            startDate:
              safePatch.startDate !== undefined
                ? safePatch.startDate
                  ? String(safePatch.startDate).slice(0, 10)
                  : null
                : e.startDate,
            endDate:
              safePatch.endDate !== undefined
                ? safePatch.endDate
                  ? String(safePatch.endDate).slice(0, 10)
                  : null
                : e.endDate,
          }
        })
        persist({ ...state, eventBook: { ...book, extras } })
        return
      }
      persist({
        ...state,
        eventBook: {
          ...book,
          patches: {
            ...book.patches,
            [eid]: {
              ...(book.patches[eid] || {}),
              ...safePatch,
              ...(safePatch.status != null
                ? { status: normalizeEventStatus(safePatch.status) }
                : {}),
            },
          },
        },
      })
    },
    [persist, state, user],
  )

  const setEventMapsQuery = useCallback(
    (id: string, mapsQuery: string) => {
      if (!canDevelop(user)) return
      const eid = String(id || '').trim()
      if (!eid) return
      const pin = String(mapsQuery || '').trim()
      const book = normalizeEventBook(state.eventBook || emptyEventBook())
      const inExtras = book.extras.some((e) => e.id === eid)
      if (inExtras) {
        const extras = book.extras.map((e) => {
          if (e.id !== eid) return e
          const next: EventRow = { ...e }
          if (pin) next.mapsQuery = pin
          else delete next.mapsQuery
          return next
        })
        persist({ ...state, eventBook: { ...book, extras } })
        return
      }
      const prevPatch = { ...(book.patches[eid] || {}) }
      if (pin) prevPatch.mapsQuery = pin
      else {
        prevPatch.mapsQuery = ''
      }
      persist({
        ...state,
        eventBook: {
          ...book,
          patches: {
            ...book.patches,
            [eid]: prevPatch,
          },
        },
      })
    },
    [persist, state, user],
  )

  const removeAppEvent = useCallback(
    (id: string) => {
      if (!canManageStallEvents(user)) return
      const eid = String(id || '').trim()
      if (!eid) return
      const book = normalizeEventBook(state.eventBook || emptyEventBook())
      const patches = { ...book.patches }
      delete patches[eid]
      persist({
        ...state,
        eventBook: {
          extras: book.extras.filter((e) => e.id !== eid),
          patches,
        },
      })
    },
    [persist, state, user],
  )

  const addCalendarNote = useCallback(
    (date: string, title: string, note?: string) => {
      if (!canManageStallEvents(user)) return
      const d = String(date || '').slice(0, 10)
      const titleTrim = String(title || '').trim().slice(0, 120)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !titleTrim) return
      const entry: CalendarNote = {
        id: newId('cnote'),
        date: d,
        title: titleTrim,
        note: note?.trim().slice(0, 500) || undefined,
        createdAt: new Date().toISOString(),
        from: user?.name,
      }
      persist({
        ...state,
        calendarNotes: [entry, ...(state.calendarNotes || [])].slice(0, 400),
      })
    },
    [persist, state, user],
  )

  const deleteCalendarNote = useCallback(
    (id: string) => {
      if (!canManageStallEvents(user)) return
      persist({
        ...state,
        calendarNotes: (state.calendarNotes || []).filter((n) => n.id !== id),
      })
    },
    [persist, state, user],
  )

  const reopenOrder = useCallback(
    (id: string) => {
      patchStallOps((prev) => {
        const order = prev.orders.find((o) => o.id === id)
        const reversed = reverseAutoUseForOrder(
          prev.stock,
          prev.stockAutoUseApplied,
          order,
          mergeStockAutoUse(prev.stockAutoUse),
        )
        return {
          ...prev,
          stock: reversed.stock,
          stockAutoUseApplied: reversed.stockAutoUseApplied,
          orders: prev.orders.map((o) => {
            if (o.id !== id) return o
            // Drop completion fields so a stale cloud “completed” can’t win on status rank.
            const next = touchOrder(o, {
              status: 'pending',
              paid: undefined,
              tip: undefined,
              change: undefined,
              payMethod: undefined,
              paidAt: undefined,
            })
            delete next.completedAt
            delete next.paidAt
            return next
          }),
        }
      })
    },
    [patchStallOps],
  )

  const deleteOrder = useCallback(
    (id: string) => {
      patchStallOps((prev) => withDeletedOrder(prev, id))
    },
    [patchStallOps],
  )

  const voidOrder = useCallback(
    (id: string, reason: string) => {
      const why = reason.trim()
      if (!why) return
      const now = new Date().toISOString()
      patchStallOps((prev) => {
        const order = prev.orders.find((o) => o.id === id)
        const reversed = reverseAutoUseForOrder(
          prev.stock,
          prev.stockAutoUseApplied,
          order,
          mergeStockAutoUse(prev.stockAutoUse),
        )
        return {
          ...prev,
          stock: reversed.stock,
          stockAutoUseApplied: reversed.stockAutoUseApplied,
          orders: prev.orders.map((o) =>
            o.id === id
              ? touchOrder(o, {
                  voided: true,
                  voidReason: why,
                  voidedAt: now,
                })
              : o,
          ),
        }
      })
    },
    [patchStallOps],
  )

  const resolveOrderConflict = useCallback(
    (orderId: string, keep: 'mine' | 'theirs') => {
      const conflict = orderConflicts.find((item) => item.orderId === orderId)
      if (keep === 'mine' && conflict) {
        patchStallOps((prev) => {
          const localOrder = conflict.local
          const exists = prev.orders.some((order) => order.id === orderId)
          return {
            ...prev,
            orders: exists
              ? prev.orders.map((order) =>
                  order.id === orderId ? touchOrder(localOrder) : order,
                )
              : [touchOrder(localOrder), ...prev.orders],
          }
        })
      }
      if (keep === 'theirs' && conflict) {
        patchStallOps((prev) => {
          const remoteOrder = conflict.remote
          const exists = prev.orders.some((order) => order.id === orderId)
          return {
            ...prev,
            orders: exists
              ? prev.orders.map((order) =>
                  order.id === orderId ? touchOrder(remoteOrder) : order,
                )
              : [touchOrder(remoteOrder), ...prev.orders],
          }
        })
      }
      setOrderConflicts((current) => current.filter((item) => item.orderId !== orderId))
    },
    [orderConflicts, patchStallOps],
  )

  const dismissOrderConflict = useCallback((orderId: string) => {
    setOrderConflicts((current) => current.filter((item) => item.orderId !== orderId))
  }, [])

  const ensurePrepChecklist = useCallback(
    (eventId: string) => {
      if (!eventId) return
      const cur = state.prepChecklists?.[eventId]
      if (cur?.length) return
      persist({
        ...state,
        prepChecklists: {
          ...(state.prepChecklists || {}),
          [eventId]: defaultPrepChecklist(),
        },
      })
    },
    [persist, state],
  )

  const setPrepTask = useCallback(
    (
      eventId: string,
      taskId: string,
      patch: Partial<Pick<PrepTask, 'done' | 'assignee' | 'text'>>,
    ) => {
      if (!eventId) return
      const list = state.prepChecklists?.[eventId] || defaultPrepChecklist()
      persist({
        ...state,
        prepChecklists: {
          ...(state.prepChecklists || {}),
          [eventId]: list.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
        },
      })
    },
    [persist, state],
  )

  const addPrepTask = useCallback(
    (eventId: string, text: string, assignee: PrepAssignee = '') => {
      const trimmed = text.trim()
      if (!eventId || !trimmed) return
      const list = state.prepChecklists?.[eventId] || defaultPrepChecklist()
      persist({
        ...state,
        prepChecklists: {
          ...(state.prepChecklists || {}),
          [eventId]: [...list, { id: newId('prep'), text: trimmed, done: false, assignee }],
        },
      })
    },
    [persist, state],
  )

  const lowStock = useMemo(() => state.stock.filter(isLowStock), [state.stock])

  const value = useMemo(
    () => ({
      stock: state.stock,
      menu: state.menu,
      orders: state.orders,
      recipes: mergeRecipes(state.recipes),
      setRecipe,
      stockAutoUse: mergeStockAutoUse(state.stockAutoUse),
      setStockAutoUse,
      activeEventId: state.activeEventId || '',
      publicMenuKey: state.publicMenuKey || '',
      publicMenuLabel: state.publicMenuLabel || '',
      eventPrices: state.eventPrices || {},
      eventTypeHiddenMenu: state.eventTypeHiddenMenu || {},
      eventMenus: state.eventMenus || {},
      customEventTypes: state.customEventTypes || [],
      prepChecklists: state.prepChecklists || {},
      eventParticipants: state.eventParticipants || {},
      paypalQrDataUrl: state.paypalQrDataUrl || '',
      teamTodos: state.teamTodos || [],
      teamGoals: state.teamGoals || [],
      eventStock: state.eventStock || {},
      foodMade: state.foodMade || {},
      carryFoodToNextDay,
      notifyEmails: state.notifyEmails || {},
      teamChat: state.teamChat || [],
      postTeamChat,
      announcements: state.announcements || [],
      postAnnouncement,
      deleteAnnouncement,
      businessCards: state.businessCards || [],
      upsertBusinessCard,
      deleteBusinessCard,
      eventBook: state.eventBook || emptyEventBook(),
      calendarNotes: state.calendarNotes || [],
      upsertAppEvent,
      patchEvent,
      setEventMapsQuery,
      removeAppEvent,
      addCalendarNote,
      deleteCalendarNote,
      lowStock,
      syncing,
      nextCustomer,
      buyStock,
      useStock,
      setStockLowAt,
      addStockItem,
      updateStockItem,
      removeStockItem,
      setFoodMadeQty,
      clearFoodMadeItem,
      setMenuPrice,
      setComboDefaultPrices,
      updateMenuItem,
      setMenuFoodCost,
      setMenuImageUrl,
      pushMenuPhotosToCloud,
      removeMenuItem,
      moveMenuItem,
      setEventPrice,
      clearEventPrices,
      copyEventPrices,
      setMenuHiddenForEventType,
      addMenuItem,
      ensureEventMenu,
      rehomeLegacyEventMenus,
      syncEventMenuFromPublic,
      addCustomEventType,
      updateEventMenuItem,
      removeEventMenuItem,
      moveEventMenuItem,
      addEventMenuItem,
      copyEventMenu,
      clearEventMenu,
      setActiveEventId,
      createOrder,
      claimCustomerOrder,
      awaitingClaim,
      updatePendingOrder,
      setOrderLineDelivered,
      markAllLinesDelivered,
      completeOrder,
      markOrderPaid,
      reopenOrder,
      deleteOrder,
      voidOrder,
      orderConflicts,
      resolveOrderConflict,
      dismissOrderConflict,
      setEventParticipants,
      setPaypalQrDataUrl,
      addTeamTodo,
      updateTeamTodo,
      deleteTeamTodo,
      upsertTeamGoal,
      deleteTeamGoal,
      setGoalMilestone,
      addGoalMilestone,
      setEventStockQty,
      setNotifyEmail,
      ensurePrepChecklist,
      setPrepTask,
      addPrepTask,
      refreshStallOps,
    }),
    [
      state,
      orderConflicts,
      lowStock,
      syncing,
      nextCustomer,
      awaitingClaim,
      buyStock,
      useStock,
      setStockLowAt,
      addStockItem,
      updateStockItem,
      removeStockItem,
      setFoodMadeQty,
      clearFoodMadeItem,
      carryFoodToNextDay,
      setRecipe,
      setStockAutoUse,
      setMenuPrice,
      setComboDefaultPrices,
      updateMenuItem,
      setMenuFoodCost,
      setMenuImageUrl,
      pushMenuPhotosToCloud,
      removeMenuItem,
      moveMenuItem,
      setEventPrice,
      clearEventPrices,
      copyEventPrices,
      setMenuHiddenForEventType,
      addMenuItem,
      ensureEventMenu,
      rehomeLegacyEventMenus,
      syncEventMenuFromPublic,
      addCustomEventType,
      updateEventMenuItem,
      removeEventMenuItem,
      moveEventMenuItem,
      addEventMenuItem,
      copyEventMenu,
      clearEventMenu,
      setActiveEventId,
      createOrder,
      claimCustomerOrder,
      updatePendingOrder,
      setOrderLineDelivered,
      markAllLinesDelivered,
      completeOrder,
      markOrderPaid,
      reopenOrder,
      deleteOrder,
      voidOrder,
      resolveOrderConflict,
      dismissOrderConflict,
      setEventParticipants,
      setPaypalQrDataUrl,
      addTeamTodo,
      updateTeamTodo,
      deleteTeamTodo,
      upsertTeamGoal,
      deleteTeamGoal,
      setGoalMilestone,
      addGoalMilestone,
      setEventStockQty,
      setNotifyEmail,
      postTeamChat,
      postAnnouncement,
      deleteAnnouncement,
      upsertBusinessCard,
      deleteBusinessCard,
      upsertAppEvent,
      patchEvent,
      setEventMapsQuery,
      removeAppEvent,
      addCalendarNote,
      deleteCalendarNote,
      ensurePrepChecklist,
      setPrepTask,
      addPrepTask,
      refreshStallOps,
    ],
  )

  return <StallOpsContext.Provider value={value}>{children}</StallOpsContext.Provider>
}

export function useStallOps() {
  const ctx = useContext(StallOpsContext)
  if (!ctx) throw new Error('useStallOps must be used within StallOpsProvider')
  return ctx
}

export { orderTotal, remainingOf }
