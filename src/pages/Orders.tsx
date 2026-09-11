import {
  ArrowDown,
  ArrowUp,
  Award,
  Banknote,
  Check,
  ClipboardList,
  Monitor,
  Minus,
  Pencil,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStallOpsPoll } from '../hooks/useStallOpsPoll'
import { EditableText } from '../components/EditableText'
import { EuroInput } from '../components/EuroInput'
import { Money } from '../components/Money'
import { MotionCard } from '../components/MotionCard'
import { PillTabs } from '../components/PillTabs'
import { QtyPop } from '../components/QtyPop'
import { GermanSpokenAmount } from '../components/GermanSpokenAmount'
import { SameDayPeerChip } from '../components/SameDayPeerChip'
import { roundEuro } from '../lib/euroAmount'
import { useData } from '../context/DataContext'
import { useLocale } from '../context/LocaleContext'
import { useOrdersStallIdle, useStallMode } from '../context/StallModeContext'
import { orderTotal, useStallOps } from '../context/StallOpsContext'
import {
  allUnlockedForDay,
  evaluateAchievements,
  type AchievementDef,
} from '../lib/achievements'
import { eventCalendarDays } from '../lib/calendar'
import { formatChangeSuggestion, suggestChange } from '../lib/changeDrawer'
import { openCustomerDisplay, publishDisplay } from '../lib/displaySync'
import { formatGermanyDateTime, germanyTodayYmd, germanyYmd } from '../lib/germanyTime'
import { getPaypalMeUrl, resolvePaypalQrSrc } from '../lib/paypalMe'
import { summarizePayMethods, summarizePosCashToday } from '../lib/posCash'
import { sameDayPeerEvents } from '../lib/sameDayPeerEvents'
import { buildSalesReport } from '../lib/salesStats'
import { printQueueTicket } from '../lib/ticketPrint'
import { playClaimChime } from '../lib/sounds'
import { springSoft } from '../lib/motion'
import { formatWaitLabel, waitMinutesSince, waitTone } from '../lib/waitTime'
import {
  isEventIdKey,
  isOrderPrepaid,
  joinComboContents,
  lineDeliveredQty,
  lineKey,
  listEventTypes,
  makeOrderLine,
  menuForEventType,
  parseComboContents,
  groupOrdersByEvent,
  missingCustomerNumbers,
  orderFullyDelivered,
  parseCustomerNumber,
  priceKeyForEvent,
  resolveMenuPrice,
  soldCounts,
  sortOrdersByCustomer,
  stampCompletedAt,
  type DrinkChoice,
  type EventPriceOverride,
  type MenuItem,
  type OrderLine,
  type PayMethod,
  type StallOrder,
} from '../lib/stallOps'
const DRINK_IDS = new Set(['masala-chai', 'mango-lassi'])
/** Gobi / Blumenkohl 65 and similar sides — shown under Snacks, not Main dishes. */
const SNACK_IDS = new Set(['gobi-65', 'medu-vada', 'custom-mrwgvuy8-k7m'])

function PayMethodTotals({
  cashRevenue,
  paypalRevenue,
  totalRevenue,
  cashOrders,
  paypalOrders,
}: {
  cashRevenue: number
  paypalRevenue: number
  totalRevenue: number
  cashOrders: number
  paypalOrders: number
}) {
  return (
    <div className="grid kpi" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
      <div>
        <div className="kpi-label">Cash</div>
        <div className="kpi-value" style={{ fontSize: '1.25rem' }}>
          <Money value={cashRevenue} />
        </div>
        <div className="hint-inline">{cashOrders} order{cashOrders === 1 ? '' : 's'}</div>
      </div>
      <div>
        <div className="kpi-label">PayPal</div>
        <div className="kpi-value" style={{ fontSize: '1.25rem' }}>
          <Money value={paypalRevenue} />
        </div>
        <div className="hint-inline">{paypalOrders} order{paypalOrders === 1 ? '' : 's'}</div>
      </div>
      <div>
        <div className="kpi-label">Total</div>
        <div className="kpi-value" style={{ fontSize: '1.25rem' }}>
          <Money value={totalRevenue} />
        </div>
        <div className="hint-inline">
          {cashOrders + paypalOrders} order{cashOrders + paypalOrders === 1 ? '' : 's'}
        </div>
      </div>
    </div>
  )
}

function isSnackItem(m: { id: string; name: string }): boolean {
  if (SNACK_IDS.has(m.id)) return true
  const n = m.name.trim().toLowerCase()
  return (
    n.includes('medu vada') ||
    n.includes('blumenkohl') ||
    n.includes('gobi 65') ||
    n.includes('gobi65') ||
    n === 'gobi-65'
  )
}

function shortDrink(drink: DrinkChoice): string {
  return drink === 'chai' ? 'Chai' : 'Lassi'
}

type Tab = 'new' | 'pending' | 'completed' | 'totals' | 'sales' | 'menu'
type SalesScope = 'today' | 'event' | 'all'

function findLineQty(lines: OrderLine[], itemId: string, drink?: DrinkChoice): number {
  return (
    lines.find((l) => l.menuItemId === itemId && (l.drink || undefined) === (drink || undefined))
      ?.qty || 0
  )
}

function upsertLineQty(
  lines: OrderLine[],
  item: MenuItem,
  qty: number,
  eventId: string,
  eventPrices: Record<string, Record<string, EventPriceOverride>>,
  drink?: DrinkChoice,
): OrderLine[] {
  const d = item.kind === 'combo' ? drink : undefined
  const key = lineKey(item.id, d)
  const next = lines.filter((l) => lineKey(l.menuItemId, l.drink) !== key)
  if (qty > 0) next.push(makeOrderLine(item, qty, eventId, eventPrices, d))
  return next
}

