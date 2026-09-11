import { Activity, Brain, Flame, LineChart as LineIcon, Sparkles, TrendingUp } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartChrome, chartTooltipStyle, euroFull } from './ChartChrome'
import { Money } from './Money'
import { MotionCard } from './MotionCard'
import { useData } from '../context/DataContext'
import { useStallOps } from '../context/StallOpsContext'
import {
  aiDemandPrediction,
  aiSalesForecast,
  businessHealthScore,
  comboRecommendations,
  DOW_LABELS,
  heatmapHourColumns,
  incomeTrendForecast,
  itemProfitability,
  reviewIntelligence,
  salesHourHeatmap,
} from '../lib/businessIntel'
import { loadLocalReviews } from '../lib/customerReviews'
import { langLabel, type DetectedLang } from '../lib/textIntel'

/** Live POS / review intelligence — shared by Insights (and former Intel tab). */
export function BusinessIntelSection() {
  const { metrics } = useData()
  const { orders, menu, lowStock, setMenuFoodCost } = useStallOps()
  const reviews = useMemo(() => loadLocalReviews(), [])
  const [heatEventId, setHeatEventId] = useState('')
  const menuById = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu])

  const profits = useMemo(() => itemProfitability(orders, menu), [orders, menu])
  const heat = useMemo(
    () => salesHourHeatmap(orders, heatEventId || undefined),
    [orders, heatEventId],
  )
  const heatHours = useMemo(() => heatmapHourColumns(heat), [heat])
  const trend = useMemo(() => incomeTrendForecast(orders), [orders])
  const salesAi = useMemo(() => aiSalesForecast(orders), [orders])
  const demand = useMemo(() => aiDemandPrediction(orders, menu), [orders, menu])
  const combos = useMemo(() => comboRecommendations(orders), [orders])
  const health = useMemo(
    () =>
      businessHealthScore({
        orders,
        menu,
        reviews,
        lowStockCount: lowStock.length,
      }),
    [orders, menu, reviews, lowStock.length],
  )
  const reviewIntel = useMemo(() => reviewIntelligence(reviews), [reviews])

  const heatEventOptions = useMemo(() => {
    const labels = new Map<string, string>()
    for (const e of metrics?.byEvent || []) {
      labels.set(e.id, `${e.id} · ${e.name}${e.location ? ` · ${e.location}` : ''}`)
    }
    const counts = new Map<string, number>()
    let unassigned = 0
    for (const o of orders) {
      if (o.status !== 'completed' || o.voided) continue
      const id = (o.eventId || '').trim()
      if (!id) {
        unassigned += 1
        continue
      }
      counts.set(id, (counts.get(id) || 0) + 1)
      if (!labels.has(id)) labels.set(id, id)
    }
    const opts = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([id]) => ({
        id,
        label: labels.get(id) || id,
      }))
    // Also show Excel events that have no POS tickets yet (so you can switch ahead)
    for (const e of metrics?.byEvent || []) {
      if (!counts.has(e.id)) {
        opts.push({ id: e.id, label: labels.get(e.id) || e.id })
      }
    }
    return { opts, unassigned }
  }, [metrics?.byEvent, orders])

  const heatOrderCount = useMemo(
    () => heat.reduce((s, c) => s + c.orders, 0),
    [heat],
  )
  const heatMax = Math.max(1, ...heat.map((c) => c.orders))
  const heatMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of heat) m.set(`${c.dow}-${c.hour}`, c.orders)
    return m
  }, [heat])
  const heatPeak = useMemo(() => {
    let best: { dow: number; hour: number; orders: number } | null = null
    for (const c of heat) {
      if (!best || c.orders > best.orders) best = c
    }
    if (!best || best.orders <= 0) return null
    return `${DOW_LABELS[best.dow] || '?'} ${best.hour}:00 · ${best.orders} orders`
  }, [heat])

  const chartTrend = useMemo(() => {
    const hist = trend.history.map((p) => ({
      day: p.day.slice(5),
      actual: p.revenue,
      forecast: null as number | null,
    }))
    const fc = trend.forecast.map((p) => ({
      day: p.day.slice(5),
      actual: null as number | null,
      forecast: p.forecast ?? p.revenue,
    }))
    return [...hist, ...fc]
  }, [trend])

  const langMix = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of reviewIntel) m[r.lang] = (m[r.lang] || 0) + 1
    return Object.entries(m).map(([lang, n]) => ({
      lang: langLabel(lang as DetectedLang),
      n,
    }))
  }, [reviewIntel])

  const sentimentMix = useMemo(() => {
    const m = { positive: 0, neutral: 0, negative: 0 }
    for (const r of reviewIntel) m[r.sentiment] += 1
    return m
  }, [reviewIntel])

  return (
    <section className="insights-intel" aria-label="Business intelligence">
      <div className="section-label" style={{ marginBottom: '0.75rem' }}>
        <Brain size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
        Live stall intel
        <span className="hint-inline" style={{ marginLeft: 8, fontWeight: 400 }}>
          From POS orders & customer reviews
        </span>
      </div>

      <MotionCard interactive={false} className="best-hours-card">
        <div className="card-head" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ margin: 0 }}>
              <Flame size={20} style={{ verticalAlign: -3, marginRight: 6 }} />
              Best hours
            </h2>
            {heatPeak && (
              <strong className="best-hours-card__peak">Peak: {heatPeak}</strong>
            )}
          </div>
          <select
            value={heatEventId}
            onChange={(e) => setHeatEventId(e.target.value)}
            aria-label="Filter heatmap by event"
            style={{ minWidth: 220 }}
          >
            <option value="">All events</option>
            {heatEventOptions.unassigned > 0 && (
              <option value="__none__">No event assigned</option>
            )}
            {heatEventOptions.opts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <p className="hint-inline">
          Darker = more completed tickets (Berlin time)
          {heatOrderCount > 0
            ? ` · ${heatOrderCount} order${heatOrderCount === 1 ? '' : 's'}${heatEventId ? ' for this event' : ''}`
            : ' · pick an event to compare hour patterns'}
          .
        </p>
        {heatOrderCount === 0 ? (
          <p className="hint-inline" style={{ marginTop: 12 }}>
            No completed POS tickets for this filter yet. Complete orders with a stall event selected
            (Orders / POS) to fill the heatmap.
          </p>
        ) : (
          <div
            className="heat-grid"
            style={{
              marginTop: 12,
              gridTemplateColumns: `2.4rem repeat(${heatHours.length}, minmax(1.35rem, 1fr))`,
            }}
          >
            <div className="heat-grid__corner" />
            {heatHours.map((h) => (
              <div key={h} className="heat-grid__hour">
                {h}
              </div>
            ))}
            {DOW_LABELS.map((label, dow) => (
              <Fragment key={label}>
                <div className="heat-grid__dow">{label}</div>
                {heatHours.map((h) => {
                  const n = heatMap.get(`${dow}-${h}`) || 0
                  const t = n <= 0 ? 0 : Math.max(0.28, n / heatMax)
                  return (
                    <div
                      key={`${dow}-${h}`}
                      className={`heat-grid__cell${n > 0 ? ' has-sales' : ''}`}
                      title={`${label} ${h}:00 — ${n} order${n === 1 ? '' : 's'}`}
                      style={{
                        background:
                          n > 0
                            ? `color-mix(in srgb, var(--accent) ${Math.round(t * 90)}%, #fff)`
                            : 'var(--surface)',
                      }}
                    >
                      {n > 0 ? n : ''}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        )}
      </MotionCard>

      <div className="kpi-grid" style={{ marginBottom: '1rem' }}>
        <MotionCard interactive={false}>
          <div className="kpi-label">Business health</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 800 }}>{health.score}</span>
            <span className={`badge ${health.score >= 70 ? 'ok' : health.score >= 50 ? 'warn' : ''}`}>
              Grade {health.grade}
            </span>
          </div>
          <ul className="hint-inline" style={{ marginTop: 8, paddingLeft: 16 }}>
            {health.factors.slice(0, 4).map((f) => (
              <li key={f.label}>
                {f.label}: {f.impact >= 0 ? '+' : ''}
                {f.impact} — {f.note}
              </li>
            ))}
          </ul>
        </MotionCard>
        <MotionCard interactive={false}>
          <div className="kpi-label">
            <Sparkles size={14} style={{ verticalAlign: -2 }} /> AI sales forecast
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            <Money value={salesAi.next7Revenue} />
            <span className="hint-inline"> / 7 days</span>
          </div>
          <p className="hint-inline" style={{ marginTop: 8 }}>
            {salesAi.narrative}
          </p>
          {salesAi.vsRecentAvg !== 0 && (
            <p className="hint-inline">
              vs recent avg/day: {salesAi.vsRecentAvg > 0 ? '+' : ''}
              {salesAi.vsRecentAvg}%
            </p>
          )}
        </MotionCard>
        <MotionCard interactive={false}>
          <div className="kpi-label">Review sentiment</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            <span className="badge ok">+ {sentimentMix.positive}</span>
            <span className="badge">~ {sentimentMix.neutral}</span>
            <span className="badge warn">− {sentimentMix.negative}</span>
          </div>
          <p className="hint-inline" style={{ marginTop: 8 }}>
            Language mix:{' '}
            {langMix.length
              ? langMix.map((x) => `${x.lang} ${x.n}`).join(' · ')
              : 'No reviews yet'}
          </p>
        </MotionCard>
      </div>

      {chartTrend.length === 0 ? (
        <MotionCard interactive={false} className="mt-card">
          <h2>
            <LineIcon size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
            Income trend + forecast
          </h2>
          <p className="hint-inline">Complete a few POS orders to see the trend.</p>
        </MotionCard>
      ) : (
        <ChartChrome title="Income trend + forecast" hint="Solid = actual · dashed = next 7 days">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={euroFull} width={56} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => euroFull(Number(v ?? 0))} />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                name="Forecast"
                stroke="#c45c26"
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartChrome>
      )}

      <MotionCard interactive={false} className="mt-card">
        <h2>
          <Activity size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
          Cost & profit per item
        </h2>
        <p className="hint-inline">
          Edit <strong>Cost/srv</strong> (€ food cost). Profit and margin update from sold tickets.
          Combos: food only — drink extras are set under Orders → Menu prices.
        </p>
        {profits.length === 0 ? (
          <p className="hint-inline" style={{ marginTop: 8 }}>
            No sold items yet.
          </p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 8, overflowX: 'auto' }}>
            <table className="profit-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Sold</th>
                  <th className="num">Cost/srv €</th>
                  <th className="num">Profit</th>
                  <th className="num">Margin</th>
                </tr>
              </thead>
              <tbody>
                {profits.slice(0, 12).map((r) => {
                  const item = menuById.get(r.menuItemId)
                  const foodCost = item?.foodCost ?? r.costPerServing
                  return (
                    <tr key={r.menuItemId}>
                      <td>
                        {r.name}
                        {item?.kind === 'combo' && (
                          <div className="hint-inline">Combo food cost (excl. drink)</div>
                        )}
                      </td>
                      <td className="num">
                        <strong>{r.qty}</strong>
                      </td>
                      <td className="num">
                        <input
                          className="input-tiny profit-cost-input"
                          type="number"
                          min={0}
                          step={0.1}
                          value={Number.isFinite(foodCost) ? foodCost : 0}
                          aria-label={`Cost per serving for ${r.name}`}
                          onChange={(e) =>
                            setMenuFoodCost(r.menuItemId, Number(e.target.value) || 0)
                          }
                        />
                      </td>
                      <td className="num">
                        <Money value={r.profit} colored />
                      </td>
                      <td className="num">{r.marginPct}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </MotionCard>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem',
          marginTop: '1rem',
        }}
      >

        <MotionCard interactive={false}>
          <h2>
            <TrendingUp size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
            AI demand prediction
          </h2>
          {demand.length === 0 ? (
            <p className="hint-inline">Need more POS history to predict demand.</p>
          ) : (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {demand.slice(0, 10).map((d) => (
                <li key={d.name} style={{ marginBottom: 6 }}>
                  <strong>{d.name}</strong> — next period ~{d.predictedQty}{' '}
                  <span className="hint-inline">
                    (recent {d.recentQty}, {d.trend})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </MotionCard>

        <MotionCard interactive={false}>
          <h2>
            <Sparkles size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
            Combo recommendations
          </h2>
          {combos.length === 0 ? (
            <p className="hint-inline">Sell multi-item tickets to discover pairs.</p>
          ) : (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {combos.map((c) => (
                <li key={`${c.a}-${c.b}`} style={{ marginBottom: 8 }}>
                  <strong>
                    {c.a} + {c.b}
                  </strong>
                  <div className="hint-inline">
                    {c.together}× together · lift {c.lift} — {c.hint}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </MotionCard>
      </div>

      {profits.length > 0 && (
        <ChartChrome title="Profit by item" className="mt-card">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={profits.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tickFormatter={euroFull} width={48} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => euroFull(Number(v ?? 0))} />
              <Bar dataKey="profit" name="Profit" radius={[6, 6, 0, 0]}>
                {profits.slice(0, 8).map((r) => (
                  <Cell
                    key={r.menuItemId}
                    fill={r.profit >= 0 ? 'var(--accent)' : '#c45c26'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartChrome>
      )}
    </section>
  )
}
