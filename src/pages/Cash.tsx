import { Banknote, Coins, Diff, WalletCards } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartChrome, chartTooltipStyle, euroFull } from '../components/ChartChrome'
import { KpiCard } from '../components/KpiCard'
import { Money } from '../components/Money'
import { MotionCard, Stagger } from '../components/MotionCard'
import { EmptyState, SkeletonPage } from '../components/Skeleton'
import { useData } from '../context/DataContext'
import { useLocale } from '../context/LocaleContext'
import { countCash, denomValue, isLedgerEventId } from '../lib/cash'
import { explainCashMismatch } from '../lib/mismatch'
import type { EventCashCount, EventRow } from '../types'

/** Latest completed stall that has an Event Cash Box row. */
function latestCompletedCashEventId(
  counts: EventCashCount[],
  events: EventRow[],
): string {
  if (!counts.length) return ''
  const byId = new Map(events.map((e) => [e.id, e]))
  const ranked = counts
    .map((c) => {
      const ev = byId.get(c.eventId)
      const completed = (ev?.status || '').toLowerCase() === 'completed'
      const sortDate = ev?.endDate || ev?.startDate || ''
      const idNum = Number((c.eventId.match(/\d+/) || ['0'])[0])
      return { id: c.eventId, completed, sortDate, idNum }
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? -1 : 1
      if (a.sortDate && b.sortDate && a.sortDate !== b.sortDate) {
        return b.sortDate.localeCompare(a.sortDate)
      }
      return b.idNum - a.idNum
    })
  return ranked[0]?.id || counts[0]?.eventId || ''
}

