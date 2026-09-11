import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import {
  CONCEPTS,
  DECISION,
  MENU_SIZE_SIGNALS,
  OBSERVED_PRICES,
  VENUES,
  schematicPoint,
  type City,
  type Venue,
} from '../lib/marketAnalysis'
import { markLabel, NASTA_MARKS, venueMarks } from '../lib/nastaMarks'

const LEAF = '#1f3d2b'
const GOLD = '#b8923a'
const AMBER = '#d97706'
const ROSE = '#9f1239'
const TIP = {
  borderRadius: 12,
  border: '1px solid rgba(15,17,21,0.1)',
  background: '#fff',
  fontSize: 12,
}

export function MaChartFrame({
  title,
  hint,
  children,
  tall,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  tall?: boolean
}) {
  return (
    <div className="ma-chart">
      <div className="ma-chart__head">
        <h3>{title}</h3>
        {hint ? <p>{hint}</p> : null}
      </div>
      <div className={tall ? 'ma-chart__box ma-chart__box--tall' : 'ma-chart__box'}>{children}</div>
    </div>
  )
}

export function CityCompareChart() {
  const data = [
    { metric: 'Residents (000s)', Köln: 1100, Bonn: 342 },
    { metric: 'Students (000s)', Köln: 105, Bonn: 39 },
    { metric: 'Jobs at workplace (000s)', Köln: 632, Bonn: 195 },
    { metric: 'Sample open venues', Köln: VENUES.filter((v) => v.city === 'Köln' && v.status === 'Open').length, Bonn: VENUES.filter((v) => v.city === 'Bonn' && v.status === 'Open' && v.id !== 'himalayak-bonn').length },
  ]
  return (
    <MaChartFrame title="Köln vs Bonn scale" hint="Residents: city registers 31.12.2025 (Köln 1.100.076 · Bonn 342.152). Jobs: BA 30.06.2025. Students: MLP 2025. Venues: this sample only.">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,17,21,0.08)" />
          <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={TIP} />
          <Legend />
          <Bar dataKey="Köln" fill={LEAF} radius={[6, 6, 0, 0]} />
          <Bar dataKey="Bonn" fill={GOLD} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </MaChartFrame>
  )
}

export function ConceptRadar() {
  const data = [
    { axis: 'Demand', ...Object.fromEntries(CONCEPTS.map((c) => [c.id, c.demand])) },
    { axis: 'Gap', ...Object.fromEntries(CONCEPTS.map((c) => [c.id, c.gap])) },
    { axis: 'Diff.', ...Object.fromEntries(CONCEPTS.map((c) => [c.id, c.differentiation])) },
    { axis: 'Ops', ...Object.fromEntries(CONCEPTS.map((c) => [c.id, c.ops])) },
    { axis: 'Finance', ...Object.fromEntries(CONCEPTS.map((c) => [c.id, c.finance])) },
  ]
  return (
    <MaChartFrame title="Concept shape (selected scores)" hint="0–10 explicit components. Not a forecast.">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke="rgba(15,17,21,0.12)" />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
          <Radar name="South Indian veg" dataKey="south-veg-fast" stroke={LEAF} fill={LEAF} fillOpacity={0.25} />
          <Radar name="Vegan Indian" dataKey="vegan-indian" stroke={ROSE} fill={ROSE} fillOpacity={0.12} />
          <Radar name="Lunch / thali" dataKey="lunch-thali" stroke={GOLD} fill={GOLD} fillOpacity={0.12} />
          <Legend />
          <Tooltip contentStyle={TIP} />
        </RadarChart>
      </ResponsiveContainer>
    </MaChartFrame>
  )
}

export function ConceptBars() {
  const data = CONCEPTS.map((c) => ({ name: c.name.replace(' restaurant', '').replace(' Indian', ''), score: c.score }))
  return (
    <MaChartFrame title="Opportunity score by concept" hint="Mean of nine stated components. Higher is more attractive on this wave.">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 28, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,17,21,0.08)" />
          <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={TIP} />
          <Bar dataKey="score" radius={[0, 6, 6, 0]}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.score >= 7 ? LEAF : d.score >= 5.5 ? GOLD : ROSE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </MaChartFrame>
  )
}

