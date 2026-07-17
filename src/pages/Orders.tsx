import {
  Check,
  ClipboardList,
  Pencil,
  Plus,
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
import { useStallMode } from '../context/StallModeContext'
import { orderTotal, useStallOps } from '../context/StallOpsContext'
import { germanyTodayYmd } from '../lib/germanyTime'
import { summarizePosCashToday } from '../lib/posCash'
import { buildSalesReport } from '../lib/salesStats'
import {
  drinkLabel,
  lineKey,
  makeOrderLine,
  resolveMenuPrice,
  soldCounts,
  type DrinkChoice,
  type EventPriceOverride,
  type MenuItem,
  type OrderLine,
  type StallOrder,
} from '../lib/stallOps'

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
  const { isStall, enterStall } = useStallMode()
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
    setMenuPrice,
    setComboDefaultPrices,
    setEventPrice,
    clearEventPrices,
    addMenuItem,
    setActiveEventId,
  } = useStallOps()

  const [tab, setTab] = useState<Tab>('new')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [editId, setEditId] = useState<string | null>(null)
  const [editLines, setEditLines] = useState<OrderLine[]>([])
  const [newMenuName, setNewMenuName] = useState('')
  const [newMenuPrice, setNewMenuPrice] = useState(5)
  const [payOrder, setPayOrder] = useState<StallOrder | null>(null)
  const [paidInput, setPaidInput] = useState('')
  const [salesScope, setSalesScope] = useState<SalesScope>('today')
  const [salesEventId, setSalesEventId] = useState('')
  const [priceEventId, setPriceEventId] = useState('')

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
    () => orders.filter((o) => o.status === 'completed'),
    [orders],
  )
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

  function setQty(item: MenuItem, qty: number, drink?: DrinkChoice) {
    const key = lineKey(item.id, item.kind === 'combo' ? drink : undefined)
    setCart((c) => {
      const next = { ...c }
      if (qty <= 0) delete next[key]
      else next[key] = qty
      return next
    })
  }

  function cartQty(item: MenuItem, drink?: DrinkChoice): number {
    return cart[lineKey(item.id, item.kind === 'combo' ? drink : undefined)] || 0
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

  const payTotal = payOrder ? orderTotal(payOrder.lines) : 0
  const paidNum = Number(paidInput.replace(',', '.'))
  const paidValid = Number.isFinite(paidNum) && paidNum >= 0
  const changeDue = paidValid ? Math.round((paidNum - payTotal) * 100) / 100 : null
  const canConfirmPay = paidValid && paidNum + 1e-9 >= payTotal

  function openPay(o: StallOrder) {
    setPayOrder(o)
    setPaidInput(String(orderTotal(o.lines)))
  }

  function confirmPay() {
    if (!payOrder || !canConfirmPay) return
    completeOrder(payOrder.id, paidNum)
    setPayOrder(null)
    setPaidInput('')
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
          <p>
            Tickets auto-number Customer 1, 2, 3… and reset each day. Add items → Pending → Delivered.
          </p>
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
              <button type="button" className="btn ghost" onClick={enterStall}>
                Stall mode
              </button>
            </>
          )}
          <Link className="btn ghost" to="/stock">
            Stock →
          </Link>
        </div>
      </div>

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
        <MotionCard interactive={false} className="upload-panel">
          <div className="field" style={{ marginBottom: '0.65rem' }}>
            <label htmlFor="active-event">Selling for event</label>
            <select
              id="active-event"
              value={activeEventId}
              onChange={(e) => setActiveEventId(e.target.value)}
            >
              <option value="">— pick stall —</option>
              {stallEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.id} · {e.location || e.name} · {e.status}
                </option>
              ))}
            </select>
            <div className="hint-inline" style={{ marginTop: 4 }}>
              New tickets are counted under this event for sales totals.
            </div>
          </div>
          <div className="chip-row" style={{ marginBottom: '0.35rem' }}>
            <span className="badge ok">Next ticket: Customer {nextCustomer}</span>
            <span className="hint-inline">
              Prices for this event — set under Menu prices. Combos: pick chai or lassi.
            </span>
          </div>

          <div className="order-menu-grid">
            {menu.map((m) => {
              if (m.kind === 'combo') {
                const qChai = cartQty(m, 'chai')
                const qLassi = cartQty(m, 'lassi')
                const on = qChai + qLassi > 0
                const pChai = resolveMenuPrice(m, activeEventId, eventPrices, 'chai')
                const pLassi = resolveMenuPrice(m, activeEventId, eventPrices, 'lassi')
                return (
                  <div key={m.id} className={`order-menu-tile order-menu-tile--combo ${on ? 'is-on' : ''}`}>
                    <div className="order-menu-tile__name">{m.name}</div>
                    <div className="order-combo-drink">
                      <div className="order-combo-drink__meta">
                        <span>{drinkLabel('chai')}</span>
                        <strong>
                          <Money value={pChai} />
                        </strong>
                      </div>
                      <div className="order-menu-tile__qty">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setQty(m, qChai - 1, 'chai')}
                        >
                          −
                        </button>
                        <strong>{qChai}</strong>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setQty(m, qChai + 1, 'chai')}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="order-combo-drink">
                      <div className="order-combo-drink__meta">
                        <span>{drinkLabel('lassi')}</span>
                        <strong>
                          <Money value={pLassi} />
                        </strong>
                      </div>
                      <div className="order-menu-tile__qty">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setQty(m, qLassi - 1, 'lassi')}
                        >
                          −
                        </button>
                        <strong>{qLassi}</strong>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setQty(m, qLassi + 1, 'lassi')}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }
              const q = cartQty(m)
              const price = resolveMenuPrice(m, activeEventId, eventPrices)
              return (
                <div key={m.id} className={`order-menu-tile ${q ? 'is-on' : ''}`}>
                  <div className="order-menu-tile__name">{m.name}</div>
                  <div className="order-menu-tile__price">
                    <Money value={price} />
                  </div>
                  <div className="order-menu-tile__qty">
                    <button type="button" className="btn ghost" onClick={() => setQty(m, q - 1)}>
                      −
                    </button>
                    <strong>{q}</strong>
                    <button type="button" className="btn ghost" onClick={() => setQty(m, q + 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="order-total-bar">
            <div>
              <div className="kpi-label">Total</div>
              <strong style={{ fontSize: '1.4rem' }}>
                <Money value={cartTotal} />
              </strong>
            </div>
            <button
              type="button"
              className="btn"
              disabled={!cartLines.length}
              onClick={() => {
                createOrder(cartLines)
                setCart({})
                setTab('pending')
              }}
            >
              Add Customer {nextCustomer}
            </button>
          </div>
        </MotionCard>
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
                  <div className="order-menu-grid" style={{ marginTop: '0.65rem' }}>
                    {menu.map((m) => {
                      const ev = o.eventId || activeEventId
                      if (m.kind === 'combo') {
                        const qChai = findLineQty(editLines, m.id, 'chai')
                        const qLassi = findLineQty(editLines, m.id, 'lassi')
                        return (
                          <div
                            key={m.id}
                            className={`order-menu-tile order-menu-tile--combo ${
                              qChai + qLassi ? 'is-on' : ''
                            }`}
                          >
                            <div className="order-menu-tile__name">{m.name}</div>
                            {(['chai', 'lassi'] as DrinkChoice[]).map((drink) => {
                              const q = drink === 'chai' ? qChai : qLassi
                              return (
                                <div key={drink} className="order-combo-drink">
                                  <div className="order-combo-drink__meta">
                                    <span>{drinkLabel(drink)}</span>
                                    <strong>
                                      <Money
                                        value={resolveMenuPrice(m, ev, eventPrices, drink)}
                                      />
                                    </strong>
                                  </div>
                                  <div className="order-menu-tile__qty">
                                    <button
                                      type="button"
                                      className="btn ghost"
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
                                      −
                                    </button>
                                    <strong>{q}</strong>
                                    <button
                                      type="button"
                                      className="btn ghost"
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
                                      +
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      }
                      const q = findLineQty(editLines, m.id)
                      return (
                        <div key={m.id} className={`order-menu-tile ${q ? 'is-on' : ''}`}>
                          <div className="order-menu-tile__name">{m.name}</div>
                          <div className="order-menu-tile__price">
                            <Money value={resolveMenuPrice(m, ev, eventPrices)} />
                          </div>
                          <div className="order-menu-tile__qty">
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() =>
                                setEditLines(
                                  upsertLineQty(editLines, m, q - 1, ev, eventPrices),
                                )
                              }
                            >
                              −
                            </button>
                            <strong>{q}</strong>
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() =>
                                setEditLines(
                                  upsertLineQty(editLines, m, q + 1, ev, eventPrices),
                                )
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )
                    })}
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
                    <h2>{o.label}</h2>
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
                  <button type="button" className="btn ghost" onClick={() => reopenOrder(o.id)}>
                    <RotateCcw size={14} /> Back to pending
                  </button>
                </div>
              </MotionCard>
            ))}
          </div>
        </>
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
              <h2 id="pay-title">{payOrder.label} — payment</h2>
              <button type="button" className="btn ghost" onClick={() => setPayOrder(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="pay-total">
              <div className="kpi-label">Order total</div>
              <strong>
                <Money value={payTotal} />
              </strong>
            </div>
            <div className="field" style={{ marginTop: '0.85rem' }}>
              <label htmlFor="paid-amount">Customer gave (€)</label>
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
            <div
              className={`pay-change ${changeDue != null && changeDue < 0 ? 'is-short' : ''}`}
            >
              {changeDue == null ? (
                <span className="hint-inline">Enter amount received</span>
              ) : changeDue < 0 ? (
                <>
                  Still need <strong><Money value={-changeDue} /></strong>
                </>
              ) : changeDue === 0 ? (
                <>
                  Exact — <strong>no change</strong>
                </>
              ) : (
                <>
                  Return <strong className="pay-change__amount"><Money value={changeDue} /></strong>
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
                Confirm delivery
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
            <div className="page-actions" style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => clearEventPrices(priceEventId)}
              >
                Clear event overrides (use defaults)
              </button>
            </div>
          )}

          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
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
                          <div className="hint-inline">Combo · chai / lassi</div>
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
