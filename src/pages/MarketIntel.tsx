import { useState } from 'react'
import { RESEARCH_SOURCES } from '../lib/marketAnalysis'
import {
  dataStatusRows,
  generateVerdict,
  overallOpportunity,
  pageRecommendation,
  type EvidenceKind,
  type ScorePart,
} from '../lib/marketDecision'
import type { CityMode } from '../lib/marketKpis'

export function LayerBadge({ kind }: { kind: EvidenceKind }) {
  const label =
    kind === 'observed'
      ? 'Observed'
      : kind === 'calculated'
        ? 'Calculated'
        : kind === 'assumption'
          ? 'Assumption'
          : kind === 'model'
            ? 'Model calculation'
            : 'Interpretation'
  return <span className={`ma-layer ma-layer--${kind}`}>{label}</span>
}

export function DataStatusBlock() {
  const [open, setOpen] = useState(false)
  const rows = dataStatusRows()
  return (
    <section className="ma-datastatus">
      <header>
        <h3>Data status</h3>
        <button type="button" className="ma-btn ma-btn--ghost" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide sources' : 'View sources'}
        </button>
      </header>
      <ul>
        {rows.map((r) => (
          <li key={r.id}>
            <strong>{r.label}</strong>
            <span>Last checked: {r.last}</span>
            <em>{r.state}</em>
            <small>{r.detail}</small>
          </li>
        ))}
      </ul>
      {open && (
        <div className="ma-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Group</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {RESEARCH_SOURCES.map((s) => (
                <tr key={`${s.group}-${s.name}`}>
                  <td>{s.group}</td>
                  <td>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.name}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function ScoreExplain({ part, onClose }: { part: ScorePart; onClose: () => void }) {
  return (
    <div className="ma-ksheet" role="dialog" aria-modal="true" aria-label={part.label} onClick={onClose}>
      <div className="ma-ksheet__panel" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h3>
              {part.label}
              {part.score != null ? ` · ${part.score}/100` : ' · Insufficient evidence'}
            </h3>
            <p>
              <LayerBadge kind={part.kind} /> Confidence: {part.confidence}
            </p>
          </div>
          <button type="button" className="ma-btn ma-btn--ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <p>
          <strong>Method.</strong> {part.method}
        </p>
        <p>
          <strong>Factors.</strong>
        </p>
        <ul>
          {part.factors.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p>
          <strong>Sources.</strong> {part.sources.join(' · ')}
        </p>
        <p className="ma-ev">Completeness: {part.completeness}</p>
      </div>
    </div>
  )
}

export function OpportunityScore({ city }: { city: CityMode }) {
  const o = overallOpportunity(city)
  const [open, setOpen] = useState<ScorePart | null>(null)
  const [whyOpen, setWhyOpen] = useState(false)
  return (
    <section className="ma-mod ma-scoreboard">
      <header>
        <h3>Opportunity score</h3>
        <p>
          Weighted from the parts below. Not a forecast.{' '}
          <LayerBadge kind="calculated" />
        </p>
      </header>
      <div className="ma-scorehero">
        <b>{o.score != null ? o.score : '—'}</b>
        <span>/ 100</span>
        <button type="button" className="ma-scorehero__conf" onClick={() => setWhyOpen((v) => !v)}>
          Confidence: {o.confidence}
        </button>
      </div>
      <ul className="ma-scoreparts">
        {o.parts.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => setOpen(p)}>
              <span>{p.label}</span>
              <strong>{p.score != null ? p.score : '—'}</strong>
              <small>Why this score →</small>
            </button>
          </li>
        ))}
      </ul>
      {whyOpen && (
        <ul className="ma-scorewhy">
          {o.missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {open && <ScoreExplain part={open} onClose={() => setOpen(null)} />}
    </section>
  )
}

export function MarketVerdict({ city }: { city: CityMode }) {
  const v = generateVerdict(city)
  return (
    <section className={`ma-verdict ma-verdict--${v.tone}`}>
      <p className="ma-kicker">
        Market opportunity <LayerBadge kind="interpretation" />
      </p>
      <h2>{v.headline}</h2>
      <p>{v.cityLine}</p>
      <div className="ma-verdict__cols">
        <div>
          <h4>Why</h4>
          <ul>
            {v.why.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Main risk</h4>
          <ul>
            {v.risks.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="ma-ev">Leading concept: {v.best.name} ({v.best.score}/100).</p>
    </section>
  )
}

export function RecBlock({
  page,
  city,
}: {
  page: 'overview' | 'competitors' | 'map' | 'customers' | 'opportunities' | 'case'
  city: CityMode
}) {
  const r = pageRecommendation(page, city)
  return (
    <section className="ma-rec">
      <h3>Recommendation</h3>
      <p>{r.recommendation}</p>
      <h4>Next action</h4>
      <p>{r.next}</p>
      <h4>Evidence needed</h4>
      <ul>
        {r.missing.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </section>
  )
}

export function GrowthUnavailable() {
  return (
    <div className="ma-emptychart">
      <strong>Not available yet</strong>
      <p>Store a second rating snapshot to calculate 30 / 90 / 365-day growth.</p>
    </div>
  )
}
