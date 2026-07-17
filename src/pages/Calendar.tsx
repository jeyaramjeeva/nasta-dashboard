import { CloudRain, CloudSun, Package, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Money } from '../components/Money'
import { MotionCard } from '../components/MotionCard'
import { EmptyState, SkeletonPage } from '../components/Skeleton'
import { useData } from '../context/DataContext'
import {
  buildCalendarCards,
  formatDaySpan,
  marksForMonth,
  monthGrid,
} from '../lib/calendar'
import { germanyMonthLabel, germanyParts } from '../lib/germanyTime'
import {
  WEATHER_OPTIONS,
  addInventoryDish,
  loadEventInventory,
  loadInventoryDefs,
  loadWeather,
  setEventInventory,
  setEventWeather,
  updateInventoryUnitCost,
  type InventoryItemDef,
  type InventoryLine,
  type WeatherTag,
} from '../lib/extrasStore'

const PREP_BADGE: Record<string, string> = {
  ready: 'ok',
  partial: 'warn',
  missing: 'warn',
  done: 'ok',
}

type ListFilter = 'all' | 'completed' | 'upcoming'

export function CalendarPage() {
  const { metrics, snapshot, loading } = useData()
  const berlinNow = germanyParts()
  const [year, setYear] = useState(berlinNow.year)
  const [month, setMonth] = useState(berlinNow.month)
  const [weather, setWeatherState] = useState(loadWeather)
  const [invTick, setInvTick] = useState(0)
  const [invEvent, setInvEvent] = useState('')
  const [defs, setDefs] = useState<InventoryItemDef[]>(() => loadInventoryDefs())
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [newDish, setNewDish] = useState('')
  const [newUnit, setNewUnit] = useState('portion')
  const [newCost, setNewCost] = useState(0)

  const cards = useMemo(() => {
    if (!metrics || !snapshot) return []
    void invTick
    return buildCalendarCards(snapshot, metrics, weather)
  }, [metrics, snapshot, weather, invTick])

  const cells = useMemo(() => monthGrid(year, month), [year, month])
  const byDay = useMemo(() => marksForMonth(cards, year, month), [cards, year, month])

  const filteredCards = useMemo(() => {
    if (listFilter === 'completed') return cards.filter((c) => c.event.status === 'Completed')
    if (listFilter === 'upcoming') return cards.filter((c) => c.event.status !== 'Completed')
    return cards
  }, [cards, listFilter])

  const monthLabel = germanyMonthLabel(year, month)
  const todayParts = germanyParts()

  const eventInv = loadEventInventory()
  const activeInvId = invEvent || cards[0]?.event.id || ''
  const activeCard = cards.find((c) => c.event.id === activeInvId) || null
  const activeLines = eventInv[activeInvId] || []

  function changeWeather(eventId: string, tag: WeatherTag) {
    setEventWeather(eventId, tag)
    setWeatherState(loadWeather())
  }

  function syncLines(nextDefs: InventoryItemDef[], mutate: (lines: InventoryLine[]) => InventoryLine[]) {
    if (!activeInvId) return
    const base = nextDefs.map((d) => {
      const existing = activeLines.find((l) => l.itemId === d.id)
      return { itemId: d.id, qty: existing?.qty || 0 }
    })
    setEventInventory(activeInvId, mutate(base))
    setInvTick((t) => t + 1)
  }

  function setQty(itemId: string, qty: number) {
    syncLines(defs, (lines) =>
      lines.map((l) => (l.itemId === itemId ? { ...l, qty } : l)),
    )
  }

  function setUnitCost(itemId: string, unitCost: number) {
    const next = updateInventoryUnitCost(itemId, unitCost)
    setDefs(next)
    setInvTick((t) => t + 1)
  }

  function addDish() {
    const next = addInventoryDish(newDish, newUnit, newCost)
    setDefs(next)
    setNewDish('')
    setNewUnit('portion')
    setNewCost(0)
    setInvTick((t) => t + 1)
  }

  if (loading) return <SkeletonPage />
  if (!metrics || !snapshot) {
    return <EmptyState title="No calendar yet" body="Upload Excel to see upcoming stalls." />
  }

  function shiftMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) {
      m = 12
      y -= 1
    }
    if (m > 12) {
      m = 1
      y += 1
    }
    setMonth(m)
    setYear(y)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calendar</h1>
          <p>
            Multi-day stalls show every day (Day 1/3 …). Track weather, inventory, spend &amp; gain.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn ghost" type="button" onClick={() => shiftMonth(-1)}>
            ←
          </button>
          <span className="badge">{monthLabel}</span>
          <button className="btn ghost" type="button" onClick={() => shiftMonth(1)}>
            →
          </button>
        </div>
      </div>

      <MotionCard interactive={false} className="cal-card">
        <p className="hint-inline" style={{ marginBottom: '0.65rem' }}>
          Multi-day events (3–4 days) are marked on <strong>every</strong> stall day — not only the
          start. Labels show Day 1/3, Day 2/3, …
        </p>
        <div className="cal-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((day, i) => {
            const dayMarks = day ? byDay.get(day) || [] : []
            const isToday =
              day === todayParts.day &&
              month === todayParts.month &&
              year === todayParts.year
            return (
              <div
                key={i}
                className={`cal-cell ${day ? '' : 'is-empty'} ${isToday ? 'is-today' : ''}`}
              >
                {day != null && <div className="cal-daynum">{day}</div>}
                {dayMarks.map((m) => (
                  <div
                    key={`${m.card.event.id}-${m.dayIndex}`}
                    className={`cal-pill prep-${m.card.prep} role-${m.role} ${m.totalDays > 1 ? 'is-multi' : ''}`}
                    title={`${m.card.event.location} · ${formatDaySpan(m.totalDays, m.card.event.startDate, m.card.event.endDate)}`}
                  >
                    <strong>
                      {m.card.event.id}
                      {m.totalDays > 1 ? ` · D${m.dayIndex}/${m.totalDays}` : ''}
                    </strong>
                    <span>{m.card.event.location.slice(0, 12)}</span>
                    {m.totalDays > 1 && (
                      <span className="cal-pill-role">
                        {m.role === 'start'
                          ? 'Start'
                          : m.role === 'end'
                            ? 'End'
                            : `Day ${m.dayIndex}`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </MotionCard>

      <div style={{ marginTop: '0.9rem' }}>
        <MotionCard interactive={false}>
          <div className="card-head">
            <h2>Stall list — spend &amp; gain</h2>
            <div className="split-mode-row" style={{ margin: 0 }}>
              {(
                [
                  ['all', 'All'],
                  ['completed', 'Completed'],
                  ['upcoming', 'Upcoming'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn ghost ${listFilter === id ? 'is-on' : ''}`}
                  onClick={() => setListFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="table-wrap table-wrap--fit" style={{ marginTop: '0.75rem' }}>
            <table className="table-fit">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Days</th>
                  <th>Prep</th>
                  <th>Spend</th>
                  <th>Gain</th>
                  <th>Net</th>
                  <th>Weather</th>
                </tr>
              </thead>
              <tbody>
                {filteredCards.map((c) => (
                  <tr key={c.event.id}>
                    <td className="cell-wrap">
                      <strong>{c.event.id}</strong>
                      <div className="hint-inline">
                        {c.event.location} · {c.event.status}
                      </div>
                      <div className="hint-inline">
                        {formatDaySpan(c.totalDays, c.event.startDate, c.event.endDate)}
                      </div>
                      <div className="hint-inline">{c.prepNotes.join(' · ')}</div>
                    </td>
                    <td>
                      <span className={`badge ${c.totalDays >= 3 ? 'warn' : ''}`}>
                        {c.totalDays}d
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${PREP_BADGE[c.prep]}`}>{c.prep}</span>
                    </td>
                    <td>
                      <Money value={c.spend} />
                      {c.inventoryCost > 0 && (
                        <div className="hint-inline">
                          incl. inv. <Money value={c.inventoryCost} />
                        </div>
                      )}
                    </td>
                    <td>
                      <Money value={c.gain} />
                      {c.event.status !== 'Completed' && (
                        <div className="hint-inline">expected</div>
                      )}
                    </td>
                    <td>
                      {c.net != null ? <Money value={c.net} colored signed /> : '—'}
                    </td>
                    <td>
                      <select
                        className="select-compact"
                        value={c.weather}
                        onChange={(e) =>
                          changeWeather(c.event.id, e.target.value as WeatherTag)
                        }
                      >
                        <option value="">—</option>
                        {WEATHER_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {filteredCards.length === 0 && (
                  <tr>
                    <td colSpan={7}>No events in this filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </MotionCard>
      </div>

      <div style={{ marginTop: '0.9rem' }}>
        <MotionCard interactive={false}>
          <div className="card-head">
            <h2>
              <Package size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
              Simple inventory
            </h2>
            <select value={activeInvId} onChange={(e) => setInvEvent(e.target.value)}>
              {cards.map((c) => (
                <option key={c.event.id} value={c.event.id}>
                  {c.event.id} · {c.event.status === 'Completed' ? 'done' : 'upcoming'}
                </option>
              ))}
            </select>
          </div>
          {activeCard && (
            <div className="grid three" style={{ margin: '0.65rem 0' }}>
              <div>
                <div className="kpi-label">
                  {activeCard.event.status === 'Completed' ? 'Spend' : 'Expected spend'}
                </div>
                <strong>
                  <Money value={activeCard.spend} />
                </strong>
              </div>
              <div>
                <div className="kpi-label">
                  {activeCard.event.status === 'Completed' ? 'Gain' : 'Expected gain'}
                </div>
                <strong className="pos">
                  <Money value={activeCard.gain} />
                </strong>
              </div>
              <div>
                <div className="kpi-label">Net</div>
                <strong>
                  {activeCard.net != null ? (
                    <Money value={activeCard.net} colored signed />
                  ) : (
                    '—'
                  )}
                </strong>
              </div>
            </div>
          )}
          <p className="hint-inline">Edit qty and €/unit. Inventory cost rolls into spend.</p>
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Dish</th>
                  <th>Qty</th>
                  <th>€/unit</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {defs.map((d) => {
                  const qty = activeLines.find((l) => l.itemId === d.id)?.qty || 0
                  return (
                    <tr key={d.id}>
                      <td>
                        {d.name}
                        <div className="hint-inline">{d.unit}</div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={qty}
                          style={{ width: 72 }}
                          onChange={(e) => setQty(d.id, Number(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={d.unitCost}
                          style={{ width: 80 }}
                          onChange={(e) => setUnitCost(d.id, Number(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <Money value={d.unitCost * qty} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="filters" style={{ marginTop: '0.85rem', alignItems: 'flex-end' }}>
            <div>
              <div className="hint-inline">Add dish</div>
              <input
                placeholder="e.g. Vada"
                value={newDish}
                onChange={(e) => setNewDish(e.target.value)}
                style={{ minWidth: 120 }}
              />
            </div>
            <div>
              <div className="hint-inline">Unit</div>
              <input
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                style={{ width: 90 }}
              />
            </div>
            <div>
              <div className="hint-inline">€/unit</div>
              <input
                type="number"
                min={0}
                step={0.5}
                value={newCost}
                onChange={(e) => setNewCost(Number(e.target.value) || 0)}
                style={{ width: 80 }}
              />
            </div>
            <button className="btn" type="button" onClick={addDish} disabled={!newDish.trim()}>
              <Plus size={16} /> Add
            </button>
          </div>

          <div className="chip-row" style={{ marginTop: '0.75rem' }}>
            <span className="badge">
              <CloudSun size={14} /> Sunny / good weather
            </span>
            <span className="badge">
              <CloudRain size={14} /> Rainy &amp; windy on Insights
            </span>
          </div>
        </MotionCard>
      </div>
    </>
  )
}
