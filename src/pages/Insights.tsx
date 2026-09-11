import { useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AiCoachPanel } from '../components/AiCoachPanel'
import { BusinessIntelSection } from '../components/BusinessIntelSection'
import { ChartChrome, chartTooltipStyle, euroFull, euroTick } from '../components/ChartChrome'
import { CountUp } from '../components/CountUp'
import { EditableText } from '../components/EditableText'
import { Money } from '../components/Money'
import { MotionCard } from '../components/MotionCard'
import { EmptyState, SkeletonPage } from '../components/Skeleton'
import { useData } from '../context/DataContext'
import { useLocale } from '../context/LocaleContext'
import { useStallOps } from '../context/StallOpsContext'
import { channelByEventType } from '../lib/channelSplit'
import { buildWeeklyCoachDigest } from '../lib/coachDigest'
import { exportElementPdf, exportElementPng } from '../lib/exportReport'
import { germanyTodayYmd } from '../lib/germanyTime'
import { WEATHER_OPTIONS, loadWeather } from '../lib/extrasStore'
import { forecastEvent } from '../lib/insights'
import { seasonPairs, weatherCompare } from '../lib/seasons'
import { locationGoCautionSkip, weatherCallBadge } from '../lib/weatherAdvice'
import { feeWhatIf } from '../lib/whatIf'

