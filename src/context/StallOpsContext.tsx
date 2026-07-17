import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchStallOps, saveStallOpsCloud } from '../lib/cloudExtras'
import {
  enqueueOffline,
  offlineQueueCount,
  peekOfflineQueue,
  replaceOfflineQueue,
} from '../lib/offlineQueue'
import { isDemoMode } from '../lib/demoMode'
import {
  customerLabel,
  emptyStallOps,
  isLowStock,
  loadStallOps,
  newId,
  nextCustomerNumber,
  orderTotal,
  remainingOf,
  saveStallOpsLocal,
  slugId,
  defaultPrepChecklist,
  type EventPriceOverride,
  type MenuItem,
  type OrderLine,
  type PrepAssignee,
  type PrepTask,
  type StallOpsState,
  type StallOrder,
  type StockItem,
} from '../lib/stallOps'
import { isCloudConfigured } from '../lib/supabase'
import { useAuth } from './AuthContext'

interface StallOpsContextValue {
  stock: StockItem[]
  menu: MenuItem[]
  orders: StallOrder[]
  activeEventId: string
  eventPrices: Record<string, Record<string, EventPriceOverride>>
  lowStock: StockItem[]
  syncing: boolean
  buyStock: (itemId: string, qty: number) => void
  useStock: (itemId: string, qty: number) => void
  setStockLowAt: (itemId: string, lowAt: number) => void
  addStockItem: (name: string, unit?: string, lowAt?: number) => void
  setMenuPrice: (id: string, price: number) => void
  setComboDefaultPrices: (id: string, chai: number, lassi: number) => void
  setEventPrice: (eventId: string, itemId: string, patch: EventPriceOverride) => void
  clearEventPrices: (eventId: string) => void
  copyEventPrices: (fromEventId: string, toEventId: string) => boolean
  addMenuItem: (name: string, price: number) => void
  setActiveEventId: (eventId: string) => void
  /** Auto Customer 1, 2, … (resets each Germany calendar day). */
  nextCustomer: number
  createOrder: (lines: OrderLine[]) => void
  updatePendingOrder: (id: string, lines: OrderLine[]) => void
  completeOrder: (id: string, paid: number) => void
  reopenOrder: (id: string) => void
  deleteOrder: (id: string) => void
  voidOrder: (id: string, reason: string) => void
  prepChecklists: Record<string, PrepTask[]>
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

  const persist = useCallback(
    (next: StallOpsState) => {
      setState(next)
      saveStallOpsLocal(next)
      if (!cloud || !user) return
      if (!navigator.onLine) {
        enqueueOffline({ kind: 'stall_ops', payload: next })
        return
      }
      void saveStallOpsCloud(next).catch(() => {
        enqueueOffline({ kind: 'stall_ops', payload: next })
      })
    },
    [cloud, user],
  )

  const refreshStallOps = useCallback(async () => {
    if (!cloud || !user) {
      setState(loadStallOps())
      return
    }
    setSyncing(true)
    try {
      const remote = await fetchStallOps()
      if (remote) {
        saveStallOpsLocal(remote)
        setState(remote)
      } else {
        const local = loadStallOps()
        await saveStallOpsCloud(local).catch(() => undefined)
        setState(local)
      }
    } finally {
      setSyncing(false)
    }
  }, [cloud, user])

  useEffect(() => {
    void refreshStallOps()
  }, [refreshStallOps])

  useEffect(() => {
    const on = async () => {
      const ops = peekOfflineQueue()
      const still = []
      for (const op of ops) {
        if (op.kind !== 'stall_ops') {
          still.push(op)
          continue
        }
        try {
          await saveStallOpsCloud(op.payload as unknown as StallOpsState)
        } catch {
          still.push(op)
        }
      }
      replaceOfflineQueue(still)
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

  const setEventPrice = useCallback(
    (eventId: string, itemId: string, patch: EventPriceOverride) => {
      if (!eventId) return
      const prevEv = state.eventPrices?.[eventId] || {}
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
          [eventId]: { ...prevEv, [itemId]: nextItem },
        },
      })
    },
    [persist, state],
  )

  const clearEventPrices = useCallback(
    (eventId: string) => {
      if (!eventId) return
      const next = { ...(state.eventPrices || {}) }
      delete next[eventId]
      persist({ ...state, eventPrices: next })
    },
    [persist, state],
  )

