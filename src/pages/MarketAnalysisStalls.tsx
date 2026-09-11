import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useData } from '../context/DataContext'
import { useStallOps } from '../context/StallOpsContext'
import { buildStallEvidence } from '../lib/stallMarketEvidence'
import { buildSalesReport } from '../lib/salesStats'
import { MaChartFrame } from './MarketAnalysisCharts'

function money(n: number, digits = 0) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: digits })
}

export function useStallEvidence() {
  const { metrics } = useData()
  const { orders } = useStallOps()
  return useMemo(() => {
    const sales = buildSalesReport(orders)
    return buildStallEvidence(metrics?.byEvent || [], sales.byItem)
  }, [metrics, orders])
}

export function StallEvidenceSection() {
  const ev = useStallEvidence()

  if (ev.eventCount === 0) {
    return (
      <div className="ma-callout ma-callout--warn">
        <strong>No completed stall sales in the loaded books.</strong> When events with income are synced,
        this section uses those sales and locations as first-party demand. Stall fees stay out — they are
        event rent, not restaurant rent.
      </div>
    )
  }

  const locChart = ev.byLocation.slice(0, 8).map((r) => ({
    name: r.location.length > 22 ? `${r.location.slice(0, 20)}…` : r.location,
    salesPerDay: Number(r.salesPerDay.toFixed(0)),
  }))

  return (
    <>
      <p>
        These are the stalls you already ran to test the food. Numbers below are <strong>sales (income)</strong>,
        location, days, and grocery as a food-cost hint. <strong>Stall fees are excluded</strong> — they do not
        tell you what a restaurant lease will cost.
      </p>
      <div className="ma-grid">
        <div className="ma-stat">
          <b>{ev.eventCount}</b>
          <span>Completed stalls with sales</span>
        </div>
        <div className="ma-stat">
          <b>{money(ev.totalSales)}</b>
          <span>Total stall sales · {ev.totalDays} stall-days</span>
        </div>
        <div className="ma-stat">
          <b>{money(ev.salesPerDay)}</b>
          <span>Average sales / stall-day</span>
        </div>
        <div className="ma-stat">
          <b>{ev.foodShare != null ? `${Math.round(ev.foodShare * 100)}%` : '—'}</b>
          <span>Grocery ÷ sales (food-cost hint, not restaurant COGS)</span>
        </div>
        <div className="ma-stat">
          <b>{ev.koeln ? money(ev.koeln.salesPerDay) : '—'}</b>
          <span>Köln sales / day · {ev.koeln?.events ?? 0} events</span>
        </div>
        <div className="ma-stat">
          <b>{ev.bonn ? money(ev.bonn.salesPerDay) : '—'}</b>
          <span>Bonn sales / day · {ev.bonn?.events ?? 0} events</span>
        </div>
      </div>
      <div className="ma-callout">
        <strong>What this is allowed to prove.</strong> People in these streets paid for Nasta dosa / idli /
        chai on market days. That supports “the food can sell” in Köln
        {ev.koeln ? ` (${money(ev.koeln.sales)} so far)` : ''}
        {ev.bonn ? ` and Bonn (${money(ev.bonn.sales)})` : ''}. It does <em>not</em> prove a 36-seat room will
        hit the finance slider. A stall-day of {money(ev.salesPerDay)} is roughly{' '}
        {Math.round(ev.salesPerDay / 13.5)} plates at a €13.50 lunch — use that as a reality check next to the
        model, not as a forecast.
        {ev.bestLocation
          ? ` Best street in the book: ${ev.bestLocation.location} at ${money(ev.bestLocation.salesPerDay)}/day.`
          : ''}
      </div>
      <div className="ma-charts">
        <MaChartFrame title="Sales per day by stall location" hint="Fee omitted. Grocery is not shown here.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={locChart} layout="vertical" margin={{ left: 8, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,17,21,0.08)" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid rgba(15,17,21,0.1)', fontSize: 12 }}
                formatter={(v) => [`${Number(v ?? 0).toFixed(0)} €`, 'Sales / day']}
              />
              <Bar dataKey="salesPerDay" fill="#1f3d2b" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </MaChartFrame>
      </div>
      <div className="ma-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Location</th>
              <th>City</th>
              <th>Days</th>
              <th>Sales</th>
              <th>Sales / day</th>
              <th>Grocery</th>
              <th>Grocery / sales</th>
            </tr>
          </thead>
          <tbody>
            {ev.soldEvents.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.id} · {e.name}
                </td>
                <td>{e.location}</td>
                <td>{e.city}</td>
                <td>{e.days}</td>
                <td>{money(e.sales, 2)}</td>
                <td>{money(e.salesPerDay, 2)}</td>
                <td>{money(e.grocery, 2)}</td>
                <td>{e.foodShare != null ? `${Math.round(e.foodShare * 100)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ev.topItems.length > 0 && (
        <>
          <h3>What actually sold (POS)</h3>
          <p className="ma-ev">Completed tickets only. This is the dish mix a restaurant card would inherit.</p>
          <div className="ma-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Sales</th>
                </tr>
              </thead>
              <tbody>
                {ev.topItems.map((i) => (
                  <tr key={i.menuItemId}>
                    <td>{i.name}</td>
                    <td>{i.qty}</td>
                    <td>{money(i.revenue, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