export function Orders() {
  const { snapshot } = useData()
  const { tr } = useLocale()
  const { isStall, isGuestLocked, enterStall } = useStallMode()
  useOrdersStallIdle()
  const {
    menu,
    orders,
    activeEventId,
    publicMenuKey,
    publicMenuLabel,
    eventPrices,
    eventTypeHiddenMenu,
    eventMenus,
    customEventTypes,
    nextCustomer,
    createOrder,
    claimCustomerOrder,
    awaitingClaim,
    updatePendingOrder,
    completeOrder,
    markOrderPaid,
    reopenOrder,
    deleteOrder,
    voidOrder,
    refreshStallOps,
    ensureEventMenu,
    rehomeLegacyEventMenus,
    addCustomEventType,
    updateEventMenuItem,
    removeEventMenuItem,
    moveEventMenuItem,
    addEventMenuItem,
    copyEventMenu,
    clearEventMenu,
    setMenuFoodCost,
    setActiveEventId,
    paypalQrDataUrl,
    setOrderLineDelivered,
    markAllLinesDelivered,
    orderConflicts,
    resolveOrderConflict,
    dismissOrderConflict,
  } = useStallOps()

  const [tab, setTab] = useState<Tab>('new')
  const [claimCode, setClaimCode] = useState('')
  const [claimBusy, setClaimBusy] = useState(false)
  const [claimMsg, setClaimMsg] = useState<string | null>(null)
  const [claimOpen, setClaimOpen] = useState(false)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [editId, setEditId] = useState<string | null>(null)
  const [editLines, setEditLines] = useState<OrderLine[]>([])
  const [newMenuName, setNewMenuName] = useState('')
  const [newMenuPrice, setNewMenuPrice] = useState(5)
  const [newMenuKind, setNewMenuKind] = useState<'single' | 'combo'>('single')
  const [newEventTypeName, setNewEventTypeName] = useState('')
  const [comboAddPick, setComboAddPick] = useState<Record<string, string>>({})
  const [comboAddCustom, setComboAddCustom] = useState<Record<string, string>>({})
  const [payOrder, setPayOrder] = useState<StallOrder | null>(null)
  /** complete = pay & Sold; markPaid = pay now, stay in Pending kitchen. */
  const [payMode, setPayMode] = useState<'complete' | 'markPaid'>('complete')
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null)
  const [qrZoomed, setQrZoomed] = useState(false)
  const [paidInput, setPaidInput] = useState('')
  const [tipInput, setTipInput] = useState('0')
  const [badgeToast, setBadgeToast] = useState<AchievementDef | null>(null)
  const [salesScope, setSalesScope] = useState<SalesScope>('today')
  const [salesEventId, setSalesEventId] = useState('')
  const [priceEventType, setPriceEventType] = useState('')
  const [copyFromEventType, setCopyFromEventType] = useState('')
  const [voidTarget, setVoidTarget] = useState<StallOrder | null>(null)
  const [voidReason, setVoidReason] = useState('')
  /** Sold tab event filter (defaults to Event menu selection). */
  const [soldEventId, setSoldEventId] = useState('')
  /** '' = all days for that event. */
  const [soldDay, setSoldDay] = useState('')
  const [totalsDay, setTotalsDay] = useState('')
  const [pendingFilter, setPendingFilter] = useState<'all' | 'kitchen' | 'paid'>('all')
  const [waitNow, setWaitNow] = useState(() => Date.now())
  const submitLock = useRef(false)
  const payLock = useRef(false)
  const [cartBusy, setCartBusy] = useState(false)
  const [payBusy, setPayBusy] = useState(false)

  useEffect(() => {
    if (tab !== 'pending') return
    const t = window.setInterval(() => setWaitNow(Date.now()), 30000)
    return () => window.clearInterval(t)
  }, [tab])

  const events = snapshot?.events || []
  const stallEvents = useMemo(
    () =>
      [...events]
        .filter((e) => e.id.trim().toLowerCase() !== 'setup')
        .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')),
    [events],
  )
  const eventTypes = useMemo(
    () => listEventTypes(stallEvents, customEventTypes),
    [stallEvents, customEventTypes],
  )
  const activePriceKey = useMemo(
    () => priceKeyForEvent(activeEventId, stallEvents, eventTypes),
    [activeEventId, stallEvents, eventTypes],
  )
  function applyStallEvent(eventId: string) {
    const id = String(eventId || '').trim()
    if (!id) {
      setActiveEventId('')
      return
    }
    const typeKey = priceKeyForEvent(id, stallEvents, eventTypes)
    const ev = stallEvents.find((e) => e.id === id)
    const label = ev
      ? `${ev.id}${typeKey ? ` · ${typeKey}` : ''}${ev.location ? ` · ${ev.location}` : ''}`
      : id
    setActiveEventId(id, { menuKey: typeKey, label })
    if (typeKey) ensureEventMenu(typeKey)
  }

  useEffect(() => {
    if (activeEventId || !stallEvents.length) return
    const upcoming = stallEvents.find((e) => (e.status || '').toLowerCase() !== 'completed')
    applyStallEvent((upcoming || stallEvents[0])!.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEventId, stallEvents, eventTypes])

  // Keep public /order menu key aligned when type resolution catches up
  useEffect(() => {
    if (!activeEventId || !activePriceKey) return
    const ev = stallEvents.find((e) => e.id === activeEventId)
    const label = ev
      ? `${ev.id} · ${activePriceKey}${ev.location ? ` · ${ev.location}` : ''}`
      : activePriceKey
    if (publicMenuKey === activePriceKey && publicMenuLabel === label) return
    setActiveEventId(activeEventId, { menuKey: activePriceKey, label })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEventId, activePriceKey, publicMenuKey, publicMenuLabel])

  useEffect(() => {
    if (!stallEvents.length) return
    rehomeLegacyEventMenus(stallEvents)
  }, [stallEvents, rehomeLegacyEventMenus])

  useEffect(() => {
    const resolved = activePriceKey && !isEventIdKey(activePriceKey) ? activePriceKey : ''
    const invalid =
      isEventIdKey(priceEventType) ||
      (priceEventType && eventTypes.length > 0 && !eventTypes.includes(priceEventType))
    if (invalid) {
      setPriceEventType(resolved || eventTypes[0] || '')
      return
    }
    if (priceEventType) return
    if (resolved) setPriceEventType(resolved)
    else if (eventTypes[0]) setPriceEventType(eventTypes[0])
  }, [activePriceKey, priceEventType, eventTypes])

  useEffect(() => {
    if (!priceEventType) return
    ensureEventMenu(priceEventType)
  }, [priceEventType, ensureEventMenu])

  useEffect(() => {
    if (!activePriceKey) return
    ensureEventMenu(activePriceKey)
  }, [activePriceKey, ensureEventMenu])

  useEffect(() => {
    setCart({})
  }, [activeEventId, activePriceKey])

  useEffect(() => {
    if (isStall && (tab === 'sales' || tab === 'menu' || tab === 'totals')) setTab('new')
  }, [isStall, tab])

  useEffect(() => {
    if (tab === 'pending' && awaitingClaim.length > 0) setClaimOpen(true)
  }, [tab, awaitingClaim.length])

  useEffect(() => {
    setQrZoomed(false)
  }, [payOrder, payMethod])

  // Hide chat / announce / AI FABs while taking or claiming orders (mobile/tablet overlap).
  useEffect(() => {
    const hide = tab === 'new' || tab === 'pending'
    if (hide) document.documentElement.dataset.hideFab = '1'
    else delete document.documentElement.dataset.hideFab
    return () => {
      delete document.documentElement.dataset.hideFab
    }
  }, [tab])

  // Pick up QR customer orders — paused when tab hidden; slower with Data saver.
  useStallOpsPoll(refreshStallOps, 'orders')

  const pending = useMemo(() => {
    const eid = String(activeEventId || '').trim()
    return orders
      .filter((o) => {
        if (o.status !== 'pending') return false
        if (!eid) return true
        return String(o.eventId || '').trim() === eid
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [orders, activeEventId])

  const pendingKitchen = useMemo(
    () => pending.filter((o) => !isOrderPrepaid(o)),
    [pending],
  )
  const pendingPaid = useMemo(() => pending.filter((o) => isOrderPrepaid(o)), [pending])
  const pendingShown = useMemo(() => {
    if (pendingFilter === 'kitchen') return pendingKitchen
    if (pendingFilter === 'paid') return pendingPaid
    return pending
  }, [pending, pendingFilter, pendingKitchen, pendingPaid])

  // Keep Sold filter aligned with the kitchen Event menu.
  useEffect(() => {
    if (activeEventId) setSoldEventId(activeEventId)
  }, [activeEventId])

  useEffect(() => {
    setSoldDay('')
  }, [soldEventId])

  async function onClaimCode() {
    setClaimBusy(true)
    setClaimMsg(null)
    try {
      const res = await claimCustomerOrder(claimCode)
      if (!res.ok) {
        setClaimMsg(res.error || 'Could not claim')
        return
      }
      setClaimMsg(`Claimed → ${res.order?.label || 'pending'}`)
      setClaimCode('')
      setTab('pending')
      void playClaimChime()
    } finally {
      setClaimBusy(false)
    }
  }

  const completedAll = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'completed' && !o.voided)
        .sort((a, b) => (b.completedAt || b.createdAt).localeCompare(a.completedAt || a.createdAt)),
    [orders],
  )
  const soldFilterId = String(soldEventId || activeEventId || '').trim()
  const soldEventDays = useMemo(() => {
    if (!soldFilterId) return [] as string[]
    const ev = stallEvents.find((e) => e.id === soldFilterId)
    const days = new Set<string>(ev ? eventCalendarDays(ev) : [])
    for (const o of completedAll) {
      if (String(o.eventId || '').trim() !== soldFilterId) continue
      days.add(germanyYmd(new Date(o.completedAt || o.createdAt)))
    }
    return [...days].sort()
  }, [soldFilterId, stallEvents, completedAll])
  const totalsDays = useMemo(() => {
    const days = new Set<string>()
    for (const e of stallEvents) {
      for (const d of eventCalendarDays(e)) days.add(d)
    }
    for (const o of completedAll) {
      days.add(germanyYmd(new Date(o.completedAt || o.createdAt)))
    }
    return [...days].sort()
  }, [stallEvents, completedAll])
  const completed = useMemo(() => {
    if (!soldFilterId) return []
    let list = completedAll.filter((o) => String(o.eventId || '').trim() === soldFilterId)
    if (soldDay) {
      list = list.filter(
        (o) => germanyYmd(new Date(o.completedAt || o.createdAt)) === soldDay,
      )
    }
    return sortOrdersByCustomer(list)
  }, [completedAll, soldFilterId, soldDay])
  const totalsCompleted = useMemo(() => {
    if (!totalsDay) return completedAll
    return completedAll.filter(
      (o) => germanyYmd(new Date(o.completedAt || o.createdAt)) === totalsDay,
    )
  }, [completedAll, totalsDay])
  const voided = useMemo(() => {
    if (!soldFilterId) return []
    let list = orders.filter(
      (o) => o.voided && String(o.eventId || '').trim() === soldFilterId,
    )
    if (soldDay) {
      list = list.filter(
        (o) => germanyYmd(new Date(o.completedAt || o.createdAt || o.voidedAt || '')) === soldDay,
      )
    }
    return sortOrdersByCustomer(list)
  }, [orders, soldFilterId, soldDay])
  /** Paid vs ticket labels — e.g. Customer 63 exists but paid is 62 if #N was voided/deleted. */
  const soldStats = useMemo(() => {
    const eid = soldFilterId
    if (!eid) {
      return {
        paid: 0,
        voided: 0,
        pending: 0,
        maxTicket: 0,
        nextTicket: 1,
        untagged: 0,
        missing: [] as number[],
        missingNotes: [] as string[],
      }
    }
    let maxTicket = 0
    let pending = 0
    const byNum = new Map<number, StallOrder[]>()
    for (const o of orders) {
      if (String(o.eventId || '').trim() !== eid) continue
      const n = parseCustomerNumber(o.label)
      maxTicket = Math.max(maxTicket, n)
      if (o.status === 'pending' && !o.voided) pending += 1
      if (n > 0) {
        const list = byNum.get(n) || []
        list.push(o)
        byNum.set(n, list)
      }
    }
    const missing = missingCustomerNumbers(completed)
    const missingNotes = missing.map((n) => {
      const hits = byNum.get(n) || []
      if (!hits.length) return `#${n} deleted / never saved`
      if (hits.some((o) => o.voided)) return `#${n} voided`
      if (hits.some((o) => o.status === 'pending')) return `#${n} still pending`
      if (hits.some((o) => o.status === 'awaiting_claim')) return `#${n} awaiting claim`
      return `#${n} not in paid list`
    })
    const untagged = completedAll.filter((o) => !String(o.eventId || '').trim()).length
    const paidMax = Math.max(0, ...completed.map((o) => parseCustomerNumber(o.label)))
    return {
      paid: completed.length,
      voided: voided.length,
      pending,
      maxTicket: Math.max(maxTicket, paidMax),
      nextTicket: Math.max(maxTicket, paidMax) + 1,
      untagged,
      missing,
      missingNotes,
    }
  }, [soldFilterId, orders, completed, voided.length, completedAll])
  const eventLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of stallEvents) {
      const typeKey = priceKeyForEvent(e.id, stallEvents, eventTypes)
      map.set(
        e.id,
        `${e.id}${typeKey ? ` · ${typeKey}` : ''}${e.location ? ` · ${e.location}` : ''}`,
      )
    }
    return map
  }, [stallEvents, eventTypes])
  const sold = useMemo(() => soldCounts(completed), [completed])
  const soldRevenue = sold.reduce((s, r) => s + r.revenue, 0)
  const soldPay = useMemo(() => summarizePayMethods(completed), [completed])
  const soldByEvent = useMemo(() => {
    return groupOrdersByEvent(totalsCompleted)
      .map(({ eventId, orders: list }) => {
        const counts = soldCounts(list)
        const revenue = counts.reduce((s, r) => s + r.revenue, 0)
        return {
          eventId,
          label:
            eventId === 'unassigned'
              ? 'No event tagged'
              : eventLabelById.get(eventId) || eventId,
          count: list.length,
          revenue,
          items: counts,
          orders: list,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
  }, [totalsCompleted, eventLabelById])
  const soldAll = useMemo(() => soldCounts(totalsCompleted), [totalsCompleted])
  const soldAllRevenue = soldAll.reduce((s, r) => s + r.revenue, 0)
  const soldAllPay = useMemo(() => summarizePayMethods(totalsCompleted), [totalsCompleted])
  const posCash = useMemo(() => summarizePosCashToday(orders), [orders])
  const todayYmd = germanyTodayYmd()
  const peerEvents = useMemo(
    () =>
      sameDayPeerEvents({
        events: stallEvents,
        orders,
        activeEventId,
        todayYmd,
        labels: eventLabelById,
      }),
    [stallEvents, orders, activeEventId, todayYmd, eventLabelById],
  )

  const lastTicket = useMemo(() => {
    const pool = orders.filter((o) => !o.voided && o.lines.length)
    return pool[0] || null
  }, [orders])

  function repeatLastTicket() {
    if (!lastTicket) return
    const next: Record<string, number> = {}
    for (const l of lastTicket.lines) {
      const key = lineKey(l.menuItemId, l.drink)
      next[key] = (next[key] || 0) + l.qty
    }
    setCart(next)
    setTab('new')
  }

  const salesFilter = useMemo(() => {
    if (salesScope === 'today') return { day: germanyTodayYmd() }
    if (salesScope === 'event') {
      return { eventId: salesEventId || activeEventId || 'unassigned' }
    }
    return undefined
  }, [salesScope, salesEventId, activeEventId])

  const sales = useMemo(() => buildSalesReport(orders, salesFilter), [orders, salesFilter])
  const salesAllEvents = useMemo(() => buildSalesReport(orders), [orders])
  const salesPay = useMemo(() => {
    const list = orders.filter((o) => {
      if (o.status !== 'completed' || o.voided) return false
      if (salesFilter?.eventId && (o.eventId || 'unassigned') !== salesFilter.eventId) {
        return false
      }
      if (salesFilter?.day) {
        const day = germanyYmd(new Date(o.completedAt || o.createdAt))
        if (day !== salesFilter.day) return false
      }
      return true
    })
    return summarizePayMethods(list)
  }, [orders, salesFilter])

  /** Menu shown on New order — catalog for the selected stall’s event type. */
  const posMenu = useMemo(
    (): MenuItem[] =>
      menuForEventType(
        activePriceKey,
        eventMenus,
        menu,
        eventPrices,
        eventTypeHiddenMenu,
      ),
    [activePriceKey, eventMenus, menu, eventPrices, eventTypeHiddenMenu],
  )

  /** Menu editor list for the selected type on Menu prices. */
  const typeMenu = useMemo(
    (): MenuItem[] =>
      priceEventType
        ? menuForEventType(
            priceEventType,
            eventMenus,
            menu,
            eventPrices,
            eventTypeHiddenMenu,
          )
        : [],
    [priceEventType, eventMenus, menu, eventPrices, eventTypeHiddenMenu],
  )

  const cartLines: OrderLine[] = useMemo(() => {
    const lines: OrderLine[] = []
    // Always price from the POS catalog item itself (already synced from guest /order).
    // Avoid jumps when hasSavedTypeMenu flips after sync.
    for (const m of posMenu) {
      if (m.kind === 'combo') {
        for (const drink of ['chai', 'lassi'] as DrinkChoice[]) {
          const q = cart[lineKey(m.id, drink)] || 0
          if (q > 0) lines.push(makeOrderLine(m, q, undefined, undefined, drink))
        }
      } else {
        const q = cart[m.id] || 0
        if (q > 0) lines.push(makeOrderLine(m, q, undefined, undefined))
      }
    }
    return lines
  }, [posMenu, cart])

  const cartTotal = orderTotal(cartLines)
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0)

  const menuCombos = useMemo(
    () => posMenu.filter((m) => m.kind === 'combo'),
    [posMenu],
  )
  const menuMains = useMemo(
    () =>
      posMenu.filter(
        (m) => m.kind === 'single' && !DRINK_IDS.has(m.id) && !isSnackItem(m),
      ),
    [posMenu],
  )
  const menuSnacks = useMemo(
    () =>
      posMenu.filter(
        (m) => m.kind === 'single' && !DRINK_IDS.has(m.id) && isSnackItem(m),
      ),
    [posMenu],
  )
  const menuDrinks = useMemo(
    () => posMenu.filter((m) => m.kind === 'single' && DRINK_IDS.has(m.id)),
    [posMenu],
  )

  function setQty(item: MenuItem, qty: number, drink?: DrinkChoice) {
    const key = lineKey(item.id, item.kind === 'combo' ? drink : undefined)
    setCart((c) => {
      const next = { ...c }
      if (qty <= 0) delete next[key]
      else next[key] = qty
      return next
    })
  }

  function bumpQty(item: MenuItem, delta: number, drink?: DrinkChoice) {
    setQty(item, Math.max(0, cartQty(item, drink) + delta), drink)
  }

  function cartQty(item: MenuItem, drink?: DrinkChoice): number {
    return cart[lineKey(item.id, item.kind === 'combo' ? drink : undefined)] || 0
  }

  function clearCartLine(line: OrderLine) {
    const item = posMenu.find((m) => m.id === line.menuItemId)
    if (!item) return
    setQty(item, 0, line.drink)
  }

  function renderSinglePosItem(m: MenuItem) {
    const q = cartQty(m)
    const price = resolveMenuPrice(m, undefined, undefined)
    return (
      <div
        key={m.id}
        className={`pos-item ${q ? 'is-on' : ''}`}
      >
        <div className="pos-item__body">
          <span className="pos-item__name">{m.name}</span>
          <span className="pos-item__price">
            <Money value={price} />
          </span>
        </div>
        <div className="pos-item__stepper">
          <button
            type="button"
            className="pos-item__step"
            aria-label={`Remove ${m.name}`}
            disabled={q <= 0}
            onClick={() => bumpQty(m, -1)}
          >
            <Minus size={16} />
          </button>
          <QtyPop value={q} className="pos-item__qty" />
          <button
            type="button"
            className="pos-item__step pos-item__step--add"
            aria-label={`Add ${m.name}`}
            onClick={() => bumpQty(m, 1)}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    )
  }

  function submitCart() {
    if (!cartLines.length || submitLock.current) return
    submitLock.current = true
    setCartBusy(true)
    window.setTimeout(() => {
      submitLock.current = false
      setCartBusy(false)
    }, 800)
    createOrder(cartLines)
    publishDisplay({
      phase: 'waiting',
      total: cartTotal,
      ticketLabel: `Customer ${nextCustomer}`,
      ticketNumber: nextCustomer,
      lineSummary: cartLines.map((l) => `${l.qty}× ${l.name}`).join(' · '),
    })
    setCart({})
    setTab('pending')
  }

  function startEdit(o: StallOrder) {
    setEditId(o.id)
    setEditLines(o.lines.map((l) => ({ ...l })))
  }

  function saveEdit() {
    if (!editId) return
    updatePendingOrder(editId, editLines)
    setEditId(null)
  }

  useEffect(() => {
    if (tab !== 'new') return
    if (!cartLines.length) {
      publishDisplay({
        phase: 'idle',
        total: 0,
        ticketLabel: '',
        ticketNumber: null,
        lineSummary: '',
      })
      return
    }
    publishDisplay({
      phase: 'ordering',
      total: cartTotal,
      ticketLabel: '',
      ticketNumber: null,
      lineSummary: cartLines.map((l) => `${l.qty}× ${l.name}`).join(' · '),
    })
  }, [tab, cartLines, cartTotal])

  useEffect(() => {
    if (!badgeToast) return
    const timer = window.setTimeout(() => setBadgeToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [badgeToast])

  const payTotal = payOrder ? orderTotal(payOrder.lines) : 0
  const paidNum =
    payMethod === 'paypal' ? payTotal : Number(paidInput.replace(',', '.'))
  const tipNum = Math.max(0, Number(String(tipInput).replace(',', '.')) || 0)
  const paidValid = Number.isFinite(paidNum) && paidNum >= 0
  const changeDue =
    payMethod === 'paypal'
      ? 0
      : paidValid
        ? Math.round((paidNum - payTotal - tipNum) * 100) / 100
        : null
  const canConfirmPay =
    payMethod === 'paypal'
      ? true
      : paidValid && paidNum + 1e-9 >= payTotal + tipNum && tipNum >= 0
  const changePieces =
    changeDue != null && changeDue > 0 ? suggestChange(changeDue) : []
  const badgesToday = useMemo(() => allUnlockedForDay(), [orders, badgeToast])

  function openPay(o: StallOrder, mode: 'complete' | 'markPaid' = 'complete') {
    setPayMode(mode)
    setPayOrder(o)
    setPayMethod(null)
    setPaidInput(String(orderTotal(o.lines)))
    setTipInput('0')
    publishDisplay({
      phase: 'waiting',
      total: orderTotal(o.lines),
      ticketLabel: o.label,
      ticketNumber: Number(o.label.replace(/\D/g, '')) || null,
      lineSummary: o.lines.map((l) => `${l.qty}× ${l.name}`).join(' · '),
    })
  }

  function deliverPrepaid(o: StallOrder) {
    if (!isOrderPrepaid(o) || o.payMethod == null || o.paid == null) return
    completeOrder(o.id, Number(o.paid), o.tip || 0, o.payMethod)
    const completedAt = stampCompletedAt(o.createdAt)
    const unlocked = evaluateAchievements(
      orders.map((x) =>
        x.id === o.id
          ? {
              ...x,
              status: 'completed' as const,
              completedAt,
            }
          : x,
      ),
      {
        ...o,
        status: 'completed',
        completedAt,
      },
    )
    if (unlocked[0]) setBadgeToast(unlocked[0])
    publishDisplay({
      phase: 'ready',
      total: orderTotal(o.lines),
      ticketLabel: o.label,
      ticketNumber: Number(o.label.replace(/\D/g, '')) || null,
      lineSummary: '',
    })
    if (tab !== 'pending') setTab('completed')
  }

  function confirmPay() {
    if (!payOrder || !payMethod || !canConfirmPay || payLock.current) return
    payLock.current = true
    setPayBusy(true)
    window.setTimeout(() => {
      payLock.current = false
      setPayBusy(false)
    }, 800)
    if (payMode === 'markPaid') {
      markOrderPaid(payOrder.id, paidNum, tipNum, payMethod)
      publishDisplay({
        phase: 'waiting',
        total: payTotal,
        ticketLabel: payOrder.label,
        ticketNumber: Number(payOrder.label.replace(/\D/g, '')) || null,
        lineSummary: payOrder.lines.map((l) => `${l.qty}× ${l.name}`).join(' · '),
      })
      setPayOrder(null)
      setPayMethod(null)
      setPayMode('complete')
      setPaidInput('')
      setTipInput('0')
      setTab('pending')
      return
    }
    completeOrder(payOrder.id, paidNum, tipNum, payMethod)
    const completed: StallOrder = {
      ...payOrder,
      status: 'completed',
      completedAt: stampCompletedAt(payOrder.createdAt),
      paid: paidNum,
      payMethod,
      tip: tipNum > 0 ? tipNum : undefined,
      change: changeDue ?? 0,
    }
    const nextOrders = orders.map((o) => (o.id === payOrder.id ? completed : o))
    const unlocked = evaluateAchievements(nextOrders, completed)
    if (unlocked[0]) setBadgeToast(unlocked[0])
    publishDisplay({
      phase: 'ready',
      total: payTotal,
      ticketLabel: payOrder.label,
      ticketNumber: Number(payOrder.label.replace(/\D/g, '')) || null,
      lineSummary: '',
    })
    setPayOrder(null)
    setPayMethod(null)
    setPayMode('complete')
    setPaidInput('')
    setTipInput('0')
    if (tab !== 'pending') setTab('completed')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <EditableText
            id="orders.pageTitle"
            as="h1"
            defaultText="Orders"
            icon={<ClipboardList size={22} style={{ verticalAlign: -3, marginRight: 8 }} />}
          />
        </div>
        <div className="page-actions">
          {!isStall && (
            <>
              <span className="badge ok" title="Paid − change returned today">
                Cash in box today <Money value={posCash.netIn} />
              </span>
              <Link className="btn ghost" to="/cash">
                Cash box →
              </Link>
              {!isGuestLocked && (
                <button type="button" className="btn ghost" onClick={enterStall}>
                  Stall mode
                </button>
              )}
            </>
          )}
          <Link className="btn ghost" to="/stock">
            Stock →
          </Link>
        </div>
      </div>

      {badgesToday.length > 0 && !isStall && (
        <div className="chip-row" style={{ marginBottom: '0.65rem' }}>
          <span className="badge ok">
            <Award size={12} style={{ verticalAlign: -2 }} /> {tr('badges')}:{' '}
            {badgesToday.map((b) => b.title).join(' · ')}
          </span>
          {posCash.tipTotal > 0 && (
            <span className="badge">
              {tr('tipsToday')} <Money value={posCash.tipTotal} />
            </span>
          )}
        </div>
      )}

      {badgeToast && (
        <div className="badge-toast" role="status">
          <Award size={18} />
          <div>
            <strong>{badgeToast.title}</strong>
            <div className="hint-inline">{badgeToast.description}</div>
          </div>
        </div>
      )}
      {orderConflicts[0] && (
        <div className="stall-conflict-modal" role="dialog" aria-modal="true" aria-label="Order conflict">
          <div className="stall-conflict-modal__panel">
            <h2>Ticket {orderConflicts[0].local.label} changed on another phone</h2>
            <p>Choose which version of this ticket to keep.</p>
            <div className="page-actions">
              <button
                type="button"
                className="btn"
                onClick={() => resolveOrderConflict(orderConflicts[0].orderId, 'mine')}
              >
                Keep mine
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => resolveOrderConflict(orderConflicts[0].orderId, 'theirs')}
              >
                Use theirs
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => dismissOrderConflict(orderConflicts[0].orderId)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <PillTabs
        group="orders"
        style={{ marginBottom: '0.85rem' }}
        value={tab}
        onChange={(id) => {
          setTab(id)
          if (id === 'pending' && awaitingClaim.length > 0) setClaimOpen(true)
        }}
        items={(
          [
            { id: 'new' as const, label: 'New order' },
            {
              id: 'pending' as const,
              label:
                awaitingClaim.length > 0
                  ? `Pending (${pending.length}) · ${awaitingClaim.length} to claim`
                  : `Pending (${pending.length})`,
            },
            {
              id: 'completed' as const,
              label: soldFilterId ? `Sold (${completed.length})` : 'Sold',
            },
            { id: 'totals' as const, label: `Totals (${completedAll.length})` },
            { id: 'sales' as const, label: 'Sales' },
            { id: 'menu' as const, label: 'Menu prices' },
          ] satisfies { id: Tab; label: string }[]
        ).filter((item) => !isStall || (item.id !== 'sales' && item.id !== 'menu' && item.id !== 'totals'))}
        trailing={
          <button
            type="button"
            className="btn ghost"
            style={{ marginLeft: 'auto' }}
            onClick={() => openCustomerDisplay()}
            title={tr('customerDisplay')}
          >
            <Monitor size={16} /> {tr('customerDisplay')}
          </button>
        }
      />

      {tab === 'new' && (
        <div className={`pos-shell${cartLines.length ? ' pos-shell--docked' : ''}`}>
          <div className="pos-toolbar">
            <label className="pos-toolbar__event" htmlFor="active-event">
              <span>Event menu</span>
              <select
                id="active-event"
                value={activeEventId}
                onChange={(e) => applyStallEvent(e.target.value)}
              >
                <option value="">— pick stall —</option>
                {activeEventId && !stallEvents.some((e) => e.id === activeEventId) && (
                  <option value={activeEventId}>{activeEventId} · loading stall list…</option>
                )}
                {stallEvents.map((e) => {
                  const typeKey = priceKeyForEvent(e.id, stallEvents, eventTypes)
                  const n = typeKey ? menuForEventType(typeKey, eventMenus, menu).length : 0
                  return (
                    <option key={e.id} value={e.id}>
                      {e.id} · {e.location || e.name}
                      {typeKey ? ` · ${typeKey}` : ''}
                      {n ? ` · ${n} items` : ''}
                    </option>
                  )
                })}
              </select>
              <span className="hint-inline" style={{ display: 'block', marginTop: 4 }}>
                Menu matches the guest order page for this stall (same names &amp; prices).
              </span>
            </label>
            <div className="pos-toolbar__actions">
              {activeEventId && (
                <span className="badge">
                  {activePriceKey
                    ? `${activePriceKey} menu · ${posMenu.length} items`
                    : 'Default menu'}
                </span>
              )}
              <span className="badge ok" title="Next customer number to assign (not total sold)">
                Next #{nextCustomer}
              </span>
              <button
                type="button"
                className="btn ghost"
                disabled={!lastTicket}
                onClick={repeatLastTicket}
                title={lastTicket ? `Copy ${lastTicket.label}` : 'No previous customer'}
              >
                <RotateCcw size={14} /> Repeat
              </button>
            </div>
          </div>

          <div className="pos-layout">
            <div className="pos-menu">
              {menuCombos.length > 0 && (
                <section className="pos-section">
                  <h2 className="pos-section__title">Combos</h2>
                  <div className="pos-combo-grid">
                    {menuCombos.map((m) => {
                      const qChai = cartQty(m, 'chai')
                      const qLassi = cartQty(m, 'lassi')
                      const on = qChai + qLassi > 0
                      const pChai = resolveMenuPrice(m, undefined, undefined, 'chai')
                      const pLassi = resolveMenuPrice(m, undefined, undefined, 'lassi')
                      return (
                        <div
                          key={m.id}
                          className={`pos-combo ${on ? 'is-on' : ''}`}
                        >
                          <div className="pos-combo__head">
                            <div className="pos-combo__name">{m.name}</div>
                            {m.contents && (
                              <div className="pos-combo__contents">{m.contents}</div>
                            )}
                          </div>
                          <div className="pos-combo__drinks">
                            {(['chai', 'lassi'] as DrinkChoice[]).map((drink) => {
                              const q = drink === 'chai' ? qChai : qLassi
                              const price = drink === 'chai' ? pChai : pLassi
                              return (
                                <div
                                  key={drink}
                                  className={`pos-drink ${q ? 'is-on' : ''}`}
                                >
                                  <button
                                    type="button"
                                    className="pos-drink__add"
                                    onClick={() => bumpQty(m, 1, drink)}
                                  >
                                    <span className="pos-drink__label">{shortDrink(drink)}</span>
                                    <span className="pos-drink__price">
                                      <Money value={price} />
                                    </span>
                                    {q > 0 ? (
                                      <QtyPop value={q} className="pos-drink__qty" />
                                    ) : (
                                      <span className="pos-drink__plus">
                                        <Plus size={18} />
                                      </span>
                                    )}
                                  </button>
                                  {q > 0 && (
                                    <button
                                      type="button"
                                      className="pos-drink__minus"
                                      aria-label={`Remove ${shortDrink(drink)}`}
                                      onClick={() => bumpQty(m, -1, drink)}
                                    >
                                      <Minus size={16} />
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {menuMains.length > 0 && (
                <section className="pos-section">
                  <h2 className="pos-section__title">Main dishes</h2>
                  <div className="pos-item-grid">
                    {menuMains.map((m) => renderSinglePosItem(m))}
                  </div>
                </section>
              )}

              {menuSnacks.length > 0 && (
                <section className="pos-section">
                  <h2 className="pos-section__title">Snacks</h2>
                  <div className="pos-item-grid">
                    {menuSnacks.map((m) => renderSinglePosItem(m))}
                  </div>
                </section>
              )}

              {menuDrinks.length > 0 && (
                <section className="pos-section">
                  <h2 className="pos-section__title">Drinks</h2>
                  <div className="pos-item-grid pos-item-grid--drinks">
                    {menuDrinks.map((m) => renderSinglePosItem(m))}
                  </div>
                </section>
              )}
            </div>

            <aside className="pos-cart">
              <div className="pos-cart__head">
                <h2>Customer</h2>
                <span className="badge ok" title="Next customer number to assign (not total sold)">
                  Next #{nextCustomer}
                </span>
              </div>
              {cartLines.length === 0 ? (
                <p className="pos-cart__empty">
                  Use + / − on mains, snacks, drinks, or combos to build the order.
                </p>
              ) : (
                <ul className="pos-cart__lines">
                  {cartLines.map((line) => (
                    <li key={lineKey(line.menuItemId, line.drink)}>
                      <div className="pos-cart__line-main">
                        <strong>
                          {line.qty}× {line.name}
                        </strong>
                        <span>
                          <Money value={line.price * line.qty} />
                        </span>
                      </div>
                      <button
                        type="button"
                        className="pos-cart__remove"
                        aria-label="Remove line"
                        onClick={() => clearCartLine(line)}
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="pos-cart__footer">
                <div className="pos-cart__total">
                  <span>
                    {cartCount} item{cartCount === 1 ? '' : 's'}
                  </span>
                  <div className="pos-cart__total-sum">
                    <strong>
                      <Money value={cartTotal} />
                    </strong>
                    <GermanSpokenAmount value={cartTotal} />
                  </div>
                </div>
                <button
                  type="button"
                  className="btn pos-cart__submit"
                  disabled={!cartLines.length || cartBusy}
                  onClick={submitCart}
                >
                  Add Customer #{nextCustomer}
                </button>
                {cartLines.length > 0 && (
                  <button
                    type="button"
                    className="btn ghost pos-cart__clear"
                    onClick={() => setCart({})}
                  >
                    Clear
                  </button>
                )}
              </div>
            </aside>
          </div>

          {cartLines.length > 0 && (
            <div className="pos-dock">
              <div className="pos-dock__total">
                <span>
                  {cartCount} item{cartCount === 1 ? '' : 's'}
                </span>
                <strong>
                  <Money value={cartTotal} />
                </strong>
                <GermanSpokenAmount value={cartTotal} />
              </div>
              <button
                type="button"
                className="btn pos-dock__submit"
                disabled={cartBusy}
                onClick={submitCart}
              >
                Add Customer #{nextCustomer}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'pending' && (
        <div className="order-list">
          <div className="pos-toolbar" style={{ marginBottom: '0.75rem' }}>
            <label className="pos-toolbar__event" htmlFor="pending-event">
              <span>Event menu</span>
              <select
                id="pending-event"
                value={activeEventId}
                onChange={(e) => applyStallEvent(e.target.value)}
              >
                <option value="">— pick stall —</option>
                {activeEventId && !stallEvents.some((e) => e.id === activeEventId) && (
                  <option value={activeEventId}>{activeEventId} · loading stall list…</option>
                )}
                {stallEvents.map((e) => {
                  const typeKey = priceKeyForEvent(e.id, stallEvents, eventTypes)
                  return (
                    <option key={e.id} value={e.id}>
                      {e.id} · {e.location || e.name}
                      {typeKey ? ` · ${typeKey}` : ''}
                    </option>
                  )
                })}
              </select>
            </label>
          </div>
          <MotionCard interactive={false} className="claim-panel">
            <div className="card-head" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setClaimOpen((v) => !v)}
                aria-expanded={claimOpen}
              >
                <QrCode size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
                Claim customer order
                {awaitingClaim.length > 0 ? ` (${awaitingClaim.length})` : ''}
                <span className="hint-inline" style={{ marginLeft: 8 }}>
                  {claimOpen ? 'Hide' : 'Show'}
                </span>
              </button>
            </div>
            {claimOpen && (
              <>
                <p className="hint-inline" style={{ marginTop: 6 }}>
                  {activeEventId ? (
                    <>
                      Customer shows a 4-digit code — claim only activates orders for this
                      stall (<strong>{activeEventId}</strong>).
                    </>
                  ) : (
                    <>
                      Pick <strong>Event menu</strong> on New order first. Customer shows a
                      4-digit code.
                    </>
                  )}
                </p>
                <div className="filters" style={{ marginTop: 10, alignItems: 'end' }}>
                  <div className="field" style={{ margin: 0, maxWidth: 160 }}>
                    <label htmlFor="claim-code">Code</label>
                    <input
                      id="claim-code"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={claimCode}
                      placeholder="1234"
                      autoFocus={awaitingClaim.length > 0}
                      onChange={(e) => setClaimCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void onClaimCode()
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn"
                    disabled={claimBusy || claimCode.length !== 4}
                    onClick={() => void onClaimCode()}
                  >
                    {claimBusy ? '…' : 'Put in pending'}
                  </button>
                </div>
                {claimMsg && (
                  <p className="hint-inline" style={{ marginTop: 8 }}>
                    {claimMsg}
                  </p>
                )}
                {awaitingClaim.length > 0 && (
                  <ul className="hint-inline" style={{ marginTop: 10, paddingLeft: 18 }}>
                    {awaitingClaim.slice(0, 8).map((o) => (
                      <li key={o.id}>
                        #{o.claimCode}
                        {o.customerName ? ` · ${o.customerName}` : ''} ·{' '}
                        {o.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </MotionCard>

          {pending.length === 0 && (
            <MotionCard interactive={false}>
              <p className="hint-inline">No pending orders — start a new ticket.</p>
            </MotionCard>
          )}
          {pending.length > 0 && (
            <div className="chip-row" style={{ marginBottom: '0.65rem', flexWrap: 'wrap' }}>
              {(
                [
                  ['all', `All (${pending.length})`],
                  ['kitchen', `Kitchen (${pendingKitchen.length})`],
                  ['paid', `Paid waiting (${pendingPaid.length})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn ${pendingFilter === id ? '' : 'ghost'}`}
                  onClick={() => setPendingFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {pendingShown.map((o) => {
            const prepaid = isOrderPrepaid(o)
            const fullyDelivered = orderFullyDelivered(o)
            const mins = waitMinutesSince(o.createdAt, waitNow)
            const tone = waitTone(mins)
            return (
            <MotionCard
              key={o.id}
              interactive={false}
              className={`order-card order-card--wait-${tone}`}
            >
              {editId === o.id ? (
                <>
                  <div className="card-head">
                    <h2>{o.label}</h2>
                    <span className="badge warn">Editing items</span>
                  </div>
                  <div className="pos-menu pos-menu--edit">
                    {(() => {
                      const stallId = o.eventId || activeEventId
                      const priceKey =
                        priceKeyForEvent(stallId, stallEvents, eventTypes) || stallId
                      const editMenu = menuForEventType(
                        priceKey,
                        eventMenus,
                        menu,
                        eventPrices,
                        eventTypeHiddenMenu,
                      )
                      const saved = Boolean(priceKey && eventMenus[priceKey]?.length)
                      const pk = saved ? undefined : priceKey
                      const prices = saved ? undefined : eventPrices
                      return (
                        <>
                          <div className="pos-combo-grid">
                            {editMenu
                              .filter((m) => m.kind === 'combo')
                              .map((m) => {
                                const qChai = findLineQty(editLines, m.id, 'chai')
                                const qLassi = findLineQty(editLines, m.id, 'lassi')
                                return (
                                  <div
                                    key={m.id}
                                    className={`pos-combo ${qChai + qLassi ? 'is-on' : ''}`}
                                  >
                                    <div className="pos-combo__head">
                                      <div className="pos-combo__name">{m.name}</div>
                                    </div>
                                    <div className="pos-combo__drinks">
                                      {(['chai', 'lassi'] as DrinkChoice[]).map((drink) => {
                                        const q = drink === 'chai' ? qChai : qLassi
                                        return (
                                          <div
                                            key={drink}
                                            className={`pos-drink ${q ? 'is-on' : ''}`}
                                          >
                                            <button
                                              type="button"
                                              className="pos-drink__add"
                                              onClick={() =>
                                                setEditLines(
                                                  upsertLineQty(
                                                    editLines,
                                                    m,
                                                    q + 1,
                                                    pk || '',
                                                    prices || {},
                                                    drink,
                                                  ),
                                                )
                                              }
                                            >
                                              <span className="pos-drink__label">
                                                {shortDrink(drink)}
                                              </span>
                                              <span className="pos-drink__price">
                                                <Money
                                                  value={resolveMenuPrice(
                                                    m,
                                                    pk,
                                                    prices,
                                                    drink,
                                                    stallId,
                                                  )}
                                                />
                                              </span>
                                              {q > 0 ? (
                                                <span className="pos-drink__qty">{q}</span>
                                              ) : (
                                                <span className="pos-drink__plus">
                                                  <Plus size={18} />
                                                </span>
                                              )}
                                            </button>
                                            {q > 0 && (
                                              <button
                                                type="button"
                                                className="pos-drink__minus"
                                                onClick={() =>
                                                  setEditLines(
                                                    upsertLineQty(
                                                      editLines,
                                                      m,
                                                      q - 1,
                                                      pk || '',
                                                      prices || {},
                                                      drink,
                                                    ),
                                                  )
                                                }
                                              >
                                                <Minus size={16} />
                                              </button>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                          </div>
                          <div className="pos-item-grid" style={{ marginTop: '0.75rem' }}>
                            {editMenu
                              .filter((m) => m.kind === 'single')
                              .map((m) => {
                                const q = findLineQty(editLines, m.id)
                                return (
                                  <div key={m.id} className={`pos-item ${q ? 'is-on' : ''}`}>
                                    {q > 0 && (
                                      <button
                                        type="button"
                                        className="pos-item__minus"
                                        onClick={() =>
                                          setEditLines(
                                            upsertLineQty(
                                              editLines,
                                              m,
                                              q - 1,
                                              pk || '',
                                              prices || {},
                                            ),
                                          )
                                        }
                                      >
                                        <Minus size={16} />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="pos-item__add"
                                      onClick={() =>
                                        setEditLines(
                                          upsertLineQty(
                                            editLines,
                                            m,
                                            q + 1,
                                            pk || '',
                                            prices || {},
                                          ),
                                        )
                                      }
                                    >
                                      <span className="pos-item__name">{m.name}</span>
                                      <span className="pos-item__price">
                                        <Money
                                          value={resolveMenuPrice(m, pk, prices, undefined, stallId)}
                                        />
                                      </span>
                                      {q > 0 ? (
                                        <QtyPop value={q} className="pos-item__qty" />
                                      ) : (
                                        <span className="pos-item__hint">Tap</span>
                                      )}
                                    </button>
                                  </div>
                                )
                              })}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                  <div className="page-actions" style={{ marginTop: '0.75rem' }}>
                    <button type="button" className="btn" onClick={saveEdit}>
                      Save
                    </button>
                    <button type="button" className="btn ghost" onClick={() => setEditId(null)}>
                      <X size={14} /> Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="card-head">
                    <h2 className="queue-ticket-num">{o.label}</h2>
                    <span className={`badge wait-${tone}`} title={formatWaitLabel(mins)}>
                      {formatWaitLabel(mins)}
                    </span>
                    {prepaid ? (
                      <span className="badge ok">
                        PAID · {o.payMethod === 'paypal' ? 'PayPal' : 'Cash'}
                      </span>
                    ) : (
                      <span className="badge warn">Pending</span>
                    )}
                  </div>
                  <div className="hint-inline" style={{ marginBottom: 4 }}>
                    Taken {formatGermanyDateTime(o.createdAt)}
                    {o.eventId ? ` · Event ${o.eventId}` : ''}
                    {prepaid && o.paidAt
                      ? ` · Paid ${formatGermanyDateTime(o.paidAt)}`
                      : ''}
                  </div>
                  <ul className="order-lines">
                    {o.lines.map((l, lineIndex) => {
                      const delivered = lineDeliveredQty(l)
                      return (
                      <li key={`${lineKey(l.menuItemId, l.drink)}-${lineIndex}`} className="order-line-deliver">
                        {l.qty}× {l.name}{' '}
                        <span className="hint-inline">
                          <Money value={l.price * l.qty} />
                        </span>
                        <span className="hint-inline">· Done: {delivered}/{l.qty}</span>
                        <button
                          type="button"
                          className="btn ghost"
                          aria-label={`Decrease delivered ${l.name}`}
                          disabled={delivered <= 0}
                          onClick={() => setOrderLineDelivered(o.id, lineIndex, delivered - 1)}
                        >
                          <Minus size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          aria-label={`Increase delivered ${l.name}`}
                          disabled={delivered >= l.qty}
                          onClick={() => setOrderLineDelivered(o.id, lineIndex, delivered + 1)}
                        >
                          <Plus size={13} />
                        </button>
                      </li>
                      )
                    })}
                  </ul>
                  {!fullyDelivered && (
                    <p className="hint-inline">Mark each line Done, then finish.</p>
                  )}
                  <div className="order-total-bar" style={{ marginTop: '0.65rem' }}>
                    <strong>
                      <Money value={orderTotal(o.lines)} />
                      <GermanSpokenAmount value={orderTotal(o.lines)} />
                      {prepaid && o.paid != null ? (
                        <span className="hint-inline">
                          {' '}
                          · received <Money value={o.paid} />
                        </span>
                      ) : null}
                    </strong>
                    <div className="page-actions">
                      <button type="button" className="btn ghost" onClick={() => startEdit(o)}>
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => printQueueTicket(o)}
                        title={tr('printTicket')}
                      >
                        <Printer size={14} /> {tr('printTicket')}
                      </button>
                      {!prepaid && (
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => openPay(o, 'markPaid')}
                          title="Take payment now — keep in kitchen until delivered"
                        >
                          <Banknote size={14} /> Mark paid
                        </button>
                      )}
                      {!fullyDelivered && (
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            markAllLinesDelivered(o.id)
                            if (prepaid) deliverPrepaid(o)
                          }}
                        >
                          <Check size={14} /> All done
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn"
                        disabled={!fullyDelivered}
                        onClick={() => (prepaid ? deliverPrepaid(o) : openPay(o, 'complete'))}
                      >
                        <Check size={14} /> {prepaid ? 'Complete delivery' : 'Pay & finish'}
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Delete ${o.label}? This cannot be undone.`,
                            )
                          ) {
                            return
                          }
                          deleteOrder(o.id)
                        }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </MotionCard>
            )
          })}
        </div>
      )}

      {tab === 'completed' && (
        <>
          <div style={{ marginBottom: '0.9rem' }}>
            <MotionCard interactive={false}>
              <div
                style={{
                  display: 'grid',
                  gap: '0.65rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
                  alignItems: 'end',
                }}
              >
                <label className="pos-toolbar__event" htmlFor="sold-event" style={{ margin: 0, flex: 'none' }}>
                  <span>Show sold for event</span>
                  <select
                    id="sold-event"
                    value={soldFilterId}
                    onChange={(e) => {
                      setSoldEventId(e.target.value)
                    }}
                  >
                    <option value="">— pick stall —</option>
                    {soldFilterId && !stallEvents.some((e) => e.id === soldFilterId) && (
                      <option value={soldFilterId}>{soldFilterId} · loading stall list…</option>
                    )}
                    {stallEvents.map((e) => {
                      const typeKey = priceKeyForEvent(e.id, stallEvents, eventTypes)
                      const n = completedAll.filter(
                        (o) => String(o.eventId || '').trim() === e.id,
                      ).length
                      return (
                        <option key={e.id} value={e.id}>
                          {e.id} · {e.location || e.name}
                          {typeKey ? ` · ${typeKey}` : ''}
                          {n ? ` · ${n} sold` : ''}
                        </option>
                      )
                    })}
                  </select>
                </label>
                {soldFilterId && soldEventDays.length > 0 && (
                  <label className="pos-toolbar__event" htmlFor="sold-day" style={{ margin: 0, flex: 'none' }}>
                    <span>Day</span>
                    <select
                      id="sold-day"
                      value={soldDay}
                      onChange={(e) => setSoldDay(e.target.value)}
                    >
                      <option value="">All days ({soldEventDays.length})</option>
                      {soldEventDays.map((d, i) => (
                        <option key={d} value={d}>
                          Day {i + 1} · {d}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <p className="hint-inline" style={{ marginTop: 6, marginBottom: 0 }}>
                Only this stall&apos;s paid tickets
                {isStall ? '.' : (
                  <>
                    . Open <strong>Totals</strong> for every event combined.
                  </>
                )}
              </p>
              {soldFilterId && (
                <p className="hint-inline" style={{ marginTop: 8, marginBottom: 0 }}>
                  <strong>{soldStats.paid} paid tickets</strong>
                  {soldStats.maxTicket > 0 ? ` · highest label #${soldStats.maxTicket}` : ''}
                  {soldStats.voided > 0 ? ` · ${soldStats.voided} voided` : ''}
                  {soldStats.pending > 0 ? ` · ${soldStats.pending} still pending` : ''}
                  {` · next #${soldStats.nextTicket}`}
                  {soldStats.missing.length > 0 ? (
                    <>
                      <br />
                      Missing from paid: {soldStats.missingNotes.join(' · ')}
                    </>
                  ) : null}
                  {soldStats.untagged > 0 && !isStall ? (
                    <>
                      <br />
                      {soldStats.untagged} paid ticket(s) have no event tag — see{' '}
                      <strong>Totals</strong>.
                    </>
                  ) : null}
                </p>
              )}
              {soldFilterId ? <PayMethodTotals {...soldPay} /> : null}
            </MotionCard>
          </div>

          <div style={{ marginBottom: '0.9rem' }}>
            <MotionCard interactive={false}>
              <div className="card-head">
                <h2>
                  Items sold
                  {soldFilterId
                    ? ` · ${eventLabelById.get(soldFilterId) || soldFilterId}`
                    : ''}
                  {soldDay ? ` · ${soldDay}` : ''}
                </h2>
                <span className="badge ok">
                  {soldStats.paid} tickets · <Money value={soldRevenue} />
                </span>
              </div>
              <div className="table-wrap" style={{ marginTop: '0.65rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sold.map((r) => (
                      <tr key={r.name}>
                        <td>{r.name}</td>
                        <td>{r.qty}</td>
                        <td>
                          <Money value={r.revenue} />
                        </td>
                      </tr>
                    ))}
                    {sold.length === 0 && (
                      <tr>
                        <td colSpan={3}>
                          {soldFilterId
                            ? soldDay
                              ? 'No completed orders for this day.'
                              : 'No completed orders for this event yet.'
                            : 'Pick an event above to see sold items.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </MotionCard>
          </div>

          <div className="order-list">
            {completed.length === 0 && (
              <MotionCard interactive={false}>
                <p className="hint-inline">
                  {soldFilterId
                    ? soldDay
                      ? 'No sold tickets for this day.'
                      : 'No sold tickets for this event yet.'
                    : 'Pick an event to see its paid orders.'}
                </p>
              </MotionCard>
            )}
            {completed.map((o) => (
              <MotionCard key={o.id} interactive={false} className="order-card">
                <div className="card-head">
                  <h2>{o.label}</h2>
                  <span className="badge ok">Completed</span>
                </div>
                <div className="hint-inline" style={{ marginBottom: 4 }}>
                  {o.eventId ? (
                    <>
                      {eventLabelById.get(o.eventId) || o.eventId}
                      {' · '}
                    </>
                  ) : null}
                  Taken{' '}
                  {formatGermanyDateTime(o.createdAt)}
                  {o.completedAt
                    ? ` · Delivered ${formatGermanyDateTime(o.completedAt)}`
                    : ''}
                  {o.payMethod ? ` · ${o.payMethod === 'paypal' ? 'PayPal' : 'Cash'}` : ''}
                </div>
                <ul className="order-lines">
                  {o.lines.map((l) => (
                    <li key={lineKey(l.menuItemId, l.drink)}>
                      {l.qty}× {l.name}
                      <span className="hint-inline">
                        {' '}
                        <Money value={l.price * l.qty} />
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="order-total-bar">
                  <div>
                    <div>
                      Total <Money value={orderTotal(o.lines)} />
                    </div>
                    {o.paid != null && (
                      <div className="hint-inline">
                        Paid <Money value={o.paid} />
                        {o.change != null && o.change > 0 ? (
                          <> · Return <Money value={o.change} /></>
                        ) : o.change === 0 ? (
                          <> · Exact</>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <div className="page-actions">
                    {!isStall && (
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => {
                          setVoidTarget(o)
                          setVoidReason('')
                        }}
                      >
                        Void / refund
                      </button>
                    )}
                    <button type="button" className="btn ghost" onClick={() => reopenOrder(o.id)}>
                      <RotateCcw size={14} /> Back to pending
                    </button>
                  </div>
                </div>
              </MotionCard>
            ))}
          </div>
          {!isStall && voided.length > 0 && (
            <MotionCard interactive={false} className="mt-card">
              <h2>Voided ({voided.length})</h2>
              <ul className="order-lines" style={{ marginTop: '0.5rem' }}>
                {voided.slice(0, 12).map((o) => (
                  <li key={o.id}>
                    {o.label}
                    {o.eventId ? ` · ${o.eventId}` : ''} — {o.voidReason || 'void'}
                  </li>
                ))}
              </ul>
            </MotionCard>
          )}
        </>
      )}

      {tab === 'totals' && (
        <>
          <div style={{ marginBottom: '0.9rem' }}>
            <MotionCard interactive={false}>
              <div className="card-head">
                <h2>Payment totals</h2>
                <span className="badge ok">
                  {totalsCompleted.length} paid
                  {totalsDay ? ` · ${totalsDay}` : ''}
                </span>
              </div>
              {totalsDays.length > 0 && (
                <label
                  className="pos-toolbar__event"
                  htmlFor="totals-day"
                  style={{ display: 'block', marginBottom: 8, flex: 'none', maxWidth: '20rem' }}
                >
                  <span>Day</span>
                  <select
                    id="totals-day"
                    value={totalsDay}
                    onChange={(e) => setTotalsDay(e.target.value)}
                  >
                    <option value="">All days</option>
                    {totalsDays.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <PayMethodTotals {...soldAllPay} />
            </MotionCard>
          </div>

          <div style={{ marginBottom: '0.9rem' }}>
            <MotionCard interactive={false}>
              <div className="card-head">
                <h2>All events — items sold</h2>
                <span className="badge ok">
                  Revenue <Money value={soldAllRevenue} />
                </span>
              </div>
              <p className="hint-inline" style={{ marginTop: 4 }}>
                Combined paid tickets across every stall ({totalsCompleted.length} orders)
                {totalsDay ? ` on ${totalsDay}` : ''}.
              </p>
              <div className="table-wrap" style={{ marginTop: '0.65rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {soldAll.map((r) => (
                      <tr key={r.name}>
                        <td>{r.name}</td>
                        <td>{r.qty}</td>
                        <td>
                          <Money value={r.revenue} />
                        </td>
                      </tr>
                    ))}
                    {soldAll.length === 0 && (
                      <tr>
                        <td colSpan={3}>No completed orders yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </MotionCard>
          </div>

          <div style={{ marginBottom: '0.9rem' }}>
            <MotionCard interactive={false}>
              <div className="card-head">
                <h2>By event</h2>
              </div>
              <div className="table-wrap" style={{ marginTop: '0.65rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {soldByEvent.map((g) => (
                      <tr key={g.eventId}>
                        <td>{g.label}</td>
                        <td>{g.count}</td>
                        <td>
                          <Money value={g.revenue} />
                        </td>
                      </tr>
                    ))}
                    {soldByEvent.length === 0 && (
                      <tr>
                        <td colSpan={3}>No completed orders yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {!isStall &&
                soldByEvent.map((g) =>
                  g.items.length ? (
                    <div key={`${g.eventId}-items`} style={{ marginTop: '0.85rem' }}>
                      <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.35rem' }}>{g.label}</h3>
                      <ul className="order-lines">
                        {g.items.slice(0, 8).map((r) => (
                          <li key={r.name}>
                            {r.qty}× {r.name}{' '}
                            <span className="hint-inline">
                              <Money value={r.revenue} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null,
                )}
            </MotionCard>
          </div>

          <div className="order-list">
            {soldByEvent.map((g) => (
              <div key={`totals-${g.eventId}`} style={{ marginBottom: '1rem' }}>
                <div
                  className="card-head"
                  style={{ marginBottom: '0.5rem', alignItems: 'baseline' }}
                >
                  <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{g.label}</h2>
                  <span className="badge">
                    {g.count} paid
                    {(() => {
                      const first = parseCustomerNumber(g.orders[0]?.label || '')
                      const last = parseCustomerNumber(
                        g.orders[g.orders.length - 1]?.label || '',
                      )
                      if (first && last && first !== last) return ` · #${first}–#${last}`
                      if (first) return ` · #${first}`
                      return ''
                    })()}
                  </span>
                </div>
                <p className="hint-inline" style={{ marginBottom: '0.55rem' }}>
                  Tickets for this stall only, sorted Customer 1, 2, 3…
                </p>
                {g.orders.map((o) => (
                  <MotionCard key={o.id} interactive={false} className="order-card">
                    <div className="card-head">
                      <h2>{o.label}</h2>
                      <span className="badge ok">Completed</span>
                    </div>
                    <div className="hint-inline" style={{ marginBottom: 4 }}>
                      Taken{' '}
                      {formatGermanyDateTime(o.createdAt)}
                      {o.completedAt
                        ? ` · Delivered ${formatGermanyDateTime(o.completedAt)}`
                        : ''}
                      {o.payMethod ? ` · ${o.payMethod === 'paypal' ? 'PayPal' : 'Cash'}` : ''}
                    </div>
                    <ul className="order-lines">
                      {o.lines.map((l) => (
                        <li key={lineKey(l.menuItemId, l.drink)}>
                          {l.qty}× {l.name}
                          <span className="hint-inline">
                            {' '}
                            <Money value={l.price * l.qty} />
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="order-total-bar">
                      <div>
                        <div>
                          Total <Money value={orderTotal(o.lines)} />
                        </div>
                        {o.paid != null && (
                          <div className="hint-inline">
                            Paid <Money value={o.paid} />
                          </div>
                        )}
                      </div>
                      <div className="page-actions">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            if (o.eventId) {
                              setSoldEventId(o.eventId)
                              applyStallEvent(o.eventId)
                            }
                            setTab('completed')
                          }}
                        >
                          View in Sold
                        </button>
                      </div>
                    </div>
                  </MotionCard>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {voidTarget && (
        <div
          className="pay-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setVoidTarget(null)}
        >
          <div className="pay-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Void / refund {voidTarget.label}</h2>
            <p className="hint-inline">Removes this sale from totals. Enter a short reason.</p>
            <div className="field" style={{ marginTop: '0.75rem' }}>
              <label htmlFor="void-reason">Reason</label>
              <input
                id="void-reason"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Wrong order / customer cancelled"
                autoFocus
              />
            </div>
            <div className="page-actions" style={{ marginTop: '0.85rem' }}>
              <button type="button" className="btn ghost" onClick={() => setVoidTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={!voidReason.trim()}
                onClick={() => {
                  voidOrder(voidTarget.id, voidReason)
                  setVoidTarget(null)
                  setVoidReason('')
                }}
              >
                Confirm void
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
      {payOrder && (
        <motion.div
          key="pay"
          className="pay-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            setPayOrder(null)
            setPayMethod(null)
            setPayMode('complete')
          }}
        >
          <motion.div
            className="pay-panel"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={springSoft}
          >
            <div className="card-head">
              <h2 id="pay-title">
                {payOrder.label} —{' '}
                {payMode === 'markPaid' ? 'Mark paid (stay pending)' : tr('payment')}
              </h2>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setPayOrder(null)
                  setPayMethod(null)
                  setPayMode('complete')
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="pay-total">
              <div className="kpi-label">{tr('orderTotal')}</div>
              <strong>
                <Money value={payTotal} />
              </strong>
              <GermanSpokenAmount value={payTotal} />
            </div>
            {payMode === 'markPaid' && (
              <p className="hint-inline" style={{ marginTop: 8 }}>
                Payment is taken now. Ticket stays in Pending until you tap Delivered.
              </p>
            )}

            {!payMethod ? (
              <div className="page-actions" style={{ marginTop: '1rem', flexDirection: 'column' }}>
                <button
                  type="button"
                  className="btn"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setPayMethod('cash')}
                >
                  <Banknote size={16} /> Cash
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setPayMethod('paypal')}
                >
                  <QrCode size={16} /> PayPal
                </button>
              </div>
            ) : payMethod === 'paypal' ? (
              <>
                <p className="hint-inline" style={{ marginTop: '0.75rem' }}>
                  Customer scans this PayPal QR — tap to enlarge
                </p>
                <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                  <AnimatePresence>
                    <motion.button
                      type="button"
                      className={`pay-qr${qrZoomed ? ' is-zoomed' : ''}`}
                      onClick={() => setQrZoomed((z) => !z)}
                      initial={{ opacity: 0, scale: 0.72, y: 10 }}
                      animate={{ opacity: 1, scale: qrZoomed ? 1.28 : 1, y: 0 }}
                      transition={springSoft}
                      aria-label={qrZoomed ? 'Shrink QR code' : 'Enlarge QR code'}
                    >
                      <img
                        src={resolvePaypalQrSrc(paypalQrDataUrl, 220)}
                        alt="PayPal QR"
                        width={220}
                        height={220}
                      />
                    </motion.button>
                  </AnimatePresence>
                  <div className="hint-inline" style={{ marginTop: 8 }}>
                    {paypalQrDataUrl
                      ? 'Uploaded PayPal QR'
                      : getPaypalMeUrl()}
                  </div>
                </div>
                <div className="page-actions" style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setPayMethod(null)}
                  >
                    Back
                  </button>
                  <button type="button" className="btn" disabled={payBusy} onClick={confirmPay}>
                    {payMode === 'markPaid' ? 'Confirm payment' : tr('confirmDelivery')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  className={`field field--float${paidInput ? ' is-filled' : ''}`}
                  style={{ marginTop: '0.85rem' }}
                >
                  <label htmlFor="paid-amount">{tr('customerGave')} (€)</label>
                  <input
                    id="paid-amount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.5}
                    autoFocus
                    placeholder=" "
                    value={paidInput}
                    onChange={(e) => setPaidInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canConfirmPay) confirmPay()
                    }}
                  />
                </div>
                <div className="chip-row" style={{ marginTop: '0.55rem' }}>
                  {[payTotal, 10, 20, 50].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="btn ghost"
                      onClick={() => setPaidInput(String(n))}
                    >
                      €{n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}
                    </button>
                  ))}
                </div>
                <AnimatePresence initial={false}>
                  {(paidInput || tipNum > 0) && (
                    <motion.div
                      className={`field field--float${tipInput ? ' is-filled' : ''} disclose-extra`}
                      style={{ marginTop: '0.75rem' }}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={springSoft}
                    >
                      <label htmlFor="tip-amount">{tr('tip')} (€)</label>
                      <input
                        id="tip-amount"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.5}
                        placeholder=" "
                        value={tipInput}
                        onChange={(e) => setTipInput(e.target.value)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                {changeDue != null && changeDue > 0 && (
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ marginTop: '0.45rem', width: '100%' }}
                    onClick={() => {
                      setTipInput(String(changeDue + tipNum))
                    }}
                  >
                    {tr('keepChangeAsTip')}
                  </button>
                )}
                <div
                  className={`pay-change ${changeDue != null && changeDue < 0 ? 'is-short' : ''}`}
                >
                  {changeDue == null ? (
                    <span className="hint-inline">Enter amount received</span>
                  ) : changeDue < 0 ? (
                    <>
                      Still need{' '}
                      <strong>
                        <Money value={-changeDue} />
                      </strong>
                    </>
                  ) : changeDue === 0 ? (
                    <>
                      Exact — <strong>no change</strong>
                      {tipNum > 0 && (
                        <>
                          {' '}
                          · {tr('tip')} <Money value={tipNum} />
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        {tr('changeDrawer')}{' '}
                        <strong className="pay-change__amount">
                          <Money value={changeDue} />
                        </strong>
                      </div>
                      {changePieces.length > 0 && (
                        <div className="pay-change__drawer">
                          {formatChangeSuggestion(changePieces)}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="page-actions" style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setPayMethod(null)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={`btn${payBusy ? ' action-morph is-busy' : ''}`}
                    disabled={!canConfirmPay || payBusy}
                    onClick={confirmPay}
                  >
                    {payBusy
                      ? 'Taking payment…'
                      : payMode === 'markPaid'
                        ? 'Confirm payment'
                        : tr('confirmDelivery')}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {tab === 'sales' && (
        <>
          <PillTabs
            group="orders-sales"
            style={{ marginBottom: '0.75rem' }}
            value={salesScope}
            onChange={setSalesScope}
            items={[
              { id: 'today', label: 'Today' },
              { id: 'event', label: 'This event' },
              { id: 'all', label: 'All time' },
            ]}
            trailing={
              salesScope === 'event' ? (
                <select
                  value={salesEventId || activeEventId}
                  onChange={(e) => setSalesEventId(e.target.value)}
                >
                  {stallEvents.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.id}
                    </option>
                  ))}
                  <option value="unassigned">Unassigned</option>
                </select>
              ) : null
            }
          />

          <div className="grid kpi" style={{ marginBottom: '0.9rem' }}>
            <MotionCard interactive={false}>
              <div className="kpi-label">Cash</div>
              <div className="kpi-value">
                <Money value={salesPay.cashRevenue} />
              </div>
              <div className="hint-inline">{salesPay.cashOrders} cash orders</div>
            </MotionCard>
            <MotionCard interactive={false}>
              <div className="kpi-label">PayPal</div>
              <div className="kpi-value">
                <Money value={salesPay.paypalRevenue} />
              </div>
              <div className="hint-inline">{salesPay.paypalOrders} PayPal orders</div>
            </MotionCard>
            <MotionCard interactive={false}>
              <div className="kpi-label">Total</div>
              <div className="kpi-value">
                <Money value={salesPay.totalRevenue} />
              </div>
              <div className="hint-inline">
                {sales.orderCount} tickets · {sales.itemCount} items
              </div>
            </MotionCard>
            <MotionCard interactive={false}>
              <div className="kpi-label">Cash in box</div>
              <div className="kpi-value">
                <Money value={sales.cashIn} />
              </div>
              <div className="hint-inline">Paid − change returned</div>
            </MotionCard>
            <MotionCard interactive={false}>
              <div className="kpi-label">
                <TrendingUp size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                Most selling
              </div>
              <div className="kpi-value" style={{ fontSize: '1.15rem' }}>
                {sales.topItem ? sales.topItem.name : '—'}
              </div>
              <div className="hint-inline">
                {sales.topItem
                  ? `${sales.topItem.qty} sold · €${sales.topItem.revenue.toFixed(2)}`
                  : 'No completed sales yet'}
              </div>
            </MotionCard>
          </div>

          <div style={{ marginBottom: '0.9rem' }}>
            <MotionCard interactive={false}>
              <h2>Plates / items sold</h2>
              <div className="table-wrap" style={{ marginTop: '0.65rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>€ / unit</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.byItem.map((r) => (
                      <tr key={r.menuItemId}>
                        <td>
                          <strong>{r.name}</strong>
                          {sales.topItem?.menuItemId === r.menuItemId && (
                            <span className="badge ok" style={{ marginLeft: 6 }}>
                              Top
                            </span>
                          )}
                        </td>
                        <td>{r.qty}</td>
                        <td>
                          <Money value={r.avgPrice} />
                        </td>
                        <td>
                          <Money value={r.revenue} />
                        </td>
                      </tr>
                    ))}
                    {sales.byItem.length === 0 && (
                      <tr>
                        <td colSpan={4}>No sales in this scope yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </MotionCard>
          </div>

          <div className="grid two" style={{ marginBottom: '0.9rem' }}>
            <MotionCard interactive={false}>
              <h2>Per day</h2>
              <div className="table-wrap" style={{ marginTop: '0.65rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Orders</th>
                      <th>Items</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(salesScope === 'all' ? salesAllEvents.byDay : sales.byDay).map((d) => (
                      <tr key={d.day}>
                        <td>{d.day}</td>
                        <td>{d.orders}</td>
                        <td>{d.items}</td>
                        <td>
                          <Money value={d.revenue} />
                        </td>
                      </tr>
                    ))}
                    {(salesScope === 'all' ? salesAllEvents.byDay : sales.byDay).length === 0 && (
                      <tr>
                        <td colSpan={4}>—</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </MotionCard>

            <MotionCard interactive={false}>
              <h2>Per event</h2>
              <div className="table-wrap" style={{ marginTop: '0.65rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Orders</th>
                      <th>Items</th>
                      <th>Total €</th>
                      <th>Top item</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesAllEvents.byEvent.map((e) => (
                      <tr key={e.eventId}>
                        <td>
                          <strong>{e.eventId === 'unassigned' ? 'Unassigned' : e.eventId}</strong>
                        </td>
                        <td>{e.orders}</td>
                        <td>{e.items}</td>
                        <td>
                          <Money value={e.revenue} />
                        </td>
                        <td className="hint-inline">{e.topItem || '—'}</td>
                      </tr>
                    ))}
                    {salesAllEvents.byEvent.length === 0 && (
                      <tr>
                        <td colSpan={5}>—</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </MotionCard>
          </div>
        </>
      )}

      {tab === 'menu' && (
        <MotionCard interactive={false}>
          <h2>Menu prices</h2>
          <p className="hint-inline" style={{ marginTop: '0.35rem' }}>
            Each <strong>event type</strong> has its own menu and prices (saved separately). New
            order reads the type from the stall’s Excel name (city + type) and shows that menu
            automatically.
          </p>

          <div className="filters" style={{ marginTop: '0.75rem', alignItems: 'flex-end' }}>
            <div className="field" style={{ minWidth: 220 }}>
              <label htmlFor="price-event-type">Event type</label>
              <select
                id="price-event-type"
                value={eventTypes.includes(priceEventType) ? priceEventType : ''}
                onChange={(e) => setPriceEventType(e.target.value)}
              >
                <option value="">— pick type —</option>
                {eventTypes.map((t) => {
                  const n = menuForEventType(t, eventMenus, menu).length
                  const saved = Boolean(eventMenus[t]?.length)
                  return (
                    <option key={t} value={t}>
                      {t}
                      {saved ? ` · ${n} items` : n ? ` · ${n} (seed)` : ''}
                    </option>
                  )
                })}
              </select>
            </div>
            <div className="field">
              <label htmlFor="new-event-type">Add event type</label>
              <input
                id="new-event-type"
                value={newEventTypeName}
                onChange={(e) => setNewEventTypeName(e.target.value)}
                placeholder="e.g. Weihnachtsmarkt"
              />
            </div>
            <button
              type="button"
              className="btn"
              disabled={!newEventTypeName.trim()}
              onClick={() => {
                const name = newEventTypeName.trim()
                if (!name) return
                addCustomEventType(name)
                setPriceEventType(name.trim())
                setNewEventTypeName('')
              }}
            >
              Add type
            </button>
          </div>

          {priceEventType && (
            <div className="filters" style={{ marginTop: '0.65rem', alignItems: 'flex-end' }}>
              <div className="field">
                <label htmlFor="copy-from-type">Copy full menu from</label>
                <select
                  id="copy-from-type"
                  value={copyFromEventType}
                  onChange={(e) => setCopyFromEventType(e.target.value)}
                >
                  <option value="">— other type —</option>
                  {eventTypes
                    .filter((t) => t !== priceEventType)
                    .map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="button"
                className="btn"
                disabled={!copyFromEventType}
                onClick={() => {
                  const ok = copyEventMenu(copyFromEventType, priceEventType)
                  if (!ok) {
                    window.alert('Nothing to copy from that type yet.')
                  }
                }}
              >
                Copy menu
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  if (
                    window.confirm(
                      `Reset “${priceEventType}” menu to defaults? Your custom items for this type will be cleared.`,
                    )
                  ) {
                    clearEventMenu(priceEventType)
                    ensureEventMenu(priceEventType)
                  }
                }}
              >
                Reset type menu
              </button>
              <span className="badge ok">{typeMenu.length} items saved for {priceEventType}</span>
            </div>
          )}

          {!priceEventType && (
            <p className="hint-inline" style={{ marginTop: '1rem' }}>
              Select an event type above to edit its menu.
            </p>
          )}

          {priceEventType && (
            <motion.div
              key={priceEventType}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springSoft}
            >
              <div className="combo-editor-list" style={{ marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>
                  Combos · {priceEventType}
                </h3>
                {typeMenu
                  .filter((m) => m.kind === 'combo')
                  .map((m) => {
                    const items = parseComboContents(m.contents)
                    const singles = typeMenu.filter((x) => x.kind === 'single')
                    return (
                      <div key={m.id} className="combo-editor">
                        <div className="combo-editor__head">
                          <div className="field" style={{ flex: 1 }}>
                            <label>Combo name</label>
                            <input
                              value={m.name}
                              onChange={(e) =>
                                updateEventMenuItem(priceEventType, m.id, {
                                  name: e.target.value,
                                })
                              }
                            />
                          </div>
                          <button
                            type="button"
                            className="btn ghost"
                            title="Delete combo"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove “${m.name}” from ${priceEventType} menu?`,
                                )
                              ) {
                                removeEventMenuItem(priceEventType, m.id)
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                          <div className="field">
                            <label>Chai €</label>
                            <EuroInput
                              value={m.priceWithChai ?? m.price}
                              onChange={(priceWithChai) =>
                                updateEventMenuItem(priceEventType, m.id, { priceWithChai })
                              }
                            />
                          </div>
                          <div className="field">
                            <label>Lassi €</label>
                            <EuroInput
                              value={m.priceWithLassi ?? m.price}
                              onChange={(priceWithLassi) =>
                                updateEventMenuItem(priceEventType, m.id, { priceWithLassi })
                              }
                            />
                          </div>
                          <div className="field">
                            <label>Food cost €</label>
                            <EuroInput
                              value={m.foodCost ?? 0}
                              step={0.1}
                              aria-label="Food cost"
                              onChange={(foodCost) => setMenuFoodCost(m.id, foodCost)}
                            />
                          </div>
                          <div className="field">
                            <label>Chai cost €</label>
                            <EuroInput
                              value={m.drinkCostChai ?? 0}
                              step={0.1}
                              onChange={(chai) =>
                                setMenuFoodCost(m.id, m.foodCost ?? 0, { chai })
                              }
                            />
                          </div>
                          <div className="field">
                            <label>Lassi cost €</label>
                            <EuroInput
                              value={m.drinkCostLassi ?? 0}
                              step={0.1}
                              onChange={(lassi) =>
                                setMenuFoodCost(m.id, m.foodCost ?? 0, { lassi })
                              }
                            />
                          </div>
                        </div>
                        <div className="kpi-label" style={{ marginBottom: 6 }}>
                          Included items
                        </div>
                        <ul className="combo-items">
                          {items.map((item, idx) => (
                            <li key={`${m.id}-${idx}`}>
                              <input
                                value={item}
                                onChange={(e) => {
                                  const next = [...items]
                                  next[idx] = e.target.value
                                  updateEventMenuItem(priceEventType, m.id, {
                                    contents: joinComboContents(next),
                                  })
                                }}
                              />
                              <button
                                type="button"
                                className="btn ghost"
                                title="Remove"
                                onClick={() => {
                                  const next = items.filter((_, i) => i !== idx)
                                  updateEventMenuItem(priceEventType, m.id, {
                                    contents: joinComboContents(next),
                                  })
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </li>
                          ))}
                          {items.length === 0 && (
                            <li className="hint-inline">No items yet — add below.</li>
                          )}
                        </ul>
                        <div className="filters" style={{ marginTop: '0.55rem' }}>
                          <div className="field">
                            <label>Add from this menu</label>
                            <select
                              value={comboAddPick[m.id] || ''}
                              onChange={(e) =>
                                setComboAddPick((p) => ({ ...p, [m.id]: e.target.value }))
                              }
                            >
                              <option value="">— pick item —</option>
                              {singles.map((s) => (
                                <option key={s.id} value={s.name}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            className="btn ghost"
                            disabled={!comboAddPick[m.id]}
                            onClick={() => {
                              const name = comboAddPick[m.id]
                              if (!name) return
                              updateEventMenuItem(priceEventType, m.id, {
                                contents: joinComboContents([...items, name]),
                              })
                              setComboAddPick((p) => ({ ...p, [m.id]: '' }))
                            }}
                          >
                            <Plus size={14} /> Add
                          </button>
                          <div className="field">
                            <label>Or custom</label>
                            <input
                              value={comboAddCustom[m.id] || ''}
                              onChange={(e) =>
                                setComboAddCustom((p) => ({ ...p, [m.id]: e.target.value }))
                              }
                              placeholder="e.g. Extra chutney"
                            />
                          </div>
                          <button
                            type="button"
                            className="btn ghost"
                            disabled={!(comboAddCustom[m.id] || '').trim()}
                            onClick={() => {
                              const custom = (comboAddCustom[m.id] || '').trim()
                              if (!custom) return
                              updateEventMenuItem(priceEventType, m.id, {
                                contents: joinComboContents([...items, custom]),
                              })
                              setComboAddCustom((p) => ({ ...p, [m.id]: '' }))
                            }}
                          >
                            <Plus size={14} /> Add custom
                          </button>
                        </div>
                      </div>
                    )
                  })}
                {typeMenu.filter((m) => m.kind === 'combo').length === 0 && (
                  <p className="hint-inline">No combos for this type yet — add one below.</p>
                )}
              </div>

              <div className="table-wrap" style={{ marginTop: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Price (€)</th>
                      <th>Cost/srv (€)</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {typeMenu.map((m, menuIdx) => (
                      <tr key={m.id}>
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <button
                                type="button"
                                className="btn ghost"
                                disabled={menuIdx === 0}
                                title="Move up"
                                onClick={() =>
                                  moveEventMenuItem(priceEventType, m.id, 'up')
                                }
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn ghost"
                                disabled={menuIdx >= typeMenu.length - 1}
                                title="Move down"
                                onClick={() =>
                                  moveEventMenuItem(priceEventType, m.id, 'down')
                                }
                              >
                                <ArrowDown size={14} />
                              </button>
                            </div>
                            <div style={{ flex: 1 }}>
                              <input
                                value={m.name}
                                onChange={(e) =>
                                  updateEventMenuItem(priceEventType, m.id, {
                                    name: e.target.value,
                                  })
                                }
                              />
                              {m.kind === 'combo' && (
                                <div className="hint-inline">
                                  Combo · {m.contents || 'chai / lassi'}
                                </div>
                              )}
                              <div className="field" style={{ marginTop: 6 }}>
                                <label>Customer description</label>
                                <textarea
                                  rows={2}
                                  value={m.description || ''}
                                  placeholder="How it’s prepared…"
                                  onChange={(e) =>
                                    updateEventMenuItem(priceEventType, m.id, {
                                      description: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="field" style={{ marginTop: 4 }}>
                                <label>Ingredients</label>
                                <textarea
                                  rows={2}
                                  value={m.ingredients || ''}
                                  placeholder="Main ingredients…"
                                  onChange={(e) =>
                                    updateEventMenuItem(priceEventType, m.id, {
                                      ingredients: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div
                                className="hint-inline"
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '0.65rem 1rem',
                                  marginTop: 6,
                                }}
                              >
                                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(m.vegan)}
                                    onChange={(e) =>
                                      updateEventMenuItem(priceEventType, m.id, {
                                        vegan: e.target.checked,
                                        vegetarian: e.target.checked ? true : m.vegetarian,
                                      })
                                    }
                                  />
                                  Vegan
                                </label>
                                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(m.vegetarian || m.vegan)}
                                    onChange={(e) =>
                                      updateEventMenuItem(priceEventType, m.id, {
                                        vegetarian: e.target.checked,
                                        vegan: e.target.checked ? m.vegan : false,
                                      })
                                    }
                                  />
                                  Vegetarian
                                </label>
                                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(m.glutenFree)}
                                    onChange={(e) =>
                                      updateEventMenuItem(priceEventType, m.id, {
                                        glutenFree: e.target.checked,
                                      })
                                    }
                                  />
                                  Gluten free
                                </label>
                                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(m.hideFromCustomer)}
                                    onChange={(e) =>
                                      updateEventMenuItem(priceEventType, m.id, {
                                        hideFromCustomer: e.target.checked,
                                      })
                                    }
                                  />
                                  Hide from customer order page
                                </label>
                                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(m.soldOut)}
                                    onChange={(e) =>
                                      updateEventMenuItem(priceEventType, m.id, {
                                        soldOut: e.target.checked,
                                      })
                                    }
                                  />
                                  Sold out (visible, not orderable)
                                </label>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {m.kind === 'combo' ? (
                            <div className="price-pair">
                              <label>
                                Chai
                                <EuroInput
                                  className="input-tiny"
                                  value={m.priceWithChai ?? m.price}
                                  onChange={(priceWithChai) =>
                                    updateEventMenuItem(priceEventType, m.id, {
                                      priceWithChai,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Lassi
                                <EuroInput
                                  className="input-tiny"
                                  value={m.priceWithLassi ?? m.price}
                                  onChange={(priceWithLassi) =>
                                    updateEventMenuItem(priceEventType, m.id, {
                                      priceWithLassi,
                                    })
                                  }
                                />
                              </label>
                            </div>
                          ) : (
                            <EuroInput
                              className="input-tiny"
                              value={m.price}
                              onChange={(price) =>
                                updateEventMenuItem(priceEventType, m.id, { price })
                              }
                            />
                          )}
                        </td>
                        <td>
                          {m.kind === 'combo' ? (
                            <div className="price-pair">
                              <label>
                                Food
                                <EuroInput
                                  className="input-tiny"
                                  value={m.foodCost ?? 0}
                                  step={0.1}
                                  onChange={(foodCost) => setMenuFoodCost(m.id, foodCost)}
                                />
                              </label>
                              <label>
                                +Chai
                                <EuroInput
                                  className="input-tiny"
                                  value={m.drinkCostChai ?? 0}
                                  step={0.1}
                                  onChange={(chai) =>
                                    setMenuFoodCost(m.id, m.foodCost ?? 0, { chai })
                                  }
                                />
                              </label>
                              <label>
                                +Lassi
                                <EuroInput
                                  className="input-tiny"
                                  value={m.drinkCostLassi ?? 0}
                                  step={0.1}
                                  onChange={(lassi) =>
                                    setMenuFoodCost(m.id, m.foodCost ?? 0, { lassi })
                                  }
                                />
                              </label>
                            </div>
                          ) : (
                            <EuroInput
                              className="input-tiny"
                              value={m.foodCost ?? 0}
                              step={0.1}
                              aria-label="Food cost"
                              onChange={(foodCost) => setMenuFoodCost(m.id, foodCost)}
                            />
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn ghost"
                            title="Delete from this type menu"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove “${m.name}” from ${priceEventType}?`,
                                )
                              ) {
                                removeEventMenuItem(priceEventType, m.id)
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {typeMenu.length === 0 && (
                      <tr>
                        <td colSpan={3} className="hint-inline">
                          No items yet — add below.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="filters" style={{ marginTop: '0.85rem' }}>
                <div className="field">
                  <label>New item for {priceEventType}</label>
                  <input
                    value={newMenuName}
                    onChange={(e) => setNewMenuName(e.target.value)}
                    placeholder="e.g. Onion dosa"
                  />
                </div>
                <div className="field">
                  <label>Kind</label>
                  <select
                    value={newMenuKind}
                    onChange={(e) =>
                      setNewMenuKind(e.target.value === 'combo' ? 'combo' : 'single')
                    }
                  >
                    <option value="single">Single</option>
                    <option value="combo">Combo</option>
                  </select>
                </div>
                <div className="field">
                  <label>Price €</label>
                  <EuroInput value={newMenuPrice} onChange={setNewMenuPrice} />
                </div>
                <button
                  type="button"
                  className="btn"
                  disabled={!newMenuName.trim()}
                  onClick={() => {
                    addEventMenuItem(
                      priceEventType,
                      newMenuName,
                      roundEuro(newMenuPrice),
                      newMenuKind,
                    )
                    setNewMenuName('')
                  }}
                >
                  Add to {priceEventType}
                </button>
              </div>
            </motion.div>
          )}
        </MotionCard>
      )}
      <SameDayPeerChip peers={peerEvents} onOpen={applyStallEvent} />
    </>
  )
}