  const copyEventPrices = useCallback(
    (fromEventId: string, toEventId: string) => {
      if (!fromEventId || !toEventId || fromEventId === toEventId) return false
      const src = state.eventPrices?.[fromEventId]
      if (!src || !Object.keys(src).length) return false
      persist({
        ...state,
        eventPrices: {
          ...(state.eventPrices || {}),
          [toEventId]: { ...src },
        },
      })
      return true
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

  const nextCustomer = useMemo(() => nextCustomerNumber(state.orders), [state.orders])

  const setActiveEventId = useCallback(
    (eventId: string) => {
      persist({ ...state, activeEventId: eventId })
    },
    [persist, state],
  )

  const createOrder = useCallback(
    (lines: OrderLine[]) => {
      const clean = lines.filter((l) => l.qty > 0)
      if (!clean.length) return
      const n = nextCustomerNumber(state.orders)
      const order: StallOrder = {
        id: newId('ord'),
        label: customerLabel(n),
        status: 'pending',
        lines: clean,
        createdAt: new Date().toISOString(),
        eventId: state.activeEventId || undefined,
      }
      persist({ ...state, orders: [order, ...state.orders] })
    },
    [persist, state],
  )

  const updatePendingOrder = useCallback(
    (id: string, lines: OrderLine[]) => {
      persist({
        ...state,
        orders: state.orders.map((o) => {
          if (o.id !== id || o.status !== 'pending') return o
          return {
            ...o,
            lines: lines.filter((l) => l.qty > 0),
          }
        }),
      })
    },
    [persist, state],
  )

  const completeOrder = useCallback(
    (id: string, paid: number) => {
      const order = state.orders.find((o) => o.id === id)
      if (!order) return
      const total = orderTotal(order.lines)
      const paidSafe = Math.max(0, Math.round(paid * 100) / 100)
      const change = Math.round((paidSafe - total) * 100) / 100
      persist({
        ...state,
        orders: state.orders.map((o) =>
          o.id === id
            ? {
                ...o,
                status: 'completed',
                completedAt: new Date().toISOString(),
                paid: paidSafe,
                change,
              }
            : o,
        ),
      })
    },
    [persist, state],
  )

  const reopenOrder = useCallback(
    (id: string) => {
      persist({
        ...state,
        orders: state.orders.map((o) =>
          o.id === id
            ? {
                ...o,
                status: 'pending',
                completedAt: undefined,
                paid: undefined,
                change: undefined,
              }
            : o,
        ),
      })
    },
    [persist, state],
  )

  const deleteOrder = useCallback(
    (id: string) => {
      persist({ ...state, orders: state.orders.filter((o) => o.id !== id) })
    },
    [persist, state],
  )

  const voidOrder = useCallback(
    (id: string, reason: string) => {
      const why = reason.trim()
      if (!why) return
      persist({
        ...state,
        orders: state.orders.map((o) =>
          o.id === id
            ? {
                ...o,
                voided: true,
                voidReason: why,
                voidedAt: new Date().toISOString(),
              }
            : o,
        ),
      })
    },
    [persist, state],
  )

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
      activeEventId: state.activeEventId || '',
      eventPrices: state.eventPrices || {},
      prepChecklists: state.prepChecklists || {},
      lowStock,
      syncing,
      nextCustomer,
      buyStock,
      useStock,
      setStockLowAt,
      addStockItem,
      setMenuPrice,
      setComboDefaultPrices,
      setEventPrice,
      clearEventPrices,
      copyEventPrices,
      addMenuItem,
      setActiveEventId,
      createOrder,
      updatePendingOrder,
      completeOrder,
      reopenOrder,
      deleteOrder,
      voidOrder,
      ensurePrepChecklist,
      setPrepTask,
      addPrepTask,
      refreshStallOps,
    }),
    [
      state,
      lowStock,
      syncing,
      nextCustomer,
      buyStock,
      useStock,
      setStockLowAt,
      addStockItem,
      setMenuPrice,
      setComboDefaultPrices,
      setEventPrice,
      clearEventPrices,
      copyEventPrices,
      addMenuItem,
      setActiveEventId,
      createOrder,
      updatePendingOrder,
      completeOrder,
      reopenOrder,
      deleteOrder,
      voidOrder,
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