export function Cash() {
  const { metrics, snapshot, loading } = useData()
  const { tr } = useLocale()
  const [eventFilter, setEventFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [countEvent, setCountEvent] = useState('')

  const ledgerRows = useMemo(() => {
    if (!snapshot) return []
    return snapshot.cashBox.filter((r) => isLedgerEventId(r.eventId))
  }, [snapshot])

  const events = useMemo(
    () => [...new Set(ledgerRows.map((r) => r.eventId))],
    [ledgerRows],
  )

  const types = useMemo(
    () => [...new Set(ledgerRows.map((r) => r.transactionType).filter(Boolean))],
    [ledgerRows],
  )

  const filtered = useMemo(() => {
    return ledgerRows
      .filter((r) => (eventFilter === 'all' ? true : r.eventId === eventFilter))
      .filter((r) => (typeFilter === 'all' ? true : r.transactionType === typeFilter))
      .slice()
      .reverse()
  }, [ledgerRows, eventFilter, typeFilter])

  const denomChart = useMemo(() => {
    if (!snapshot) return []
    return snapshot.denominations
      .map((d) => ({
        label: d.label,
        count: d.count,
        total: Math.round(denomValue(d.label) * d.count * 100) / 100,
      }))
      .filter((d) => d.count > 0 || d.total > 0)
  }, [snapshot])

  const explain = useMemo(
    () => (snapshot ? explainCashMismatch(snapshot) : null),
    [snapshot],
  )

  const eventCounts = snapshot?.eventCashCounts || []
  const defaultCountEvent = useMemo(
    () => latestCompletedCashEventId(eventCounts, snapshot?.events || []),
    [eventCounts, snapshot?.events],
  )
  const activeCountId = countEvent || defaultCountEvent
  const rawActive =
    eventCounts.find((e) => e.eventId === activeCountId) || eventCounts[0] || null
  // Prefer explicit before; fall back to Start-of-Day denoms from Excel
  const activeCount = rawActive
    ? {
        ...rawActive,
        before:
          rawActive.before.length > 0
            ? rawActive.before
            : rawActive.startOfDay || [],
        beforeCash:
          rawActive.beforeCash > 0
            ? rawActive.beforeCash
            : countCash(rawActive.startOfDay || []),
        beforePaypal: rawActive.beforePaypal,
      }
    : null

  if (loading) return <SkeletonPage />
  if (!metrics || !snapshot) {
    return <EmptyState title="No cash data" body="Upload Excel to see cash box reconciliation." />
  }

  const mismatchBad = Math.abs(metrics.cashMismatch) > 5
  const reserve = snapshot.coinReserve || []
  const reserveTotal = metrics.coinReserveTotal || countCash(reserve)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tr('cashBox')}</h1>
          <p>Main box, coin reserve, event before/after counts, and mismatch clues.</p>
        </div>
        <span className={`badge ${mismatchBad ? 'warn' : 'ok'}`}>
          {mismatchBad ? tr('mismatch') : 'Cash + PayPal matches ledger'}
        </span>
      </div>

      <Stagger className="grid kpi">
        <KpiCard
          label={tr('mainBox')}
          value={metrics.mainBoxTotal || metrics.cashWithPaypal}
          icon={WalletCards}
          tone="neutral"
          hint="Ledger / mit PayPal"
        />
        <KpiCard
          label={tr('coinReserve')}
          value={reserveTotal}
          icon={Coins}
          tone="accent"
          hint={`${reserve.length} denominations`}
        />
        <KpiCard
          label={tr('allBoxes')}
          value={metrics.allBoxesTotal || metrics.cashWithPaypal + reserveTotal}
          icon={Banknote}
          tone="positive"
          hint="Main + reserve"
        />
        <KpiCard
          label={tr('mismatch')}
          value={metrics.cashMismatch}
          icon={Diff}
          tone={mismatchBad ? 'negative' : 'positive'}
          hint={explain?.headline}
          format={(n) =>
            new Intl.NumberFormat('de-DE', {
              style: 'currency',
              currency: 'EUR',
              signDisplay: 'exceptZero',
            }).format(n)
          }
        />
      </Stagger>

      {explain && explain.direction !== 'ok' && (
        <MotionCard interactive={false}>
          <h2 style={{ marginTop: '0.9rem' }}>{tr('mismatch')} explanation</h2>
          <p style={{ margin: '0.4rem 0 0.75rem' }}>{explain.headline}</p>
          <ul className="steps">
            {explain.likelyCauses.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {explain.recentHints.length > 0 && (
            <div className="hint-inline" style={{ marginTop: '0.5rem' }}>
              Recent: {explain.recentHints.slice(0, 3).join(' · ')}
            </div>
          )}
        </MotionCard>
      )}

      <div className="grid two" style={{ marginTop: '0.9rem', marginBottom: '0.9rem' }}>
        <MotionCard interactive={false}>
          <div className="card-head">
            <h2>Event cash count</h2>
            <select
              value={activeCount?.eventId || activeCountId || ''}
              onChange={(e) => setCountEvent(e.target.value)}
            >
              {eventCounts.map((e) => (
                <option key={e.eventId} value={e.eventId}>
                  {e.eventId}
                </option>
              ))}
            </select>
          </div>
          {!activeCount && (
            <p className="hint-inline">
              No Event Cash Box counts in this snapshot — re-upload Excel to import before/after
              counts.
            </p>
          )}
          {activeCount && (
            <div className="grid two">
              <div>
                <div className="kpi-label">
                  {(rawActive?.startOfDay?.length ?? 0) > 0 ||
                  (!(rawActive?.before.length || (rawActive?.beforeCash ?? 0) > 0) &&
                    activeCount.before.length > 0)
                    ? tr('startOfDay')
                    : tr('before')}
                </div>
                <div className="kpi-value">
                  <Money value={activeCount.beforeCash} />
                </div>
                <div className="hint-inline">
                  PayPal <Money value={activeCount.beforePaypal} />
                </div>
                <div className="table-wrap" style={{ marginTop: '0.5rem' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Denom</th>
                        <th>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCount.before.map((d) => (
                        <tr key={`b-${d.label}`}>
                          <td>{d.label}</td>
                          <td>{d.count}</td>
                        </tr>
                      ))}
                      {activeCount.before.length === 0 && (
                        <tr>
                          <td colSpan={2}>—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <div className="kpi-label">{tr('after')}</div>
                <div className="kpi-value">
                  <Money value={activeCount.afterCash} />
                </div>
                <div className="hint-inline">
                  PayPal <Money value={activeCount.afterPaypal} /> · Δ{' '}
                  <Money
                    value={activeCount.afterCash - activeCount.beforeCash}
                    signed
                    colored
                  />
                </div>
                <div className="table-wrap" style={{ marginTop: '0.5rem' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Denom</th>
                        <th>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCount.after.map((d) => (
                        <tr key={`a-${d.label}`}>
                          <td>{d.label}</td>
                          <td>{d.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </MotionCard>

        <MotionCard interactive={false}>
          <h2>{tr('coinReserve')}</h2>
          <div className="kpi-value" style={{ margin: '0.5rem 0' }}>
            <Money value={reserveTotal} />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Denomination</th>
                  <th>Count</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {reserve.map((d) => (
                  <tr key={d.label}>
                    <td>{d.label}</td>
                    <td>{d.count}</td>
                    <td>
                      <Money value={denomValue(d.label) * d.count} />
                    </td>
                  </tr>
                ))}
                {reserve.length === 0 && (
                  <tr>
                    <td colSpan={3}>No coin reserve rows — re-upload Excel.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </MotionCard>
      </div>

      <div className="grid two" style={{ marginBottom: '0.9rem' }}>
        <ChartChrome title="Main box denominations" hint="Physical notes & coins">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={denomChart} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke="var(--grid)" strokeDasharray="3 6" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={90} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(v, _n, item) => {
                  const payload = item?.payload as { count?: number }
                  return [`${euroFull(Number(v ?? 0))} (${payload?.count ?? 0}×)`, 'Total']
                }}
              />
              <Bar dataKey="total" name="Total" radius={[0, 8, 8, 0]}>
                {denomChart.map((d) => (
                  <Cell
                    key={d.label}
                    fill={d.total >= 100 ? 'var(--chart-expense)' : 'var(--chart-income)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartChrome>

        <MotionCard interactive={false}>
          <h2>Main box count table</h2>
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Note / coin</th>
                  <th>Count</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.denominations.map((d) => (
                  <tr key={d.label}>
                    <td>{d.label}</td>
                    <td>{d.count}</td>
                    <td>
                      <Money value={denomValue(d.label) * d.count} />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2}>
                    <strong>Cash counted</strong>
                  </td>
                  <td>
                    <strong>
                      <Money value={metrics.cashCounted} />
                    </strong>
                  </td>
                </tr>
                <tr>
                  <td colSpan={2}>PayPal</td>
                  <td>
                    <Money value={metrics.paypalBalance} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={2}>
                    <strong>Mit PayPal</strong>
                  </td>
                  <td>
                    <strong>
                      <Money value={metrics.cashWithPaypal} />
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </MotionCard>
      </div>

      <MotionCard interactive={false}>
        <div className="card-head">
          <h2>Cash movements</h2>
          <span className="hint-inline">{filtered.length} rows</span>
        </div>
        <div className="filters">
          <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
            <option value="all">All events</option>
            {events.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th>Type</th>
                <th>In</th>
                <th>Out</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={`${r.eventId}-${r.description}-${i}`}>
                  <td>{r.eventId}</td>
                  <td>{r.date ?? '—'}</td>
                  <td>
                    {r.transactionType}
                    <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                      {r.description}
                    </div>
                  </td>
                  <td>{r.inAmount ? <Money value={r.inAmount} /> : '—'}</td>
                  <td>{r.outAmount ? <Money value={r.outAmount} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MotionCard>
    </>
  )
}
