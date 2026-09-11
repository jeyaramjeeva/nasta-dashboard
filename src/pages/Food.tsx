import { ChefHat, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MotionCard } from '../components/MotionCard'
import { useData } from '../context/DataContext'
import { useExtras } from '../context/ExtrasContext'
import { useStallOps } from '../context/StallOpsContext'
import { eventCalendarDays } from '../lib/calendar'
import { FOOD_PREP_CORE } from '../lib/extrasStore'
import { germanyTodayYmd } from '../lib/germanyTime'
import { listEventTypes, priceKeyForEvent } from '../lib/stallOps'

export function Food() {
  const { snapshot } = useData()
  const {
    inventoryDefs,
    addDish,
    updateDish,
    removeDish,
    ensureFoodPrep,
  } = useExtras()
  const {
    customEventTypes,
    foodMade,
    setFoodMadeQty,
    clearFoodMadeItem,
    syncing,
  } = useStallOps()

  const stallEvents = useMemo(
    () =>
      [...(snapshot?.events || [])]
        .filter((e) => e.id.trim().toLowerCase() !== 'setup')
        .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')),
    [snapshot],
  )
  const eventTypes = useMemo(
    () => listEventTypes(stallEvents, customEventTypes),
    [stallEvents, customEventTypes],
  )

  const [eventId, setEventId] = useState('')
  const [day, setDay] = useState('')
  const [planType, setPlanType] = useState('')
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('batch')

  useEffect(() => {
    ensureFoodPrep()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (eventId || !stallEvents.length) return
    const upcoming = stallEvents.find((e) => (e.status || '').toLowerCase() !== 'completed')
    setEventId((upcoming || stallEvents[0])!.id)
  }, [eventId, stallEvents])

  const selectedEvent = stallEvents.find((e) => e.id === eventId)
  const eventDays = useMemo(
    () => (selectedEvent ? eventCalendarDays(selectedEvent) : []),
    [selectedEvent],
  )

  useEffect(() => {
    if (!eventDays.length) {
      setDay('')
      return
    }
    if (day && eventDays.includes(day)) return
    const today = germanyTodayYmd()
    setDay(eventDays.includes(today) ? today : eventDays[0]!)
  }, [eventDays, day])

  const priceKey = useMemo(
    () => priceKeyForEvent(eventId, stallEvents, eventTypes),
    [eventId, stallEvents, eventTypes],
  )

  /** Prep catalog: core food items first, then any custom prep dishes. */
  const catalog = useMemo(() => {
    const coreIds = new Set(FOOD_PREP_CORE.map((d) => d.id))
    const core = FOOD_PREP_CORE.map((c) => inventoryDefs.find((d) => d.id === c.id) || c)
    const extras = inventoryDefs.filter((d) => !coreIds.has(d.id))
    return [...core, ...extras]
  }, [inventoryDefs])

  const dayLog = foodMade[eventId]?.[day] || {}

  const rows = useMemo(() => {
    return catalog.map((c) => {
      const log = dayLog[c.id]
      const made = log?.made ?? 0
      const used = log?.used ?? 0
      const remaining = Math.round((made - used) * 100) / 100
      return {
        id: c.id,
        name: c.name,
        unit: c.unit || 'batch',
        made,
        used,
        remaining,
      }
    })
  }, [catalog, dayLog])

  const planStats = useMemo(() => {
    const type = planType || priceKey || ''
    if (!type) {
      return [] as {
        id: string
        name: string
        unit: string
        avgMade: number
        avgUsed: number
        samples: number
      }[]
    }
    const typeEvents = stallEvents.filter(
      (e) => priceKeyForEvent(e.id, stallEvents, eventTypes) === type,
    )
    const buckets = new Map<
      string,
      { name: string; unit: string; made: number[]; used: number[] }
    >()

    for (const ev of typeEvents) {
      for (const d of eventCalendarDays(ev)) {
        const madeMap = foodMade[ev.id]?.[d] || {}
        for (const item of catalog) {
          const row = madeMap[item.id]
          const made = row?.made ?? 0
          const used = row?.used ?? 0
          if (made <= 0 && used <= 0) continue
          const cur = buckets.get(item.id) || {
            name: item.name,
            unit: item.unit,
            made: [],
            used: [],
          }
          cur.name = row?.name || item.name
          cur.unit = row?.unit || item.unit
          cur.made.push(made)
          cur.used.push(used)
          buckets.set(item.id, cur)
        }
      }
    }

    return [...buckets.entries()]
      .map(([id, b]) => {
        const samples = b.made.length
        const avgMade =
          samples > 0
            ? Math.round((b.made.reduce((s, n) => s + n, 0) / samples) * 10) / 10
            : 0
        const avgUsed =
          samples > 0
            ? Math.round((b.used.reduce((s, n) => s + n, 0) / samples) * 10) / 10
            : 0
        return { id, name: b.name, unit: b.unit, avgMade, avgUsed, samples }
      })
      .sort((a, b) => b.avgMade - a.avgMade)
  }, [planType, priceKey, stallEvents, eventTypes, foodMade, catalog])

  useEffect(() => {
    if (planType || !priceKey) return
    setPlanType(priceKey)
  }, [planType, priceKey])

  const dayLabel =
    eventDays.length && day
      ? `Day ${eventDays.indexOf(day) + 1} · ${day}`
      : day || '—'

  function patchDay(
    itemId: string,
    name: string,
    unit: string,
    patch: Partial<{ made: number; used: number }>,
  ) {
    if (!eventId || !day) return
    setFoodMadeQty(eventId, day, itemId, { ...patch, name, unit })
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <ChefHat size={22} style={{ verticalAlign: -3, marginRight: 8 }} />
            Food prep
          </h1>
          <p className="hint-inline">
            Track dosa / idli batter, sambar (litre), chutney, potato masala, chai and mango
            lassi — made, used, and remaining per event day. Everything is editable.
          </p>
          {syncing ? <p className="hint-inline">Syncing…</p> : null}
        </div>
        <div className="page-actions">
          <Link className="btn ghost" to="/stock">
            Warehouse →
          </Link>
          <Link className="btn ghost" to="/orders">
            Orders →
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: '0.9rem' }}>
        <MotionCard interactive={false}>
          <div className="card-head">
            <h2>Made · used · remaining</h2>
            <span className="badge">{dayLabel}</span>
          </div>
          <div
            style={{
              display: 'grid',
              gap: '0.65rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
              marginTop: '0.55rem',
            }}
          >
            <label className="pos-toolbar__event" style={{ margin: 0, flex: 'none' }}>
              <span>Event</span>
              <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">— pick event —</option>
                {stallEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.id} · {e.location || e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="pos-toolbar__event" style={{ margin: 0, flex: 'none' }}>
              <span>Day</span>
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                disabled={!eventDays.length}
              >
                {!eventDays.length && <option value="">No days</option>}
                {eventDays.map((d, i) => (
                  <option key={d} value={d}>
                    Day {i + 1} · {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint-inline" style={{ marginTop: 8 }}>
            Edit name, unit, made and used. Remaining = Made − Used.
          </p>

          <div className="table-wrap" style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
            <table className="stock-table stock-table--food">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Unit</th>
                  <th>Made</th>
                  <th>Used</th>
                  <th>Remaining</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <input
                        className="input-tiny"
                        style={{ width: '100%', minWidth: 130, fontWeight: 650 }}
                        value={r.name}
                        onChange={(e) => {
                          const name = e.target.value
                          updateDish(r.id, { name })
                          if (eventId && day) {
                            setFoodMadeQty(eventId, day, r.id, { name, unit: r.unit })
                          }
                        }}
                        aria-label={`Name ${r.id}`}
                      />
                    </td>
                    <td>
                      <input
                        className="input-tiny"
                        style={{ width: 80 }}
                        value={r.unit}
                        onChange={(e) => {
                          const unit = e.target.value
                          updateDish(r.id, { unit })
                          if (eventId && day) {
                            setFoodMadeQty(eventId, day, r.id, { name: r.name, unit })
                          }
                        }}
                        aria-label={`Unit ${r.name}`}
                      />
                    </td>
                    <td>
                      <input
                        className="input-tiny"
                        type="number"
                        min={0}
                        step={0.5}
                        value={r.made}
                        disabled={!eventId || !day}
                        onChange={(e) =>
                          patchDay(r.id, r.name, r.unit, {
                            made: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="input-tiny"
                        type="number"
                        min={0}
                        step={0.5}
                        value={r.used}
                        disabled={!eventId || !day}
                        onChange={(e) =>
                          patchDay(r.id, r.name, r.unit, {
                            used: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </td>
                    <td>
                      <strong className={r.remaining < 0 ? 'neg' : undefined}>
                        {r.remaining}
                      </strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn ghost"
                        title="Remove item"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Remove “${r.name}” from Food prep? Day logs for this item are cleared.`,
                            )
                          ) {
                            return
                          }
                          clearFoodMadeItem(r.id)
                          removeDish(r.id)
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6}>No prep items — add one below.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="filters" style={{ marginTop: '0.85rem', alignItems: 'flex-end' }}>
            <div className="field">
              <label htmlFor="food-new">Add prep item</label>
              <input
                id="food-new"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Coconut chutney"
              />
            </div>
            <div className="field">
              <label htmlFor="food-unit">Unit</label>
              <input
                id="food-unit"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                style={{ width: 90 }}
                placeholder="batch / litre / bowl"
              />
            </div>
            <button
              type="button"
              className="btn"
              disabled={!newName.trim()}
              onClick={() => {
                addDish(newName.trim(), newUnit.trim() || 'batch', 0)
                setNewName('')
              }}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </MotionCard>
      </div>

      <MotionCard interactive={false}>
        <div className="card-head">
          <h2>Plan by event type</h2>
          <select value={planType} onChange={(e) => setPlanType(e.target.value)}>
            <option value="">— type —</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <p className="hint-inline">
          Average made / used from past stalls of this type — use it to decide how much batter,
          sambar and chai to prep next time.
        </p>
        <div className="table-wrap" style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Avg made / day</th>
                <th>Avg used / day</th>
                <th>Days logged</th>
              </tr>
            </thead>
            <tbody>
              {planStats.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    <div className="hint-inline">{p.unit}</div>
                  </td>
                  <td>{p.avgMade}</td>
                  <td>{p.avgUsed}</td>
                  <td>{p.samples}</td>
                </tr>
              ))}
              {planStats.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    No prep history for this type yet. Enter Made / Used on event days to build
                    averages.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </MotionCard>
    </>
  )
}