export function Insights() {
  const { metrics, snapshot, loading } = useData()
  const { orders, menu, stock, foodMade, lowStock } = useStallOps()
  const { tr } = useLocale()
  const location = useLocation()
  const reportRef = useRef<HTMLDivElement>(null)
  const [estimateType, setEstimateType] = useState('Street Festival')
  const [days, setDays] = useState(3)
  const [pnlEvent, setPnlEvent] = useState<string>('')
  const [whatIfEvent, setWhatIfEvent] = useState('')
  const [whatIfFee, setWhatIfFee] = useState(200)
  const [digestCopied, setDigestCopied] = useState(false)
  const estimate = useMemo(() => {
    if (!metrics) return null
    return forecastEvent(metrics.byEventType, estimateType, days)
  }, [metrics, estimateType, days])

  const selected = useMemo(() => {
    if (!metrics) return null
    const id = pnlEvent || metrics.byEvent.find((e) => e.status === 'Completed')?.id
    return metrics.byEvent.find((e) => e.id === id) || null
  }, [metrics, pnlEvent])

  const channel = useMemo(() => {
    if (!metrics || !snapshot) return []
    return channelByEventType(snapshot, metrics.byEvent)
  }, [metrics, snapshot])

  const whatIfTarget = useMemo(() => {
    if (!metrics) return null
    const id =
      whatIfEvent ||
      metrics.byEvent.find((e) => e.status === 'Completed')?.id ||
      metrics.byEvent[0]?.id
    return metrics.byEvent.find((e) => e.id === id) || null
  }, [metrics, whatIfEvent])

  const whatIf = useMemo(() => {
    if (!whatIfTarget) return null
    return feeWhatIf(whatIfTarget, whatIfFee)
  }, [whatIfTarget, whatIfFee])

  const seasons = useMemo(
    () => (metrics ? seasonPairs(metrics.byEvent) : []),
    [metrics],
  )

  const weatherByEvent = useMemo(
    () => loadWeather(),
    // refresh when navigating back from Calendar after tagging
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.key],
  )

  const weatherRows = useMemo(
    () => (metrics ? weatherCompare(metrics.byEvent, weatherByEvent) : []),
    [metrics, weatherByEvent],
  )

  const pnlChart = useMemo(() => {
    if (!selected) return []
    return [
      { name: tr('fee'), value: selected.fee },
      { name: tr('grocery'), value: selected.grocery },
      { name: tr('transport'), value: selected.transport },
      { name: 'Income', value: selected.income },
    ]
  }, [selected, tr])

  const nextEvent = useMemo(() => {
    if (!metrics) return null
    return (
      metrics.byEvent
        .filter((event) => event.status !== 'Completed')
        .slice()
        .sort((a, b) => (a.startDate || '9999-12-31').localeCompare(b.startDate || '9999-12-31'))[0] ||
      metrics.byEvent[0] ||
      null
    )
  }, [metrics])

  const goSkipAdvice = useMemo(
    () =>
      locationGoCautionSkip({
        tag: nextEvent ? weatherByEvent[nextEvent.id] : undefined,
        history: metrics?.byEvent || [],
        weatherByEvent,
        event: nextEvent,
        locationScores: metrics?.byLocation,
      }),
    [metrics?.byEvent, metrics?.byLocation, nextEvent, weatherByEvent],
  )

  const coachDigest = useMemo(
    () =>
      buildWeeklyCoachDigest({
        orders,
        menu,
        stock,
        foodMade,
        events: metrics?.byEvent,
        lowStockCount: lowStock.length,
      }),
    [foodMade, lowStock.length, menu, metrics?.byEvent, orders, stock],
  )

  if (loading) return <SkeletonPage />

  const best = metrics?.byLocation[0]
  const worst = metrics ? metrics.byLocation[metrics.byLocation.length - 1] : undefined

  async function doExport(kind: 'png' | 'pdf') {
    if (!reportRef.current) return
    const name = `nasta-insights-${germanyTodayYmd()}`
    if (kind === 'png') await exportElementPng(reportRef.current, name)
    else await exportElementPdf(reportRef.current, name)
  }

  async function copyCoachDigest() {
    await navigator.clipboard.writeText(coachDigest.copyText)
    setDigestCopied(true)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <EditableText id="insights.pageTitle" as="h1" defaultText={tr('insights')} />
          <EditableText
            id="insights.pageSub"
            as="p"
            defaultText="Live stall intel plus location scorecards, forecasts, and Excel event analytics."
          />
        </div>
        {metrics && (
          <div className="page-actions">
            <button className="btn ghost" type="button" onClick={() => void doExport('png')}>
              {tr('downloadPng')}
            </button>
            <button className="btn ghost" type="button" onClick={() => void doExport('pdf')}>
              {tr('downloadPdf')}
            </button>
          </div>
        )}
      </div>

      <BusinessIntelSection />
      <div style={{ marginTop: '1rem' }}>
        <AiCoachPanel />
      </div>

      <div className="grid two" style={{ marginTop: '1rem' }}>
        <MotionCard interactive={false} className="go-skip-card">
          <div className="card-head">
            <div>
              <div className="kpi-label">Next stall recommendation</div>
              <h2>{goSkipAdvice.title}</h2>
            </div>
            <span className={`badge ${weatherCallBadge(goSkipAdvice.call)}`}>
              {goSkipAdvice.call.toUpperCase()}
            </span>
          </div>
          {nextEvent && (
            <p className="hint-inline">
              {nextEvent.id} · {nextEvent.name}
              {nextEvent.location ? ` · ${nextEvent.location}` : ''}
            </p>
          )}
          <p style={{ marginBottom: 0 }}>{goSkipAdvice.line}</p>
        </MotionCard>

        <MotionCard interactive={false} className="coach-digest">
          <div className="card-head">
            <div>
              <div className="kpi-label">Weekly coach digest</div>
              <h2>{coachDigest.weekLabel}</h2>
            </div>
          </div>
          <div className="coach-digest__lists">
            <div>
              <strong>Wins</strong>
              <ol>
                {coachDigest.wins.map((item) => (
                  <li key={item.text}>{item.text}</li>
                ))}
              </ol>
            </div>
            <div>
              <strong>Fix next</strong>
              <ol>
                {coachDigest.fixes.map((item) => (
                  <li key={item.text}>{item.text}</li>
                ))}
              </ol>
            </div>
          </div>
          <div className="page-actions" style={{ marginTop: '0.75rem' }}>
            <button className="btn ghost" type="button" onClick={() => void copyCoachDigest()}>
              {digestCopied ? 'Copied' : 'Copy text'}
            </button>
            <a
              className="btn ghost"
              href={`mailto:?subject=${encodeURIComponent('Nasta weekly coach digest')}&body=${encodeURIComponent(coachDigest.copyText)}`}
            >
              Email digest
            </a>
          </div>
        </MotionCard>
      </div>

      {!metrics ? (
        <div style={{ marginTop: '1.25rem' }}>
          <EmptyState
            title="No Excel insights yet"
            body="Upload Excel to unlock location scorecards, event P&L, weather, and seasons."
          />
        </div>
      ) : (
      <div ref={reportRef} style={{ marginTop: '1.5rem' }}>
        <div className="section-label" style={{ marginBottom: '0.75rem' }}>
          Event & location analytics
          <span className="hint-inline" style={{ marginLeft: 8, fontWeight: 400 }}>
            From uploaded Excel
          </span>
        </div>
        <div className="grid two" style={{ marginBottom: '0.9rem' }}>
          <ChartChrome title={tr('locationScorecard')} hint="Ranked by €/day, then margin">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.byLocation.slice(0, 8)} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid stroke="var(--grid)" strokeDasharray="3 6" horizontal={false} />
                <XAxis type="number" tickFormatter={euroTick} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="location" width={120} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(v, name) => [euroFull(Number(v ?? 0)), String(name)]}
                />
                <Bar dataKey="incomePerDay" name="€/day" radius={[0, 8, 8, 0]}>
                  {metrics.byLocation.slice(0, 8).map((row, i) => (
                    <Cell
                      key={row.location}
                      fill={i === 0 ? 'var(--chart-income)' : i === metrics.byLocation.length - 1 ? 'var(--danger)' : 'var(--accent)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartChrome>

          <MotionCard interactive={false}>
            <h2>{tr('locationScorecard')}</h2>
            <div className="chip-row" style={{ margin: '0.75rem 0' }}>
              {best && (
                <span className="badge ok">
                  {tr('best')}: {best.location} · <Money value={best.incomePerDay} />/d ·{' '}
                  {(best.margin * 100).toFixed(0)}%
                </span>
              )}
              {worst && metrics.byLocation.length > 1 && (
                <span className="badge warn">
                  {tr('worst')}: {worst.location} · <Money value={worst.incomePerDay} />/d ·{' '}
                  {(worst.margin * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Location</th>
                    <th>€/day</th>
                    <th>Margin</th>
                    <th>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.byLocation.map((l) => (
                    <tr key={l.location}>
                      <td>{l.rank}</td>
                      <td>{l.location}</td>
                      <td>
                        <Money value={l.incomePerDay} />
                      </td>
                      <td>{(l.margin * 100).toFixed(0)}%</td>
                      <td>
                        <Money value={l.profit} colored />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MotionCard>
        </div>

        <div className="grid two" style={{ marginBottom: '0.9rem' }}>
          <MotionCard interactive={false}>
            <div className="card-head">
              <h2>{tr('eventPnL')}</h2>
              <select
                value={selected?.id || ''}
                onChange={(e) => setPnlEvent(e.target.value)}
              >
                {metrics.byEvent.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.id} · {e.location || e.name}
                  </option>
                ))}
              </select>
            </div>
            {selected && (
              <>
                <div className="grid three" style={{ marginBottom: '0.75rem' }}>
                  <div>
                    <div className="kpi-label">Income</div>
                    <strong className="pos">
                      <Money value={selected.income} />
                    </strong>
                  </div>
                  <div>
                    <div className="kpi-label">{tr('breakEven')}</div>
                    <strong>
                      <Money value={selected.breakEven} />
                    </strong>
                  </div>
                  <div>
                    <div className="kpi-label">Op. profit</div>
                    <strong>
                      <Money value={selected.operatingProfit} colored />
                    </strong>
                  </div>
                </div>
                <div className="chart-box" style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pnlChart}>
                      <CartesianGrid stroke="var(--grid)" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={euroTick} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => euroFull(Number(v ?? 0))} />
                      <ReferenceLine
                        y={selected.breakEven}
                        stroke="var(--warn)"
                        strokeDasharray="4 4"
                        label={{ value: tr('breakEven'), fill: 'var(--warn)', fontSize: 11 }}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {pnlChart.map((row) => (
                          <Cell
                            key={row.name}
                            fill={row.name === 'Income' ? 'var(--chart-income)' : 'var(--chart-expense)'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="hint-inline">
                  {tr('fee')} <Money value={selected.fee} /> · {tr('grocery')}{' '}
                  <Money value={selected.grocery} /> · {tr('transport')}{' '}
                  <Money value={selected.transport} />
                </div>
              </>
            )}
          </MotionCard>

          <MotionCard interactive={false}>
            <h2>{tr('forecast')}</h2>
            <div className="filters" style={{ marginTop: '0.75rem' }}>
              <select value={estimateType} onChange={(e) => setEstimateType(e.target.value)}>
                {['Flohmarkt', 'Street Festival', 'Gourmet Festival'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={10}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 1)}
                style={{ width: 100 }}
              />
              <span className="badge">days</span>
            </div>
            {estimate && (
              <div className="grid two" style={{ marginTop: '0.5rem' }}>
                <div className="glass-card" style={{ boxShadow: 'none' }}>
                  <div className="kpi-label">Expected income</div>
                  <div className="kpi-value tone-positive">
                    <CountUp value={estimate.expectedIncome} />
                  </div>
                  <div className="kpi-hint">
                    <Money value={estimate.incomePerDay} />/d · {estimate.sampleSize} samples
                  </div>
                </div>
                <div className="glass-card" style={{ boxShadow: 'none' }}>
                  <div className="kpi-label">Grocery budget</div>
                  <div className="kpi-value tone-negative">
                    <CountUp value={estimate.groceryBudget} />
                  </div>
                  <div className="kpi-hint">
                    + fee ~<Money value={estimate.feeEstimate} /> · transport ~
                    <Money value={estimate.transportEstimate} />
                  </div>
                </div>
                <div className="glass-card" style={{ boxShadow: 'none' }}>
                  <div className="kpi-label">{tr('breakEven')}</div>
                  <div className="kpi-value">
                    <CountUp value={estimate.breakEven} />
                  </div>
                </div>
                <div className="glass-card" style={{ boxShadow: 'none' }}>
                  <div className="kpi-label">Expected net</div>
                  <div
                    className={`kpi-value ${estimate.expectedNet >= 0 ? 'tone-positive' : 'tone-negative'}`}
                  >
                    <CountUp
                      value={estimate.expectedNet}
                      format={(n) =>
                        new Intl.NumberFormat('de-DE', {
                          style: 'currency',
                          currency: 'EUR',
                          signDisplay: 'exceptZero',
                        }).format(n)
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </MotionCard>
        </div>

        <div className="grid two" style={{ marginBottom: '0.9rem' }}>
          <ChartChrome title="PayPal vs cash" hint="% of sales by channel per event type">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channel} margin={{ left: 4 }}>
                <CartesianGrid stroke="var(--grid)" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="type" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={euroTick} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v, name) => [euroFull(Number(v ?? 0)), String(name)]} />
                <Legend />
                <Bar dataKey="cash" name="Cash" stackId="a" fill="var(--chart-cash)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="paypal" name="PayPal" stackId="a" fill="var(--chart-paypal)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartChrome>

          <MotionCard interactive={false}>
            <h2>Channel mix</h2>
            <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Cash %</th>
                    <th>PayPal %</th>
                    <th>Events</th>
                  </tr>
                </thead>
                <tbody>
                  {channel.map((r) => (
                    <tr key={r.type}>
                      <td>{r.type}</td>
                      <td>{r.cashPct.toFixed(0)}%</td>
                      <td>{r.paypalPct.toFixed(0)}%</td>
                      <td>{r.events}</td>
                    </tr>
                  ))}
                  {channel.length === 0 && (
                    <tr>
                      <td colSpan={4}>Needs Event Cash Box PayPal before/after + income.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </MotionCard>
        </div>

        <div className="grid two" style={{ marginBottom: '0.9rem' }}>
          <MotionCard interactive={false}>
            <div className="card-head">
              <h2>What-if stall fee</h2>
              <select
                value={whatIfTarget?.id || ''}
                onChange={(e) => {
                  setWhatIfEvent(e.target.value)
                  const ev = metrics.byEvent.find((x) => x.id === e.target.value)
                  if (ev) setWhatIfFee(Math.round(ev.fee || 200))
                }}
              >
                {metrics.byEvent.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.id} · {e.location || e.name}
                    {e.fee ? ` · fee €${e.fee.toFixed(0)}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="range-field">
              <label className="hint-inline">If fee were</label>
              <input
                type="range"
                min={0}
                max={2000}
                step={10}
                value={whatIfFee}
                onChange={(e) => setWhatIfFee(Number(e.target.value) || 0)}
                aria-label="What-if stall fee"
              />
              <input
                type="number"
                min={0}
                step={10}
                value={whatIfFee}
                onChange={(e) => setWhatIfFee(Number(e.target.value) || 0)}
                style={{ width: 120 }}
              />
              <span className="badge">€</span>
            </div>
            {whatIf && (
              <>
                <div className="grid two" style={{ marginTop: '0.75rem' }}>
                  <div>
                    <div className="kpi-label">What-if break-even</div>
                    <strong>
                      <Money value={whatIf.whatIfBreakEven} />
                    </strong>
                  </div>
                  <div>
                    <div className="kpi-label">What-if op. profit</div>
                    <strong>
                      <Money value={whatIf.whatIfOperatingProfit} colored signed />
                    </strong>
                  </div>
                </div>
                <p style={{ marginTop: '0.75rem' }}>
                  {whatIf.beatsBreakEven ? (
                    <span className="badge ok">
                      Yes — {whatIf.eventId} still beats break-even at €{whatIf.whatIfFee}
                    </span>
                  ) : (
                    <span className="badge warn">
                      No — would miss break-even by{' '}
                      <Money value={Math.abs(whatIf.whatIfOperatingProfit)} />
                    </span>
                  )}
                </p>
                <div className="hint-inline" style={{ marginTop: '0.4rem' }}>
                  Actual fee <Money value={whatIf.actualFee} /> · Δ vs actual{' '}
                  <Money value={whatIf.deltaVsActual} signed colored />
                </div>
              </>
            )}
          </MotionCard>

          <MotionCard interactive={false}>
            <h2>Weather vs performance</h2>
            <p className="hint-inline">
              Tag sunny / good weather / windy / rainy / mixed on Calendar, then compare here.
            </p>
            <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Weather</th>
                    <th>Events</th>
                    <th>€/day</th>
                    <th>Avg margin</th>
                    <th>Avg profit</th>
                  </tr>
                </thead>
                <tbody>
                  {weatherRows.map((r) => {
                    const label =
                      WEATHER_OPTIONS.find((o) => o.value === r.tag)?.label || r.tag
                    return (
                      <tr key={r.tag}>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background:
                                r.tag === 'rainy' || r.tag === 'windy'
                                  ? 'color-mix(in srgb, var(--chart-rain) 22%, transparent)'
                                  : r.tag === 'sunny' || r.tag === 'good'
                                    ? 'var(--warn-soft)'
                                    : undefined,
                            }}
                          >
                            {label}
                          </span>
                        </td>
                        <td>{r.events}</td>
                        <td>
                          <Money value={r.avgIncomePerDay} />
                        </td>
                        <td>{(r.avgMargin * 100).toFixed(0)}%</td>
                        <td>
                          <Money value={r.avgProfit} colored />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </MotionCard>
        </div>

        <MotionCard interactive={false}>
          <h2>Seasons — same festival YoY</h2>
          <p className="hint-inline">
            Pairs the same location + type across years (e.g. 2025 vs 2026). Single-year rows wait for
            a prior season.
          </p>
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Years</th>
                  <th>Income Δ</th>
                  <th>Profit Δ</th>
                  <th>€/day Δ</th>
                </tr>
              </thead>
              <tbody>
                {seasons.slice(0, 12).map((s) => (
                  <tr key={s.key}>
                    <td>{s.location}</td>
                    <td>{s.name}</td>
                    <td>
                      {s.a ? s.yearA : '—'} → {s.yearB}
                    </td>
                    <td>
                      {s.a ? <Money value={s.incomeDelta} signed colored /> : <span className="hint-inline">Need prior year</span>}
                    </td>
                    <td>{s.a ? <Money value={s.profitDelta} signed colored /> : '—'}</td>
                    <td>{s.a ? <Money value={s.perDayDelta} signed colored /> : '—'}</td>
                  </tr>
                ))}
                {seasons.length === 0 && (
                  <tr>
                    <td colSpan={6}>No dated events to compare yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </MotionCard>
      </div>
      )}
    </>
  )
}
