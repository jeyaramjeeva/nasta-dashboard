import { AlertTriangle, Minus, Package, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EditableText } from '../components/EditableText'
import { MotionCard } from '../components/MotionCard'
import { useData } from '../context/DataContext'
import { remainingOf, useStallOps } from '../context/StallOpsContext'
import { isLowStock } from '../lib/stallOps'
import { germanyTodayYmd } from '../lib/germanyTime'
import {
  convertKgToUnits,
  convertPortionsToUnits,
  convertUnitsToKg,
  convertUnitsToPortions,
  warehouseIdlePct,
} from '../lib/stallRecipes'
import { stockExpiryDays } from '../lib/stallOps'

export function Stock() {
  const { snapshot } = useData()
  const {
    stock,
    lowStock,
    buyStock,
    useStock,
    setStockLowAt,
    addStockItem,
    updateStockItem,
    removeStockItem,
    eventStock,
    setEventStockQty,
    menu,
    stockAutoUse,
    setStockAutoUse,
    syncing,
  } = useStallOps()
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('pcs')
  const [qtyDraft, setQtyDraft] = useState<Record<string, number>>({})
  const [eventId, setEventId] = useState('')
  const [converterItemId, setConverterItemId] = useState('')
  const [converterValue, setConverterValue] = useState(1)
  const [converterMode, setConverterMode] = useState<'kg-units' | 'portions-units'>('kg-units')

  const stallEvents = useMemo(
    () =>
      [...(snapshot?.events || [])]
        .filter((e) => e.id.trim().toLowerCase() !== 'setup')
        .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')),
    [snapshot],
  )

  const packed = eventId ? eventStock[eventId] || {} : {}
  const idlePct = warehouseIdlePct(stock)
  const converterItems = stock.filter((item) => item.kgPerUnit || item.portionPerUnit)
  const converterItem = converterItems.find((item) => item.id === converterItemId) || converterItems[0]

  function patchAutoUse(index: number, patch: Partial<(typeof stockAutoUse)[number]>) {
    setStockAutoUse(stockAutoUse.map((rule, i) => i === index ? { ...rule, ...patch } : rule))
  }

  const sorted = useMemo(
    () =>
      [...stock].sort((a, b) => {
        const al = isLowStock(a) ? 0 : 1
        const bl = isLowStock(b) ? 0 : 1
        if (al !== bl) return al - bl
        return a.name.localeCompare(b.name)
      }),
    [stock],
  )

  function qty(id: string) {
    return Math.max(1, qtyDraft[id] || 1)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <EditableText
            id="stock.pageTitle"
            as="h1"
            defaultText="Warehouse & event stock"
            icon={<Package size={22} style={{ verticalAlign: -3, marginRight: 8 }} />}
          />
          <EditableText
            id="stock.pageSub"
            as="p"
            defaultText="Everything is editable — name, unit, bought, used, alert. Pack qty per event so you know what to bring."
          />
          {syncing ? <p className="hint-inline">Syncing…</p> : null}
        </div>
        <div className="page-actions">
          <Link className="btn ghost" to="/food">
            Food prep →
          </Link>
          <Link className="btn ghost" to="/orders">
            <EditableText id="stock.ordersLink" as="span" defaultText="Orders →" />
          </Link>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="alert-item" style={{ marginBottom: '0.75rem' }}>
          <AlertTriangle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          <EditableText id="stock.lowStockLabel" as="span" defaultText="Low stock:" />{' '}
          {lowStock.map((s) => `${s.name} (${remainingOf(s)} ${s.unit})`).join(' · ')}
        </div>
      )}

      <div style={{ marginBottom: '0.9rem' }}>
        <MotionCard interactive={false}>
          <EditableText id="stock.packTitle" as="h2" defaultText="Pack for event" />
          <EditableText
            id="stock.packHint"
            as="p"
            className="hint-inline"
            defaultText="How much of the warehouse stock you plan to take to this event."
          />
          <div className="field" style={{ marginTop: '0.65rem', maxWidth: 420 }}>
            <label htmlFor="stock-event">
              <EditableText id="stock.eventLabel" as="span" defaultText="Event" />
            </label>
            <select
              id="stock-event"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              <option value="">— pick event —</option>
              {stallEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.id} · {e.location || e.name}
                </option>
              ))}
            </select>
          </div>
          {eventId && (
            <div className="table-wrap" style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
              <table className="stock-table stock-table--pack">
                <thead>
                  <tr>
                    <EditableText id="stock.packColItem" as="th" defaultText="Item" />
                    <EditableText id="stock.packColLeft" as="th" defaultText="Warehouse left" />
                    <EditableText id="stock.packColPacked" as="th" defaultText="Packed for event" />
                  </tr>
                </thead>
                <tbody>
                  {stock.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                        <div className="hint-inline">{s.unit}</div>
                      </td>
                      <td>{remainingOf(s)}</td>
                      <td>
                        <input
                          className="input-tiny"
                          type="number"
                          min={0}
                          value={packed[s.id] ?? 0}
                          onChange={(e) =>
                            setEventStockQty(eventId, s.id, Number(e.target.value) || 0)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </MotionCard>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))',
          gap: '0.9rem',
          marginBottom: '0.9rem',
        }}
      >
        <MotionCard interactive={false}>
          <h2>Warehouse idle / potential waste</h2>
          <p style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0.35rem 0' }}>
            {idlePct == null ? '—' : `${idlePct}%`}
          </p>
          <p className="hint-inline">Share of bought stock not yet marked used. It is an idle-stock signal, not confirmed spoilage.</p>
        </MotionCard>
        <MotionCard interactive={false}>
          <h2>Unit converter</h2>
          {converterItems.length ? (
            <>
              <select value={converterItem?.id || ''} onChange={(e) => setConverterItemId(e.target.value)}>
                {converterItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <div className="filters" style={{ marginTop: 8 }}>
                <select value={converterMode} onChange={(e) => setConverterMode(e.target.value as 'kg-units' | 'portions-units')}>
                  <option value="kg-units">kg ↔ units</option>
                  <option value="portions-units">portions ↔ units</option>
                </select>
                <input className="input-tiny" type="number" min={0} value={converterValue} onChange={(e) => setConverterValue(Number(e.target.value) || 0)} />
              </div>
              <p className="hint-inline">
                {converterMode === 'kg-units'
                  ? `${converterValue} kg = ${convertKgToUnits(converterValue, converterItem?.kgPerUnit || 0)} units; ${converterValue} units = ${convertUnitsToKg(converterValue, converterItem?.kgPerUnit || 0)} kg`
                  : `${converterValue} portions = ${convertPortionsToUnits(converterValue, converterItem?.portionPerUnit || 0)} units; ${converterValue} units = ${convertUnitsToPortions(converterValue, converterItem?.portionPerUnit || 0)} portions`}
              </p>
            </>
          ) : <p className="hint-inline">Set a conversion value in the warehouse table to use this widget.</p>}
        </MotionCard>
      </div>

      <MotionCard interactive={false}>
        <EditableText id="stock.warehouseTitle" as="h2" defaultText="Warehouse" />
        <div className="table-wrap" style={{ marginTop: '0.65rem', overflowX: 'auto' }}>
          <table className="stock-table stock-table--warehouse">
            <thead>
              <tr>
                <EditableText id="stock.colItem" as="th" defaultText="Item" />
                <EditableText id="stock.colUnit" as="th" defaultText="Unit" />
                <EditableText id="stock.colBought" as="th" defaultText="Bought" />
                <EditableText id="stock.colUsed" as="th" defaultText="Used" />
                <EditableText id="stock.colRemaining" as="th" defaultText="Remaining" />
                <th>Expires</th>
                <th>Conversion</th>
                <EditableText id="stock.colAlert" as="th" defaultText="Alert max" />
                <EditableText id="stock.colActions" as="th" defaultText="Actions" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const rem = remainingOf(s)
                const low = isLowStock(s)
                const expiryDays = stockExpiryDays(s.expiresOn, germanyTodayYmd())
                return (
                  <tr key={s.id} className={low ? 'stock-row--low' : undefined}>
                    <td className="cell-wrap">
                      <input
                        className="input-tiny"
                        style={{ width: '100%', minWidth: 110, fontWeight: 650 }}
                        value={s.name}
                        onChange={(e) => updateStockItem(s.id, { name: e.target.value })}
                        aria-label={`Name ${s.id}`}
                      />
                      {low && <span className="badge warn">Low</span>}
                    </td>
                    <td>
                      <input
                        className="input-tiny"
                        style={{ width: 72 }}
                        value={s.unit}
                        onChange={(e) => updateStockItem(s.id, { unit: e.target.value })}
                        aria-label={`Unit ${s.name}`}
                      />
                    </td>
                    <td>
                      <input
                        className="input-tiny"
                        type="number"
                        min={0}
                        step={1}
                        value={s.bought}
                        onChange={(e) =>
                          updateStockItem(s.id, { bought: Number(e.target.value) || 0 })
                        }
                        aria-label={`Bought ${s.name}`}
                      />
                    </td>
                    <td>
                      <input
                        className="input-tiny"
                        type="number"
                        min={0}
                        step={1}
                        value={s.used}
                        onChange={(e) =>
                          updateStockItem(s.id, { used: Number(e.target.value) || 0 })
                        }
                        aria-label={`Used ${s.name}`}
                      />
                    </td>
                    <td>
                      <strong>{rem}</strong>
                    </td>
                    <td>
                      <div className="stock-expires">
                        <input
                          className="input-tiny"
                          type="date"
                          value={s.expiresOn || ''}
                          onChange={(e) =>
                            updateStockItem(s.id, { expiresOn: e.target.value || undefined })
                          }
                          aria-label={`Expires ${s.name}`}
                        />
                        {expiryDays != null && (
                          <div
                            className={
                              expiryDays < 0 || expiryDays <= 3 ? 'badge warn' : 'hint-inline'
                            }
                          >
                            {expiryDays < 0
                              ? 'Expired'
                              : expiryDays <= 3
                                ? '≤3 days'
                                : `${expiryDays} days`}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="stock-conv">
                        <label className="stock-conv__row">
                          <span>kg / unit</span>
                          <input
                            className="input-tiny"
                            type="number"
                            min={0}
                            step={0.01}
                            value={s.kgPerUnit || ''}
                            onChange={(e) =>
                              updateStockItem(s.id, { kgPerUnit: Number(e.target.value) || 0 })
                            }
                            aria-label={`kg per unit ${s.name}`}
                          />
                        </label>
                        <label className="stock-conv__row">
                          <span>portions / unit</span>
                          <input
                            className="input-tiny"
                            type="number"
                            min={0}
                            step={0.01}
                            value={s.portionPerUnit || ''}
                            onChange={(e) =>
                              updateStockItem(s.id, {
                                portionPerUnit: Number(e.target.value) || 0,
                              })
                            }
                            aria-label={`portions per unit ${s.name}`}
                          />
                        </label>
                      </div>
                    </td>
                    <td>
                      <input
                        className="input-tiny"
                        type="number"
                        min={0}
                        value={s.lowAt}
                        onChange={(e) => setStockLowAt(s.id, Number(e.target.value) || 0)}
                        aria-label={`Alert max ${s.name}`}
                      />
                    </td>
                    <td>
                      <div className="stock-actions">
                        <input
                          className="input-tiny"
                          type="number"
                          min={1}
                          value={qty(s.id)}
                          onChange={(e) =>
                            setQtyDraft((d) => ({
                              ...d,
                              [s.id]: Math.max(1, Number(e.target.value) || 1),
                            }))
                          }
                          aria-label={`Qty ${s.name}`}
                        />
                        <button
                          type="button"
                          className="btn ghost"
                          title="Bought / restock"
                          onClick={() => buyStock(s.id, qty(s.id))}
                        >
                          <Plus size={14} /> Buy
                        </button>
                        <button
                          type="button"
                          className="btn"
                          title="Took for stall"
                          disabled={rem <= 0}
                          onClick={() => useStock(s.id, qty(s.id))}
                        >
                          <Minus size={14} /> Use
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          title="Remove item"
                          onClick={() => {
                            if (window.confirm(`Remove “${s.name}” from warehouse?`)) {
                              removeStockItem(s.id)
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </MotionCard>

      <div style={{ marginTop: '0.9rem' }}>
        <MotionCard interactive={false}>
          <div className="card-head">
            <div>
              <h2>Auto use mapping</h2>
              <p className="hint-inline">Completed sales automatically deduct these warehouse quantities.</p>
            </div>
            <button
              type="button"
              className="btn ghost"
              disabled={!menu.length || !stock.length}
              onClick={() =>
                setStockAutoUse([
                  ...stockAutoUse,
                  { menuItemId: menu[0]!.id, stockItemId: stock[0]!.id, qtyPerSale: 1 },
                ])
              }
            >
              <Plus size={14} /> Add rule
            </button>
          </div>
          <div className="table-wrap" style={{ overflowX: 'auto', marginTop: 8 }}>
            <table>
              <thead><tr><th>Menu item</th><th>Stock item</th><th>Qty / sale</th><th></th></tr></thead>
              <tbody>
                {stockAutoUse.map((rule, index) => (
                  <tr key={`${rule.menuItemId}-${rule.stockItemId}-${index}`}>
                    <td>
                      <select value={rule.menuItemId} onChange={(e) => patchAutoUse(index, { menuItemId: e.target.value })}>
                        {menu.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={rule.stockItemId} onChange={(e) => patchAutoUse(index, { stockItemId: e.target.value })}>
                        {stock.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </td>
                    <td><input className="input-tiny" type="number" min={0} step={0.1} value={rule.qtyPerSale} onChange={(e) => patchAutoUse(index, { qtyPerSale: Number(e.target.value) || 0 })} /></td>
                    <td><button type="button" className="btn ghost" title="Remove rule" onClick={() => setStockAutoUse(stockAutoUse.filter((_, i) => i !== index))}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
                {!stockAutoUse.length && <tr><td colSpan={4}>No automatic stock deductions configured.</td></tr>}
              </tbody>
            </table>
          </div>
        </MotionCard>
      </div>

      <div style={{ marginTop: '0.9rem' }}>
        <MotionCard interactive={false}>
          <h2>Add stock item</h2>
          <div className="filters" style={{ marginTop: '0.75rem' }}>
            <div className="field">
              <label htmlFor="stock-name">Name</label>
              <input
                id="stock-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Onion packet"
              />
            </div>
            <div className="field">
              <label htmlFor="stock-unit">Unit</label>
              <input
                id="stock-unit"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="pcs"
              />
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                addStockItem(newName, newUnit, 3)
                setNewName('')
              }}
            >
              Add item
            </button>
          </div>
        </MotionCard>
      </div>
    </>
  )
}