export function ReviewGrowthChart() {
  const hasHistory = VENUES.some(
    (v) => v.google.growth30d != null || v.google.growth90d != null || v.google.growth12m != null,
  )
  const data = [
    { window: '30 days', reviews: 0 },
    { window: '90 days', reviews: 0 },
    { window: '365 days', reviews: 0 },
  ]
  return (
    <MaChartFrame
      title="Review growth (30 / 90 / 365)"
      hint={hasHistory ? 'Change vs a stored earlier snapshot.' : 'Needs a second rating snapshot. Growth is unknown — not zero.'}
    >
      {hasHistory ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,17,21,0.08)" />
            <XAxis dataKey="window" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={TIP} />
            <Bar dataKey="reviews" fill={LEAF} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="ma-emptychart">
          <strong>Not available yet</strong>
          <p>Store a second rating snapshot to calculate 30 / 90 / 365-day growth.</p>
        </div>
      )}
    </MaChartFrame>
  )
}

export function VolumeChart() {
  const data = VENUES.filter((v) => v.google.reviewCount != null && v.status === 'Open')
    .map((v) => ({
      name: v.name.replace(/ \(.*/, '').slice(0, 22),
      reviews: v.google.reviewCount as number,
      rating: v.google.rating,
    }))
    .sort((a, b) => b.reviews - a.reviews)
    .slice(0, 10)
  return (
    <MaChartFrame title="Highest review-count snapshots" hint="Stored aggregator counts — not live Google." tall>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,17,21,0.08)" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={TIP} />
          <Bar dataKey="reviews" fill={LEAF} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </MaChartFrame>
  )
}

export function PriceChart() {
  const data = OBSERVED_PRICES.map((p) => ({ name: p.label.slice(0, 28), eur: p.eur, kind: p.kind }))
  return (
    <MaChartFrame title="Observed prices (menus / press)" hint="Only sourced euros. Not a market average. Buffet €14.90 is the lunch ceiling." tall>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ bottom: 64 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,17,21,0.08)" />
          <XAxis dataKey="name" interval={0} angle={-36} textAnchor="end" tick={{ fontSize: 10 }} />
          <YAxis unit="€" tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={TIP}
            formatter={(v) => [`${Number(v ?? 0).toFixed(2)} €`, 'Price']}
          />
          <Bar dataKey="eur" fill={AMBER} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </MaChartFrame>
  )
}

export function MenuSizeChart() {
  return (
    <MaChartFrame title="Menu size signals" hint="Dish counts from speisekarte.de / menusweb — directory cards, not audited recipes.">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...MENU_SIZE_SIGNALS]} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,17,21,0.08)" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={TIP} />
          <Bar dataKey="dishes" fill={GOLD} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </MaChartFrame>
  )
}

export function RatingScatter() {
  const data = VENUES.filter((v) => v.google.rating != null && v.google.reviewCount != null).map((v) => ({
    name: v.name,
    rating: v.google.rating as number,
    reviews: v.google.reviewCount as number,
    city: v.city,
  }))
  return (
    <MaChartFrame title="Rating vs review volume" hint="A 4.9 from 50 reviews is not stronger than 4.5 from 5,000.">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,17,21,0.08)" />
          <XAxis type="number" dataKey="reviews" name="Reviews" tick={{ fontSize: 11 }} />
          <YAxis type="number" dataKey="rating" name="Rating" domain={[3.4, 5]} tick={{ fontSize: 11 }} />
          <ZAxis range={[60, 60]} />
          <Tooltip contentStyle={TIP} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={data.filter((d) => d.city === 'Köln')} name="Köln" fill={LEAF} />
          <Scatter data={data.filter((d) => d.city === 'Bonn')} name="Bonn" fill={GOLD} />
          <Legend />
        </ScatterChart>
      </ResponsiveContainer>
    </MaChartFrame>
  )
}

