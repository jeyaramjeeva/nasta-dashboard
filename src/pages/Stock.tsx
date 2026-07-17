import { AlertTriangle, Minus, Package, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MotionCard } from '../components/MotionCard'
import { remainingOf, useStallOps } from '../context/StallOpsContext'
import { isLowStock } from '../lib/stallOps'

export function Stock() {
  const {
    stock,
    lowStock,
    buyStock,
    useStock,
    setStockLowAt,
    addStockItem,
    syncing,
  } = useStallOps()
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('pcs')
  const [qtyDraft, setQtyDraft] = useState<Record<string, number>>({})

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
          <h1>
            <Package size={22} style={{ verticalAlign: -3, marginRight: 8 }} />
            Stall stock
          </h1>
          <p>
            Log what you bought before the event. When you open a packet / take stock for the stall,
            tap <strong>Use</strong> — Remaining is what you still have.
            {syncing ? ' Syncing…' : ''}
          </p>
        </div>
        <Link className="btn ghost" to="/orders">
          Orders →
        </Link>
      </div>

      {lowStock.length > 0 && (
        <div className="alert-item" style={{ marginBottom: '0.75rem' }}>
          <AlertTriangle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          Low stock: {lowStock.map((s) => `${s.name} (${remainingOf(s)} ${s.unit})`).join(' · ')}
        </div>
      )}

      <MotionCard interactive={false}>
        <div className="table-wrap table-wrap--fit">
          <table className="table-fit">
            <thead>
              <tr>
                <th>Item</th>
                <th>Bought</th>
                <th>Used</th>
                <th>Remaining</th>
                <th>Alert ≤</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const rem = remainingOf(s)
                const low = isLowStock(s)
                return (
                  <tr key={s.id} className={low ? 'stock-row--low' : undefined}>
                    <td className="cell-wrap">
                      <strong>{s.name}</strong>
                      <div className="hint-inline">{s.unit}</div>
                      {low && <span className="badge warn">Low</span>}
                    </td>
                    <td>{s.bought}</td>
                    <td>{s.used}</td>
                    <td>
                      <strong>{rem}</strong>
                    </td>
                    <td>
                      <input
                        className="input-tiny"
                        type="number"
                        min={0}
                        value={s.lowAt}
                        onChange={(e) => setStockLowAt(s.id, Number(e.target.value) || 0)}
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
