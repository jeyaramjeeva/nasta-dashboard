import { useMemo, useState } from 'react'
import { MotionCard } from './MotionCard'
import { scoreMarktInvite } from '../lib/marktScore'
import type { EventMetrics } from '../types'

export function MarktApplyScore({ history }: { history: EventMetrics[] }) {
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [days, setDays] = useState(1)
  const [fee, setFee] = useState(0)
  const [eventType, setEventType] = useState('Streetfood')
  const [outdoor, setOutdoor] = useState(true)
  const [rainy, setRainy] = useState(false)

  const result = useMemo(
    () =>
      scoreMarktInvite(
        {
          location,
          startDate,
          days,
          fee,
          eventType,
          outdoor,
          rainyForecast: rainy,
        },
        history,
      ),
    [location, startDate, days, fee, eventType, outdoor, rainy, history],
  )

  const gradeClass = result.grade === 'Go' ? 'ok' : 'warn'

  return (
    <MotionCard interactive={false} className="markt-score-card">
      <div className="card-head">
        <h2>Should we apply?</h2>
        <span className={`badge ${gradeClass}`}>
          {result.score}/100 · {result.grade}
        </span>
      </div>
      <p className="hint-inline">
        Paste a new Markt invite — score uses past stalls at that city, weekend timing, and fee.
      </p>
      <div className="filters" style={{ marginTop: '0.65rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field">
          <label>Location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Wilhelmplatz, Köln"
          />
        </div>
        <div className="field">
          <label>Start</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Days</label>
          <input
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
            style={{ width: 70 }}
          />
        </div>
        <div className="field">
          <label>Fee €</label>
          <input
            type="number"
            min={0}
            value={fee}
            onChange={(e) => setFee(Number(e.target.value) || 0)}
            style={{ width: 90 }}
          />
        </div>
        <div className="field">
          <label>Type</label>
          <input
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder="Streetfood / Flohmarkt"
          />
        </div>
        <label className="chip" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={outdoor} onChange={(e) => setOutdoor(e.target.checked)} />{' '}
          Outdoor
        </label>
        <label className="chip" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={rainy} onChange={(e) => setRainy(e.target.checked)} /> Rain
          risk
        </label>
      </div>
      <p style={{ marginTop: '0.75rem' }}>{result.summary}</p>
      <ul className="markt-score-factors">
        {result.factors.map((f) => (
          <li key={f.label + f.note}>
            <strong className={f.impact >= 0 ? 'text-ok' : 'text-danger'}>
              {f.impact >= 0 ? '+' : ''}
              {f.impact}
            </strong>{' '}
            {f.label}: {f.note}
          </li>
        ))}
      </ul>
    </MotionCard>
  )
}