export function FinanceChart({
  rows,
}: {
  rows: { name: string; sales: number; costs: number; result: number }[]
}) {
  return (
    <MaChartFrame title="Modelled monthly P&L" hint="Assumptions on the finance section — not observed restaurant accounts.">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,17,21,0.08)" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={TIP} />
          <Legend />
          <Bar dataKey="sales" name="Sales" fill={LEAF} radius={[6, 6, 0, 0]} />
          <Bar dataKey="costs" name="Costs" fill={AMBER} radius={[6, 6, 0, 0]} />
          <Bar dataKey="result" name="Result" fill={GOLD} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </MaChartFrame>
  )
}

function statusColor(v: Venue) {
  if (v.status === 'Permanently closed') return ROSE
  if (v.status === 'Unknown') return AMBER
  if (v.cuisine.some((c) => /South|Tamil/.test(c)) || v.dosa === true) return GOLD
  return LEAF
}

export function SchematicMap({ city }: { city: City }) {
  const [hover, setHover] = useState<Venue | null>(null)
  const plotted = useMemo(() => {
    const list = VENUES.filter((v) => v.city === city)
    const counts = new Map<string, number>()
    return list
      .map((v) => {
        const p = schematicPoint(v)
        if (!p) return null
        const n = counts.get(v.district) ?? 0
        counts.set(v.district, n + 1)
        const jitter = (n - 1) * 3.2
        return { v, x: Math.min(94, p.x + jitter), y: Math.min(92, p.y + (n % 2 ? 2.4 : 0)) }
      })
      .filter((x): x is { v: Venue; x: number; y: number } => x != null)
  }, [city])

  return (
    <div className="ma-mapcard">
      <div className="ma-chart__head">
        <h3>{city} — schematic competition map</h3>
        <p>
          District positions are relative, not GPS. Pins without a known district are omitted. Rhine is a sketch.
          Last checked 8 Sep 2026.
        </p>
      </div>
      <svg viewBox="0 0 100 100" className="ma-svgmap" role="img" aria-label={`${city} schematic restaurant map`}>
        <rect x="0" y="0" width="100" height="100" fill="#eef1ec" />
        {city === 'Köln' ? (
          <path d="M58 4 C62 22 64 40 66 58 C68 74 72 88 78 98" fill="none" stroke="#7a9bb4" strokeWidth="3.2" />
        ) : (
          <path d="M60 2 C62 24 63 46 64 68 C65 82 68 94 70 100" fill="none" stroke="#7a9bb4" strokeWidth="3.2" />
        )}
        <text x="4" y="7" fontSize="3.2" fill="#7a8494">
          N
        </text>
        {plotted.map(({ v, x, y }) => (
          <g key={v.id} onMouseEnter={() => setHover(v)} onMouseLeave={() => setHover(null)}>
            <circle cx={x} cy={y} r={v.status === 'Open' ? 2.1 : 1.7} fill={statusColor(v)} opacity={0.92} />
          </g>
        ))}
      </svg>
      <div className="ma-mapleg">
        <span>
          <i style={{ background: LEAF }} /> Open North / mixed
        </span>
        <span>
          <i style={{ background: GOLD }} /> South Indian / dosa
        </span>
        <span>
          <i style={{ background: AMBER }} /> Unknown
        </span>
        <span>
          <i style={{ background: ROSE }} /> Closed
        </span>
      </div>
      {hover && (
        <p className="ma-maptip">
          <strong>{hover.name}</strong> · {hover.district} · {hover.status} · {hover.format}
        </p>
      )}
    </div>
  )
}

