import {
  Award,
  Check,
  ClipboardList,
  Monitor,
  Minus,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Money } from '../components/Money'
import { MotionCard } from '../components/MotionCard'
import { useData } from '../context/DataContext'
import { useLocale } from '../context/LocaleContext'
import { useOrdersStallIdle, useStallMode } from '../context/StallModeContext'
import { orderTotal, useStallOps } from '../context/StallOpsContext'
import {
  allUnlockedForDay,
  evaluateAchievements,
  type AchievementDef,
} from '../lib/achievements'
import { formatChangeSuggestion, suggestChange } from '../lib/changeDrawer'
import { openCustomerDisplay, publishDisplay } from '../lib/displaySync'
import { germanyTodayYmd } from '../lib/germanyTime'
import { summarizePosCashToday } from '../lib/posCash'
import { buildSalesReport } from '../lib/salesStats'
import { printQueueTicket } from '../lib/ticketPrint'
import {
  joinComboContents,
  lineKey,
  makeOrderLine,
  parseComboContents,
  resolveMenuPrice,
  soldCounts,
  type DrinkChoice,
  type EventPriceOverride,
  type MenuItem,
  type OrderLine,
  type StallOrder,
} from '../lib/stallOps'

const DRINK_IDS = new Set(['masala-chai', 'mango-lassi'])

function shortDrink(drink: DrinkChoice): string {
  return drink === 'chai' ? 'Chai' : 'Lassi'
}

