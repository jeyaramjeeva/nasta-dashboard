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
import { orderTotal, useStallOps } from '../context/StallOpsContext'
import { germanyTodayYmd } from '../lib/germanyTime'
import { summarizePosCashToday } from '../lib/posCash'
import { buildSalesReport } from '../lib/salesStats'
import { soldCounts, type OrderLine, type StallOrder } from '../lib/stallOps'

type Tab = 'new' | 'pending' | 'completed' | 'sales' | 'menu'
type SalesScope = 'today' | 'event' | 'all'

export function Orders() {
  const { snapshot } = useData()
  const {
    menu,
    orders,
    activeEventId,
    nextCustomer,
    createOrder,
    updatePendingOrder,
    completeOrder,
    reopenOrder,
    deleteOrder,
    setMenuPrice,
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

  const cartLines: OrderLine[] = menu
    .map((m) => ({
      menuItemId: m.id,
      name: m.name,
      price: m.price,
      qty: cart[m.id] || 0,
    }))
    .filter((l) => l.qty > 0)

  const cartTotal = orderTotal(cartLines)

  function setQty(id: string, qty: number) {
    setCart((c) => {
      const next = { ...c }
      if (qty <= 0) delete next[id]
      else next[id] = qty
      return next
    })
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
          <span className="badge ok" title="Paid − change returned today">
            Cash in box today <Money value={posCash.netIn} />
          </span>
          <Link className="btn ghost" to="/cash">
            Cash box →
          </Link>
          <Link className="btn ghost" to="/stock">
            Stock →
          </Link>
        </div>
      </div>

      <div className="split-mode-row" style={{ marginBottom: '0.85rem' }}>
        {(
          [
            ['new', 'New order'],
            ['pending', `Pending (${pending.length})`],
            ['completed', `Sold (${completed.length})`],
            ['sales', 'Sales'],
            ['menu', 'Menu prices'],
          ] as const
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
            <span className="hint-inline">Resets to Customer 1 each new day (Germany time)</span>
          </div>

          <div className="order-menu-grid">
            {menu.map((m) => {
              const q = cart[m.id] || 0
              return (
                <div key={m.id} className={`order-menu-tile ${q ? 'is-on' : ''}`}>
                  <div className="order-menu-tile__name">{m.name}</div>
                  <div className="order-menu-tile__price">
                    <Money value={m.price} />
                  </div>
                  <div className="order-menu-tile__qty">
                    <button type="button" className="btn ghost" onClick={() => setQty(m.id, q - 1)}>
                      −
                    </button>
                    <strong>{q}</strong>
                    <button type="button" className="btn ghost" onClick={() => setQty(m.id, q + 1)}>
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
                      const line = editLines.find((l) => l.menuItemId === m.id)
                      const q = line?.qty || 0
                      return (
                        <div key={m.id} className={`order-menu-tile ${q ? 'is-on' : ''}`}>
                          <div className="order-menu-tile__name">{m.name}</div>
                          <div className="order-menu-tile__qty">
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() => {
                                const next = editLines.filter((l) => l.menuItemId !== m.id)
                                if (q - 1 > 0) {
                                  next.push({
                                    menuItemId: m.id,
                                    name: m.name,
                                    price: m.price,
                                    qty: q - 1,
                                  })
                                }
                                setEditLines(next)
                              }}
                            >
                              −
                            </button>
                            <strong>{q}</strong>
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() => {
                                const next = editLines.filter((l) => l.menuItemId !== m.id)
                                next.push({
                                  menuItemId: m.id,
                                  name: m.name,
                                  price: m.price,
                                  qty: q + 1,
                                })
                                setEditLines(next)
                              }}
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
                      <li key={l.menuItemId}>
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

          <div className="order-list">
            {completed.map((o) => (
              <MotionCard key={o.id} interactive={false} className="order-card">
                <div className="card-head">
                  <h2>{o.label}</h2>
                  <span className="badge ok">Completed</span>
                </div>
                <ul className="order-lines">
                  {o.lines.map((l) => (
                    <li key={l.menuItemId}>
                      {l.qty}× {l.name}
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
          <div className="table-wrap" style={{ marginTop: '0.65rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>€</th>
                </tr>
              </thead>
              <tbody>
                {menu.map((m) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="filters" style={{ marginTop: '0.85rem' }}>
            <div className="field">
              <label>New item</label>
              <input
                value={newMenuName}
                onChange={(e) => setNewMenuName(e.target.value)}
                placeholder="e.g. Onion dosa"
              />
            </div>
            <div className="field">
              <label>Price €</label>
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