export function ComparePicker() {
  const [a, setA] = useState('ginti-belgisches')
  const [b, setB] = useState('chennai-chef')
  const [c, setC] = useState('taste-sued-bonn')
  const picks = [a, b, c]
    .map((id) => VENUES.find((v) => v.id === id))
    .filter((v): v is Venue => !!v)
  const nasta = NASTA_MARKS
  const fields: [string, (v: Venue) => string][] = [
    ['Concept', (v) => v.format],
    ['Price', (v) => v.price],
    ['Rating', (v) => (v.google.rating != null ? `${v.google.rating.toFixed(1)} ★` : 'Not retrieved')],
    ['Reviews', (v) => (v.google.reviewCount != null ? v.google.reviewCount.toLocaleString('de-DE') : 'Not retrieved')],
    ['Veg', (v) => v.veg],
    ['Vegan', (v) => v.vegan],
    ['Dosa', (v) => (v.dosa === 'Not verified' ? 'Not verified' : v.dosa ? 'Yes' : 'Recorded as no')],
    ['Idli', (v) => (markLabel(venueMarks(v).idli) === 'unk' ? 'Not verified' : markLabel(venueMarks(v).idli) === 'yes' ? 'Mentioned' : 'Not tagged')],
    ['Lunch', (v) => (v.lunch === 'Not verified' ? 'Not verified' : v.lunch ? 'Yes' : 'Recorded as no')],
    ['Location', (v) => `${v.city} · ${v.district}`],
    ['Delivery', (v) => (v.delivery === 'Not verified' ? 'Not verified' : v.delivery ? 'Yes' : 'Recorded as no')],
    ['Strengths', (v) => v.strengths],
    ['Weaknesses', (v) => v.weaknesses],
    ['Threat', (v) => ((v.google.reviewCount ?? 0) >= 1000 && v.status === 'Open' ? 'High review volume' : v.status === 'Permanently closed' ? 'Closed — not a living threat' : 'Medium / unproven')],
  ]
  const nastaCol: Record<string, string> = {
    Concept: 'Street food → fast-casual',
    Price: '€ / under the €14.90 buffet',
    Rating: 'Not a restaurant listing',
    Reviews: 'Use stall sales, not stars',
    Veg: '100% vegetarian menu',
    Vegan: 'Dosa / idli / sambar can be vegan-marked',
    Dosa: 'Yes (stall menu)',
    Idli: 'Yes (stall menu)',
    Lunch: 'Yes (daytime stalls)',
    Location: 'Köln / Bonn stall streets — no room yet',
    Delivery: 'Not a restaurant listing',
    Strengths: nasta.note,
    Weaknesses: 'No permanent room yet',
    Threat: 'Not an incumbent',
  }
  return (
    <div className="ma-compare">
      <div className="ma-filters">
        <select value={a} onChange={(e) => setA(e.target.value)}>
          {VENUES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select value={b} onChange={(e) => setB(e.target.value)}>
          {VENUES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select value={c} onChange={(e) => setC(e.target.value)}>
          {VENUES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div className="ma-table-wrap ma-compare__scroll">
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Nasta vs them</th>
              {picks.map((v) => (
                <th key={v.id}>{v.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map(([label, fn]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>
                  <div className="ma-compare__cell">{nastaCol[label] || '—'}</div>
                </td>
                {picks.map((v) => (
                  <td key={v.id}>
                    <div className="ma-compare__cell">{fn(v)}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <article className="ma-card">
        <h3>Where we can differentiate</h3>
        <p>{DECISION.find((d) => d.q.includes('meaningfully different'))?.a}</p>
      </article>
    </div>
  )
}

export function HoursGrid() {
  const rows = VENUES.filter((v) => v.status === 'Open').map((v) => ({
    name: v.name,
    city: v.city,
    breakfast: v.breakfast,
    lunch: v.lunch,
    dinner: v.dinner,
    sunday: v.sunday,
  }))
  const cell = (f: boolean | 'Not verified') =>
    f === true ? 'yes' : f === false ? 'no' : 'unk'
  return (
    <div className="ma-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Open business</th>
            <th>Breakfast</th>
            <th>Lunch</th>
            <th>Dinner</th>
            <th>Sunday</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>
                {r.name} <span className="ma-ev">{r.city}</span>
              </td>
              {(['breakfast', 'lunch', 'dinner', 'sunday'] as const).map((k) => (
                <td key={k}>
                  <span className={`ma-hour ma-hour--${cell(r[k])}`}>{cell(r[k])}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
