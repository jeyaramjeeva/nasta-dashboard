import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartChrome, chartTooltipStyle, euroFull, euroTick } from '../components/ChartChrome'
import { Money } from '../components/Money'
import { MotionCard } from '../components/MotionCard'
import { EmptyState, SkeletonPage } from '../components/Skeleton'
import { useData } from '../context/DataContext'
import { useLocale } from '../context/LocaleContext'
import { exportElementPdf, exportElementPng } from '../lib/exportReport'
import { loadSplitRules, saveSplitRules, type SplitMode, type SplitRules } from '../lib/extrasStore'
import { germanyTodayYmd } from '../lib/germanyTime'
import { applySplitRules, explainExpensesFirst } from '../lib/splitRules'

type PotSource = 'sales' | 'cash' | 'custom'

export function Partners() {
  const { metrics, snapshot, loading } = useData()
  const { tr } = useLocale()
  const reportRef = useRef<HTMLDivElement>(null)

  const peopleNames = useMemo(() => {
    if (!metrics) return []
    return metrics.partners
      .filter((p) => !['Box', 'Paypal', 'PayPal'].includes(p.name))
      .map((p) => p.name)
  }, [metrics])

  const [rules, setRules] = useState<SplitRules>(() => loadSplitRules(peopleNames))
  const [potSource, setPotSource] = useState<PotSource>('sales')
  const [customPot, setCustomPot] = useState('')

  useEffect(() => {
    if (!peopleNames.length) return
    setRules((prev) => {
      const next = { ...prev, shares: { ...prev.shares } }
      let changed = false
      const equal = 1 / peopleNames.length
      for (const n of peopleNames) {
        if (next.shares[n] == null) {
          next.shares[n] = equal
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [peopleNames])

  if (loading) return <SkeletonPage />
  if (!metrics || !snapshot) {
    return <EmptyState title="No partner data" body="Upload Excel to see partner balances." />
  }

  const people = metrics.partners.filter((p) => !['Box', 'Paypal', 'PayPal'].includes(p.name))
  const chartData = people.map((p) => ({
    name: p.name,
    owed: Math.max(0, p.balance),
    returned: p.returned,
  }))

  const potValue = (() => {
    if (potSource === 'sales') return metrics.totalIncome
    if (potSource === 'cash') return metrics.cashWithPaypal
    const n = Number(customPot)
    return Number.isFinite(n) ? Math.max(0, n) : 0
  })()

  const plan = applySplitRules(
    metrics.partners,
    rules,
    rules.mode === 'expenses_first' || rules.mode === 'custom_pct' ? potValue : undefined,
  )
  const waterfall = explainExpensesFirst(metrics.partners, potValue)

  const planLine =
    plan.length > 0
      ? plan.map((p) => `pay ${p.name} €${p.suggestedPay.toFixed(2)}`).join(', ')
      : 'Nothing outstanding'

  function updateMode(mode: SplitMode) {
    const next = { ...rules, mode }
    // Equal thirds when switching to expenses_first
    if (mode === 'expenses_first') {
      const equal = 1 / Math.max(peopleNames.length, 1)
      const shares: Record<string, number> = {}
      for (const n of peopleNames) shares[n] = equal
      next.shares = shares
    }
    setRules(next)
    saveSplitRules(next)
  }

  function updateShare(name: string, pct: number) {
    const next: SplitRules = {
      ...rules,
      shares: { ...rules.shares, [name]: Math.max(0, pct) / 100 },
    }
    setRules(next)
    saveSplitRules(next)
  }

  function setEqualShares() {
    const equal = 1 / Math.max(people.length, 1)
    const shares: Record<string, number> = {}
    for (const p of people) shares[p.name] = equal
    const next = { ...rules, shares }
    setRules(next)
    saveSplitRules(next)
  }

  async function doExport(kind: 'png' | 'pdf') {
    if (!reportRef.current) return
    const name = `nasta-partners-${germanyTodayYmd()}`
    if (kind === 'png') await exportElementPng(reportRef.current, name)
    else await exportElementPdf(reportRef.current, name)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Partners</h1>
          <p>Pay back expenses first, then split profit equally (⅓ each).</p>
        </div>
        <div className="page-actions">
          <span className="badge warn">
            Total owed <Money value={metrics.partnerOwed} />
          </span>
          <button className="btn ghost" type="button" onClick={() => void doExport('png')}>
            {tr('downloadPng')}
          </button>
          <button className="btn ghost" type="button" onClick={() => void doExport('pdf')}>
            {tr('downloadPdf')}
          </button>
        </div>
      </div>

      <div ref={reportRef}>
        <div style={{ marginBottom: '0.9rem' }}>
          <MotionCard interactive={false}>
            <h2>{tr('settlement')}</h2>
            <p className="hint-inline" style={{ marginTop: '0.35rem' }}>
              {tr('payThisWeek')}: <strong>{planLine}</strong>
            </p>

            <div className="split-mode-row">
              {(
                [
                  ['expenses_first', '1) Expenses → 2) Equal profit'],
                  ['owed', "Pay what's owed only"],
                  ['custom_pct', 'Custom % of pot'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`btn ghost ${rules.mode === mode ? 'is-on' : ''}`}
                  onClick={() => updateMode(mode)}
                >
                  {label}
                </button>
              ))}
            </div>

            {rules.mode === 'expenses_first' && (
              <div className="settle-waterfall">
                <ol className="settle-steps">
                  <li>
                    <strong>Step 1 — Pay back what they put in</strong>
                    <span>
                      Reimburse each partner’s still-owed expenses (
                      <Money value={waterfall.totalOwed} /> total).
                      {!waterfall.canFullyRepay && ' Pot is short — split pro-rata.'}
                    </span>
                  </li>
                  <li>
                    <strong>Step 2 — Equal profit share</strong>
                    <span>
                      Leftover after reimbursements (
                      <Money value={waterfall.profit} />) ÷ {people.length} partners.
                    </span>
                  </li>
                </ol>

                <div className="filters" style={{ marginTop: '0.65rem', marginBottom: 0 }}>
                  <span className="hint-inline">Money to distribute (pot)</span>
                  <select
                    value={potSource}
                    onChange={(e) => setPotSource(e.target.value as PotSource)}
                  >
                    <option value="sales">Sales collected ({euro(metrics.totalIncome)})</option>
                    <option value="cash">Cash + PayPal ({euro(metrics.cashWithPaypal)})</option>
                    <option value="custom">Custom amount</option>
                  </select>
                  {potSource === 'custom' && (
                    <input
                      type="number"
                      min={0}
                      step={10}
                      placeholder="€ amount"
                      value={customPot}
                      onChange={(e) => setCustomPot(e.target.value)}
                      style={{ width: 120 }}
                    />
                  )}
                  <button type="button" className="btn ghost" onClick={setEqualShares}>
                    Reset to ⅓ each
                  </button>
                </div>
              </div>
            )}

            {rules.mode === 'custom_pct' && (
              <div className="filters" style={{ marginBottom: '0.5rem' }}>
                <span className="hint-inline">Pot</span>
                <select
                  value={potSource}
                  onChange={(e) => setPotSource(e.target.value as PotSource)}
                >
                  <option value="sales">Sales ({euro(metrics.totalIncome)})</option>
                  <option value="cash">Cash + PayPal ({euro(metrics.cashWithPaypal)})</option>
                  <option value="custom">Custom</option>
                </select>
                {potSource === 'custom' && (
                  <input
                    type="number"
                    min={0}
                    value={customPot}
                    onChange={(e) => setCustomPot(e.target.value)}
                    style={{ width: 120 }}
                  />
                )}
                {people.map((p) => (
                  <label
                    key={p.name}
                    className="hint-inline"
                    style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                  >
                    {p.name}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round((rules.shares[p.name] ?? 0) * 100)}
                      style={{ width: 64 }}
                      onChange={(e) => updateShare(p.name, Number(e.target.value) || 0)}
                    />
                    %
                  </label>
                ))}
              </div>
            )}

            <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Still owed (put in)</th>
                    {rules.mode === 'expenses_first' && (
                      <>
                        <th>① Reimburse</th>
                        <th>② Profit ⅓</th>
                      </>
                    )}
                    <th>Total to pay</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((p) => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td>
                        <Money value={p.owed} />
                      </td>
                      {rules.mode === 'expenses_first' && (
                        <>
                          <td>
                            <Money value={p.reimbursement ?? 0} />
                          </td>
                          <td>
                            <Money value={p.profitShare ?? 0} />
                          </td>
                        </>
                      )}
                      <td>
                        <strong>
                          <Money value={p.suggestedPay} />
                        </strong>
                      </td>
                    </tr>
                  ))}
                  {plan.length === 0 && (
                    <tr>
                      <td colSpan={rules.mode === 'expenses_first' ? 5 : 3}>
                        All partners settled — nothing to pay.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </MotionCard>
        </div>

        <div className="grid two" style={{ marginBottom: '0.9rem' }}>
          <MotionCard interactive={false}>
            <h2>Balances</h2>
            <p className="hint-inline" style={{ marginTop: '0.35rem' }}>
              Paid = money they put in · Returned = already paid back · Still owed = left to
              reimburse
            </p>
            <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Paid (put in)</th>
                    <th>Returned</th>
                    <th>Still owed</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td>
                        <Money value={p.paid} />
                      </td>
                      <td>
                        <Money value={p.returned} />
                      </td>
                      <td>
                        <strong>
                          <Money value={Math.max(0, p.balance)} colored />
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MotionCard>

          <ChartChrome title="Owed vs returned" hint="Partner reimbursements at a glance">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="var(--grid)" strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={euroTick}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(v) => euroFull(Number(v ?? 0))}
                />
                <Legend />
                <Bar
                  dataKey="owed"
                  name="Still owed"
                  fill="var(--chart-expense)"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="returned"
                  name="Returned"
                  fill="var(--chart-income)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartChrome>
        </div>

        <MotionCard interactive={false}>
          <h2>Recent settlements</h2>
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Person</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSettlements(snapshot.transactions).map((t, i) => (
                  <tr key={`${t.date}-${t.person}-${i}`}>
                    <td>{t.date ?? '—'}</td>
                    <td>{t.person}</td>
                    <td>{t.description}</td>
                    <td>
                      <Money value={Math.abs(t.amount)} />
                    </td>
                    <td>{t.status || '—'}</td>
                  </tr>
                ))}
                {recentSettlements(snapshot.transactions).length === 0 && (
                  <tr>
                    <td colSpan={5}>No settlements logged yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </MotionCard>
      </div>
    </>
  )
}

function euro(n: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function recentSettlements(
  transactions: { type: string; date: string | null; person: string; description: string; amount: number; status: string }[],
) {
  return transactions
    .filter((t) => t.type === 'Settlement')
    .slice(-12)
    .reverse()
}