type Tab = 'new' | 'pending' | 'completed' | 'sales' | 'menu'
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
    eventPrices,
    nextCustomer,
    createOrder,
    updatePendingOrder,
    completeOrder,
    reopenOrder,
    deleteOrder,
    voidOrder,
    setMenuPrice,
    setComboDefaultPrices,
    updateMenuItem,
    setEventPrice,
    clearEventPrices,
    copyEventPrices,
    addMenuItem,
    setActiveEventId,
  } = useStallOps()

  const [tab, setTab] = useState<Tab>('new')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [editId, setEditId] = useState<string | null>(null)
  const [editLines, setEditLines] = useState<OrderLine[]>([])
  const [newMenuName, setNewMenuName] = useState('')
  const [newMenuPrice, setNewMenuPrice] = useState(5)
  const [comboAddPick, setComboAddPick] = useState<Record<string, string>>({})
  const [comboAddCustom, setComboAddCustom] = useState<Record<string, string>>({})
  const [payOrder, setPayOrder] = useState<StallOrder | null>(null)
  const [paidInput, setPaidInput] = useState('')
  const [tipInput, setTipInput] = useState('0')
  const [badgeToast, setBadgeToast] = useState<AchievementDef | null>(null)
  const [salesScope, setSalesScope] = useState<SalesScope>('today')
  const [salesEventId, setSalesEventId] = useState('')
  const [priceEventId, setPriceEventId] = useState('')
  const [copyFromEventId, setCopyFromEventId] = useState('')
  const [voidTarget, setVoidTarget] = useState<StallOrder | null>(null)
  const [voidReason, setVoidReason] = useState('')

  const events = snapshot?.events || []
  const stallEvents = useMemo(
    () =>
      [...events]
        .filter((e) => e.id.trim().toLowerCase() !== 'setup')
        .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')),
    [events],
  )

  useEffect(() => {
    if (activeEventId || !stallEvents.length) return
    const upcoming = stallEvents.find((e) => (e.status || '').toLowerCase() !== 'completed')
    setActiveEventId((upcoming || stallEvents[0])!.id)
  }, [activeEventId, stallEvents, setActiveEventId])

  useEffect(() => {
    if (priceEventId) return
    if (activeEventId) setPriceEventId(activeEventId)
  }, [activeEventId, priceEventId])

  useEffect(() => {
    if (isStall && (tab === 'sales' || tab === 'menu')) setTab('new')
  }, [isStall, tab])

  const pending = useMemo(
    () => orders.filter((o) => o.status === 'pending'),
    [orders],
  )
  const completed = useMemo(
    () => orders.filter((o) => o.status === 'completed' && !o.voided),
    [orders],
  )
  const voided = useMemo(
    () => orders.filter((o) => o.voided),
    [orders],
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
  const sold = useMemo(() => soldCounts(orders), [orders])
  const soldRevenue = sold.reduce((s, r) => s + r.revenue, 0)
  const posCash = useMemo(() => summarizePosCashToday(orders), [orders])

  const salesFilter = useMemo(() => {
    if (salesScope === 'today') return { day: germanyTodayYmd() }
    if (salesScope === 'event') {
      return { eventId: salesEventId || activeEventId || 'unassigned' }
    }
    return undefined
  }, [salesScope, salesEventId, activeEventId])

  const sales = useMemo(() => buildSalesReport(orders, salesFilter), [orders, salesFilter])
  const salesAllEvents = useMemo(() => buildSalesReport(orders), [orders])

  const cartLines: OrderLine[] = useMemo(() => {
    const lines: OrderLine[] = []
    for (const m of menu) {
      if (m.kind === 'combo') {
        for (const drink of ['chai', 'lassi'] as DrinkChoice[]) {
          const q = cart[lineKey(m.id, drink)] || 0
          if (q > 0) lines.push(makeOrderLine(m, q, activeEventId, eventPrices, drink))
        }
      } else {
        const q = cart[m.id] || 0
        if (q > 0) lines.push(makeOrderLine(m, q, activeEventId, eventPrices))
      }
    }
    return lines
  }, [menu, cart, activeEventId, eventPrices])

  const cartTotal = orderTotal(cartLines)
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0)

  const menuCombos = useMemo(() => menu.filter((m) => m.kind === 'combo'), [menu])
  const menuFood = useMemo(
    () => menu.filter((m) => m.kind === 'single' && !DRINK_IDS.has(m.id)),
    [menu],
  )
  const menuDrinks = useMemo(
    () => menu.filter((m) => m.kind === 'single' && DRINK_IDS.has(m.id)),
    [menu],
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
    const item = menu.find((m) => m.id === line.menuItemId)
    if (!item) return
    setQty(item, 0, line.drink)
  }

  function submitCart() {
    if (!cartLines.length) return
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
  const paidNum = Number(paidInput.replace(',', '.'))
  const tipNum = Math.max(0, Number(String(tipInput).replace(',', '.')) || 0)
  const paidValid = Number.isFinite(paidNum) && paidNum >= 0
  const changeDue = paidValid
    ? Math.round((paidNum - payTotal - tipNum) * 100) / 100
    : null
  const canConfirmPay =
    paidValid && paidNum + 1e-9 >= payTotal + tipNum && tipNum >= 0
  const changePieces =
    changeDue != null && changeDue > 0 ? suggestChange(changeDue) : []
  const badgesToday = useMemo(() => allUnlockedForDay(), [orders, badgeToast])

  function openPay(o: StallOrder) {
    setPayOrder(o)
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

  function confirmPay() {
    if (!payOrder || !canConfirmPay) return
    completeOrder(payOrder.id, paidNum, tipNum)
    const completed: StallOrder = {
      ...payOrder,
      status: 'completed',
      completedAt: new Date().toISOString(),
      paid: paidNum,
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
    setPaidInput('')
    setTipInput('0')
    setTab('completed')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <ClipboardList size={22} style={{ verticalAlign: -3, marginRight: 8 }} />
            Orders
          </h1>
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
          <button
            type="button"
            className="btn ghost"
            onClick={() => openCustomerDisplay()}
            title={tr('customerDisplay')}
          >
            <Monitor size={16} /> {tr('customerDisplay')}
          </button>
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

      <div className="split-mode-row" style={{ marginBottom: '0.85rem' }}>
        {(
          (
            [
              ['new', 'New order'],
              ['pending', `Pending (${pending.length})`],
              ['completed', `Sold (${completed.length})`],
              ['sales', 'Sales'],
              ['menu', 'Menu prices'],
            ] as const
          ).filter(([id]) => !isStall || (id !== 'sales' && id !== 'menu'))
        ).map(([id, text]) => (
          <button
            key={id}
            type="button"
            className={`btn ghost ${tab === id ? 'is-on' : ''}`}
            onClick={() => setTab(id)}
          >
            {text}
          </button>
        ))}
      </div>

      {tab === 'new' && (
        <div className={`pos-shell${cartLines.length ? ' pos-shell--docked' : ''}`}>
          <div className="pos-toolbar">
            <label className="pos-toolbar__event" htmlFor="active-event">
              <span>Event</span>
              <select
                id="active-event"
                value={activeEventId}
                onChange={(e) => setActiveEventId(e.target.value)}
              >
                <option value="">— pick stall —</option>
                {stallEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.id} · {e.location || e.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="pos-toolbar__actions">
              <span className="badge ok">Customer {nextCustomer}</span>
              <button
                type="button"
                className="btn ghost"
                disabled={!lastTicket}
                onClick={repeatLastTicket}
                title={lastTicket ? `Copy ${lastTicket.label}` : 'No previous ticket'}
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
                      const pChai = resolveMenuPrice(m, activeEventId, eventPrices, 'chai')
                      const pLassi = resolveMenuPrice(m, activeEventId, eventPrices, 'lassi')
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

              {menuFood.length > 0 && (
                <section className="pos-section">
                  <h2 className="pos-section__title">Dishes</h2>
                  <div className="pos-item-grid">
                    {menuFood.map((m) => {
                      const q = cartQty(m)
                      const price = resolveMenuPrice(m, activeEventId, eventPrices)
                      return (
                        <div key={m.id} className={`pos-item ${q ? 'is-on' : ''}`}>
                          {q > 0 && (
                            <button
                              type="button"
                              className="pos-item__minus"
                              aria-label={`Remove ${m.name}`}
                              onClick={() => bumpQty(m, -1)}
                            >
                              <Minus size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="pos-item__add"
                            onClick={() => bumpQty(m, 1)}
                          >
                            <span className="pos-item__name">{m.name}</span>
                            <span className="pos-item__price">
                              <Money value={price} />
                            </span>
                            {q > 0 ? (
                              <span className="pos-item__qty">{q}</span>
                            ) : (
                              <span className="pos-item__hint">Tap to add</span>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {menuDrinks.length > 0 && (
                <section className="pos-section">
                  <h2 className="pos-section__title">Drinks</h2>
                  <div className="pos-item-grid pos-item-grid--drinks">
                    {menuDrinks.map((m) => {
                      const q = cartQty(m)
                      const price = resolveMenuPrice(m, activeEventId, eventPrices)
                      return (
                        <div key={m.id} className={`pos-item ${q ? 'is-on' : ''}`}>
                          {q > 0 && (
                            <button
                              type="button"
                              className="pos-item__minus"
                              aria-label={`Remove ${m.name}`}
                              onClick={() => bumpQty(m, -1)}
                            >
                              <Minus size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="pos-item__add"
                            onClick={() => bumpQty(m, 1)}
                          >
                            <span className="pos-item__name">{m.name}</span>
                            <span className="pos-item__price">
                              <Money value={price} />
                            </span>
                            {q > 0 ? (
                              <span className="pos-item__qty">{q}</span>
                            ) : (
                              <span className="pos-item__hint">Tap to add</span>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>

            <aside className="pos-cart">
              <div className="pos-cart__head">
                <h2>Ticket</h2>
                <span className="badge ok">Customer {nextCustomer}</span>
              </div>
              {cartLines.length === 0 ? (
                <p className="pos-cart__empty">Tap dishes or combo drinks to build the order.</p>
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
                  <strong>
                    <Money value={cartTotal} />
                  </strong>
                </div>
                <button
                  type="button"
                  className="btn pos-cart__submit"
                  disabled={!cartLines.length}
                  onClick={submitCart}
                >
                  Add Customer {nextCustomer}
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
              </div>
              <button
                type="button"
                className="btn pos-dock__submit"
                onClick={submitCart}
              >
                Add Customer {nextCustomer}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'pending' && (
        <div className="order-list">
          {pending.length === 0 && (
            <MotionCard interactive={false}>
              <p className="hint-inline">No pending orders — start a new ticket.</p>
            </MotionCard>
          )}
          {pending.map((o) => (
            <MotionCard key={o.id} interactive={false} className="order-card">
              {editId === o.id ? (
                <>
                  <div className="card-head">
                    <h2>{o.label}</h2>
                    <span className="badge warn">Editing items</span>
                  </div>
                  <div className="pos-menu pos-menu--edit">
                    <div className="pos-combo-grid">
                      {menu
                        .filter((m) => m.kind === 'combo')
                        .map((m) => {
                          const ev = o.eventId || activeEventId
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
                                              ev,
                                              eventPrices,
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
                                            value={resolveMenuPrice(m, ev, eventPrices, drink)}
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
                                                ev,
                                                eventPrices,
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
                      {menu
                        .filter((m) => m.kind === 'single')
                        .map((m) => {
                          const ev = o.eventId || activeEventId
                          const q = findLineQty(editLines, m.id)
                          return (
                            <div key={m.id} className={`pos-item ${q ? 'is-on' : ''}`}>
                              {q > 0 && (
                                <button
                                  type="button"
                                  className="pos-item__minus"
                                  onClick={() =>
                                    setEditLines(
                                      upsertLineQty(editLines, m, q - 1, ev, eventPrices),
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
                                    upsertLineQty(editLines, m, q + 1, ev, eventPrices),
                                  )
                                }
                              >
                                <span className="pos-item__name">{m.name}</span>
                                <span className="pos-item__price">
                                  <Money value={resolveMenuPrice(m, ev, eventPrices)} />
                                </span>
                                {q > 0 ? (
                                  <span className="pos-item__qty">{q}</span>
                                ) : (
                                  <span className="pos-item__hint">Tap</span>
                                )}
                              </button>
                            </div>
                          )
                        })}
                    </div>
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
                    <span className="badge warn">Pending</span>
                  </div>
                  {o.eventId && (
                    <div className="hint-inline" style={{ marginBottom: 4 }}>
                      Event {o.eventId}
                    </div>
                  )}
                  <ul className="order-lines">
                    {o.lines.map((l) => (
                      <li key={lineKey(l.menuItemId, l.drink)}>
                        {l.qty}× {l.name}{' '}
                        <span className="hint-inline">
                          <Money value={l.price * l.qty} />
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="order-total-bar" style={{ marginTop: '0.65rem' }}>
                    <strong>
                      <Money value={orderTotal(o.lines)} />
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
                      <button type="button" className="btn" onClick={() => openPay(o)}>
                        <Check size={14} /> Delivered
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => deleteOrder(o.id)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </MotionCard>
          ))}
        </div>
      )}

      {tab === 'completed' && (
        <>
          {!isStall && (
          <div style={{ marginBottom: '0.9rem' }}>
          <MotionCard interactive={false}>
            <div className="card-head">
              <h2>Items sold</h2>
              <span className="badge ok">
                Revenue <Money value={soldRevenue} />
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
                      <td colSpan={3}>No completed orders yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </MotionCard>
          </div>
          )}

          <div className="order-list">
            {completed.map((o) => (
              <MotionCard key={o.id} interactive={false} className="order-card">
                <div className="card-head">
                  <h2>{o.label}</h2>
                  <span className="badge ok">Completed</span>
                </div>
                <ul className="order-lines">
                  {o.lines.map((l) => (
                    <li key={lineKey(l.menuItemId, l.drink)}>
                      {l.qty}× {l.name}
                      {!isStall && (
                        <span className="hint-inline">
                          {' '}
                          <Money value={l.price * l.qty} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="order-total-bar">
                  <div>
                    {!isStall && (
                      <div>
                        Total <Money value={orderTotal(o.lines)} />
                      </div>
                    )}
                    {!isStall && o.paid != null && (
                      <div className="hint-inline">
                        Paid <Money value={o.paid} />
                        {o.change != null && o.change > 0 ? (
                          <> · Return <Money value={o.change} /></>
                        ) : o.change === 0 ? (
                          <> · Exact</>
                        ) : null}
                      </div>
                    )}
                    {isStall && <div className="hint-inline">Ticket done</div>}
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
                    {o.label} — {o.voidReason || 'void'}
                  </li>
                ))}
              </ul>
            </MotionCard>
          )}
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

      {payOrder && (
        <div
          className="pay-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-title"
          onClick={() => setPayOrder(null)}
        >
          <div className="pay-panel" onClick={(e) => e.stopPropagation()}>
            <div className="card-head">
              <h2 id="pay-title">
                {payOrder.label} — {tr('payment')}
              </h2>
              <button type="button" className="btn ghost" onClick={() => setPayOrder(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="pay-total">
              <div className="kpi-label">{tr('orderTotal')}</div>
              <strong>
                <Money value={payTotal} />
              </strong>
            </div>
            <div className="field" style={{ marginTop: '0.85rem' }}>
              <label htmlFor="paid-amount">{tr('customerGave')} (€)</label>
              <input
                id="paid-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                autoFocus
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
            <div className="field" style={{ marginTop: '0.75rem' }}>
              <label htmlFor="tip-amount">{tr('tip')} (€)</label>
              <input
                id="tip-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={tipInput}
                onChange={(e) => setTipInput(e.target.value)}
              />
            </div>
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
              <button type="button" className="btn ghost" onClick={() => setPayOrder(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={!canConfirmPay}
                onClick={confirmPay}
              >
                {tr('confirmDelivery')}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'sales' && (
        <>
          <div className="split-mode-row" style={{ marginBottom: '0.75rem' }}>
            {(
              [
                ['today', 'Today'],
                ['event', 'This event'],
                ['all', 'All time'],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                className={`btn ghost ${salesScope === id ? 'is-on' : ''}`}
                onClick={() => setSalesScope(id)}
              >
                {text}
              </button>
            ))}
            {salesScope === 'event' && (
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
            )}
          </div>

          <div className="grid kpi" style={{ marginBottom: '0.9rem' }}>
            <MotionCard interactive={false}>
              <div className="kpi-label">Event / scope total</div>
              <div className="kpi-value">
                <Money value={sales.revenue} />
              </div>
              <div className="hint-inline">
                {sales.orderCount} tickets · {sales.itemCount} items sold
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
            Defaults apply everywhere. Set <strong>This event</strong> prices for the stall you are
            selling — each event can differ. Combos have two prices: with masala chai and with mango
            lassi.
          </p>

          <div className="field" style={{ marginTop: '0.75rem', maxWidth: 420 }}>
            <label htmlFor="price-event">Prices for event</label>
            <select
              id="price-event"
              value={priceEventId}
              onChange={(e) => setPriceEventId(e.target.value)}
            >
              <option value="">— pick stall —</option>
              {stallEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.id} · {e.location || e.name}
                </option>
              ))}
            </select>
          </div>

          {priceEventId && (
            <div className="filters" style={{ marginTop: '0.65rem', alignItems: 'flex-end' }}>
              <div className="field">
                <label htmlFor="copy-from-event">Copy prices from</label>
                <select
                  id="copy-from-event"
                  value={copyFromEventId}
                  onChange={(e) => setCopyFromEventId(e.target.value)}
                >
                  <option value="">— other event —</option>
                  {stallEvents
                    .filter((e) => e.id !== priceEventId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.id} · {e.location || e.name}
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="button"
                className="btn"
                disabled={!copyFromEventId}
                onClick={() => {
                  const ok = copyEventPrices(copyFromEventId, priceEventId)
                  if (!ok) {
                    window.alert(
                      'No saved overrides on that event — set prices there first, or they already match defaults.',
                    )
                  }
                }}
              >
                Copy to this event
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => clearEventPrices(priceEventId)}
              >
                Clear this event overrides
              </button>
            </div>
          )}

          <div className="combo-editor-list" style={{ marginTop: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Edit combo packs</h3>
            <p className="hint-inline" style={{ marginBottom: '0.75rem' }}>
              Change the name, what’s included, and food costs. Updates show on New order tiles.
            </p>
            {menu
              .filter((m) => m.kind === 'combo')
              .map((m) => {
                const items = parseComboContents(m.contents)
                const singles = menu.filter((x) => x.kind === 'single')
                return (
                  <div key={m.id} className="combo-editor">
                    <div className="combo-editor__head">
                      <div className="field" style={{ flex: 1 }}>
                        <label>Combo name</label>
                        <input
                          value={m.name}
                          onChange={(e) => updateMenuItem(m.id, { name: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label>Food cost €</label>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={m.foodCost ?? 0}
                          onChange={(e) =>
                            updateMenuItem(m.id, { foodCost: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Drink cost chai €</label>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={m.drinkCostChai ?? 0}
                          onChange={(e) =>
                            updateMenuItem(m.id, {
                              drinkCostChai: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Drink cost lassi €</label>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={m.drinkCostLassi ?? 0}
                          onChange={(e) =>
                            updateMenuItem(m.id, {
                              drinkCostLassi: Number(e.target.value) || 0,
                            })
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
                              updateMenuItem(m.id, {
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
                              updateMenuItem(m.id, {
                                contents: joinComboContents(next),
                              })
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                      {items.length === 0 && (
                        <li className="hint-inline">No items yet — add from the menu or type custom.</li>
                      )}
                    </ul>
                    <div className="filters" style={{ marginTop: '0.55rem' }}>
                      <div className="field">
                        <label>Add from menu</label>
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
                          updateMenuItem(m.id, {
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
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return
                            const custom = (comboAddCustom[m.id] || '').trim()
                            if (!custom) return
                            updateMenuItem(m.id, {
                              contents: joinComboContents([...items, custom]),
                            })
                            setComboAddCustom((p) => ({ ...p, [m.id]: '' }))
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={!(comboAddCustom[m.id] || '').trim()}
                        onClick={() => {
                          const custom = (comboAddCustom[m.id] || '').trim()
                          if (!custom) return
                          updateMenuItem(m.id, {
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
          </div>

          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Default</th>
                  <th>This event {priceEventId ? `(${priceEventId})` : ''}</th>
                </tr>
              </thead>
              <tbody>
                {menu.map((m) => {
                  const ov = priceEventId ? eventPrices[priceEventId]?.[m.id] : undefined
                  if (m.kind === 'combo') {
                    return (
                      <tr key={m.id}>
                        <td>
                          {m.name}
                          <div className="hint-inline">
                            {m.contents || 'Combo · chai / lassi'}
                          </div>
                        </td>
                        <td>
                          <div className="price-pair">
                            <label>
                              Chai
                              <input
                                className="input-tiny"
                                type="number"
                                min={0}
                                step={0.5}
                                value={m.priceWithChai ?? m.price}
                                onChange={(e) =>
                                  setComboDefaultPrices(
                                    m.id,
                                    Number(e.target.value) || 0,
                                    m.priceWithLassi ?? m.price,
                                  )
                                }
                              />
                            </label>
                            <label>
                              Lassi
                              <input
                                className="input-tiny"
                                type="number"
                                min={0}
                                step={0.5}
                                value={m.priceWithLassi ?? m.price}
                                onChange={(e) =>
                                  setComboDefaultPrices(
                                    m.id,
                                    m.priceWithChai ?? m.price,
                                    Number(e.target.value) || 0,
                                  )
                                }
                              />
                            </label>
                          </div>
                        </td>
                        <td>
                          {priceEventId ? (
                            <div className="price-pair">
                              <label>
                                Chai
                                <input
                                  className="input-tiny"
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  placeholder={String(m.priceWithChai ?? m.price)}
                                  value={
                                    ov?.priceWithChai != null
                                      ? ov.priceWithChai
                                      : resolveMenuPrice(m, priceEventId, eventPrices, 'chai')
                                  }
                                  onChange={(e) =>
                                    setEventPrice(priceEventId, m.id, {
                                      priceWithChai: Number(e.target.value) || 0,
                                      priceWithLassi:
                                        ov?.priceWithLassi ??
                                        m.priceWithLassi ??
                                        m.price,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Lassi
                                <input
                                  className="input-tiny"
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  placeholder={String(m.priceWithLassi ?? m.price)}
                                  value={
                                    ov?.priceWithLassi != null
                                      ? ov.priceWithLassi
                                      : resolveMenuPrice(m, priceEventId, eventPrices, 'lassi')
                                  }
                                  onChange={(e) =>
                                    setEventPrice(priceEventId, m.id, {
                                      priceWithChai:
                                        ov?.priceWithChai ?? m.priceWithChai ?? m.price,
                                      priceWithLassi: Number(e.target.value) || 0,
                                    })
                                  }
                                />
                              </label>
                            </div>
                          ) : (
                            <span className="hint-inline">Pick an event</span>
                          )}
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>
                        <input
                          className="input-tiny"
                          type="number"
                          min={0}
                          step={0.5}
                          value={m.price}
                          onChange={(e) => setMenuPrice(m.id, Number(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        {priceEventId ? (
                          <input
                            className="input-tiny"
                            type="number"
                            min={0}
                            step={0.5}
                            value={resolveMenuPrice(m, priceEventId, eventPrices)}
                            onChange={(e) =>
                              setEventPrice(priceEventId, m.id, {
                                price: Number(e.target.value) || 0,
                              })
                            }
                          />
                        ) : (
                          <span className="hint-inline">Pick an event</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="filters" style={{ marginTop: '0.85rem' }}>
            <div className="field">
              <label>New single item</label>
              <input
                value={newMenuName}
                onChange={(e) => setNewMenuName(e.target.value)}
                placeholder="e.g. Onion dosa"
              />
            </div>
            <div className="field">
              <label>Default price €</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={newMenuPrice}
                onChange={(e) => setNewMenuPrice(Number(e.target.value) || 0)}
              />
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                addMenuItem(newMenuName, newMenuPrice)
                setNewMenuName('')
              }}
            >
              Add menu item
            </button>
          </div>
        </MotionCard>
      )}
    </>
  )
}
