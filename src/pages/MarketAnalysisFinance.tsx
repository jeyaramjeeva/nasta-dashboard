import { CONCEPTS, FINANCIAL_ASSUMPTIONS, MACRO, type City } from '../lib/marketAnalysis'
import type { StallEvidence } from '../lib/stallMarketEvidence'

function money(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

export function liveVerdict(opts: {
  conceptId: string
  city: City
  stalls: StallEvidence | null
}) {
  const concept = CONCEPTS.find((c) => c.id === opts.conceptId) ?? CONCEPTS[0]
  const stallLine = (() => {
    if (!opts.stalls || opts.stalls.eventCount === 0) {
      return 'No completed stall sales are loaded yet — the verdict is directory evidence only.'
    }
    const citySales =
      opts.city === 'Köln' ? opts.stalls.koeln : opts.city === 'Bonn' ? opts.stalls.bonn : null
    const loc = opts.stalls.bestLocation
    const cityBit = citySales
      ? ` Your own stalls already sold ${money(citySales.sales)} of South Indian street food in ${opts.city} (${citySales.events} events, ${money(citySales.salesPerDay)}/day). That is demand for the food, not for a 90 m² room.`
      : ` Your stalls sold ${money(opts.stalls.totalSales)} overall, but little or none of that is booked in ${opts.city} yet.`
    const locBit = loc
      ? ` Strongest stall street so far: ${loc.location} at ${money(loc.salesPerDay)}/day.`
      : ''
    return cityBit + locBit
  })()

  if (concept.id === 'vegan-indian') {
    return {
      title: `Do not open a vegan-only Indian restaurant in ${opts.city} on this evidence.`,
      body: `The dedicated vegan-Indian room is almost empty and unproven. Govardhan converted; Nishas is Unknown. Mixed rooms already mark vegan dishes.${stallLine} Your stall menu is vegetarian with vegan-capable dosa/idli — that is a label, not a vegan-only dining room.`,
      tone: 'bad' as const,
    }
  }
  if (concept.id === 'south-veg-fast' && opts.city === 'Köln') {
    return {
      title: 'Köln: South Indian vegetarian fast-casual with weekday lunch is the least-bad test.',
      body: `Not another North Indian room, and not on Händelstraße. Price at or under the €14.90 buffet. Chennai Chef already owns “authentic dinner” in Riehl.${stallLine} Next proof is a weekday lunch street with footfall — the map rings are for that walk.`,
      tone: 'ok' as const,
    }
  }
  if (concept.id === 'south-veg-fast' && opts.city === 'Bonn') {
    return {
      title: 'Bonn only if a campus or Godesberg street is actually empty — check on foot.',
      body: `Taste of India Süd already does South Indian in Kessenich; Markt 100 holds centre street-food.${stallLine} Do not treat “Bonn is smaller” as a gap.`,
      tone: 'warn' as const,
    }
  }
  if (concept.score < 5.5) {
    return {
      title: `Do not open “${concept.name}” in ${opts.city} on this wave.`,
      body: `${concept.risks} ${stallLine}`,
      tone: 'bad' as const,
    }
  }
  return {
    title: `${opts.city}: ${concept.name} is only a test, not a default yes.`,
    body: `${concept.advantage} Risk: ${concept.risks}${stallLine}`,
    tone: concept.score >= 6.5 ? ('ok' as const) : ('warn' as const),
  }
}

export function VerdictCard({
  conceptId,
  city,
  onConcept,
  onCity,
  stalls,
}: {
  conceptId: string
  city: City
  onConcept: (id: string) => void
  onCity: (c: City) => void
  stalls: StallEvidence | null
}) {
  const v = liveVerdict({ conceptId, city, stalls })
  const concept = CONCEPTS.find((c) => c.id === conceptId)
  return (
    <section className="ma-verdict" id="verdict">
      <p className="ma-kicker">One-page verdict · updates with city / concept</p>
      <div className="ma-ask">
        <label>
          Concept
          <select value={conceptId} onChange={(e) => onConcept(e.target.value)}>
            {CONCEPTS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.score.toFixed(1)}/10
              </option>
            ))}
          </select>
        </label>
        <label>
          City
          <select value={city} onChange={(e) => onCity(e.target.value as City)}>
            <option>Köln</option>
            <option>Bonn</option>
          </select>
        </label>
      </div>
      <h2 className={`ma-verdict__title ma-verdict__title--${v.tone}`}>{v.title}</h2>
      <p>{v.body}</p>
      {concept && (
        <p className="ma-ev">
          Score {concept.score.toFixed(1)}/10 · {concept.evidence}
        </p>
      )}
    </section>
  )
}

export type FinanceState = {
  coversLunch: number
  coversDinner: number
  spendLunch: number
  spendDinner: number
  rentM2: number
  sizeM2: number
  cooks: number
  hours: number
}

export const DEFAULT_FINANCE: FinanceState = {
  coversLunch: 32,
  coversDinner: 26,
  spendLunch: 13.5,
  spendDinner: 18.5,
  rentM2: (FINANCIAL_ASSUMPTIONS.rentPerM2Low + FINANCIAL_ASSUMPTIONS.rentPerM2High) / 2,
  sizeM2: FINANCIAL_ASSUMPTIONS.sizeM2,
  cooks: 3,
  hours: 10,
}

export function modelFinance(s: FinanceState) {
  const a = FINANCIAL_ASSUMPTIONS
  const lunchSales = s.coversLunch * s.spendLunch
  const dinnerSales = s.coversDinner * s.spendDinner
  const daily = lunchSales + dinnerSales
  const monthly = daily * a.daysOpen
  const food = monthly * a.foodPct
  const labour = s.cooks * MACRO.minWage.value * s.hours * a.daysOpen
  const rent = s.sizeM2 * s.rentM2
  const delivery = monthly * a.base.deliveryShare * a.deliveryCommission
  const other = monthly * a.otherPct
  const result = monthly - food - labour - rent - delivery - other
  const contribLunch = s.spendLunch * (1 - a.foodPct - a.otherPct - a.base.deliveryShare * a.deliveryCommission)
  const contribDinner = s.spendDinner * (1 - a.foodPct - a.otherPct - a.base.deliveryShare * a.deliveryCommission)
  const dinnerContribMonth = s.coversDinner * contribDinner * a.daysOpen
  const lunchContribMonth = s.coversLunch * contribLunch * a.daysOpen
  const fixed = rent + labour
  const beLunch =
    contribLunch > 0 ? Math.max(0, (fixed + delivery + other - dinnerContribMonth) / (contribLunch * a.daysOpen)) : Infinity
  const beDinner =
    contribDinner > 0 ? Math.max(0, (fixed + delivery + other - lunchContribMonth) / (contribDinner * a.daysOpen)) : Infinity
  return { daily, monthly, food, labour, rent, delivery, other, result, beLunch, beDinner, lunchSales, dinnerSales }
}

export function WhatIfFinance({
  state,
  onChange,
}: {
  state: FinanceState
  onChange: (next: FinanceState) => void
}) {
  const m = modelFinance(state)
  const set = (patch: Partial<FinanceState>) => onChange({ ...state, ...patch })
  return (
    <div className="ma-card">
      <h3>What-if room (assumptions you can drag)</h3>
      <p className="ma-ev">
        Rent = size × €/m². Labour = cooks × €{MACRO.minWage.value.toFixed(2)}/h × hours × {FINANCIAL_ASSUMPTIONS.daysOpen}{' '}
        days. Food {Math.round(FINANCIAL_ASSUMPTIONS.foodPct * 100)}% of sales. Not a forecast.
      </p>
      <div className="ma-sliders">
        <label className="ma-slider">
          Rent €{state.rentM2.toFixed(0)} / m²
          <input
            type="range"
            min={12}
            max={45}
            value={state.rentM2}
            onChange={(e) => set({ rentM2: Number(e.target.value) })}
          />
        </label>
        <label className="ma-slider">
          Size {state.sizeM2} m²
          <input
            type="range"
            min={40}
            max={160}
            value={state.sizeM2}
            onChange={(e) => set({ sizeM2: Number(e.target.value) })}
          />
        </label>
        <label className="ma-slider">
          Cooks / FTE {state.cooks}
          <input
            type="range"
            min={1}
            max={8}
            value={state.cooks}
            onChange={(e) => set({ cooks: Number(e.target.value) })}
          />
        </label>
        <label className="ma-slider">
          Hours / day {state.hours}
          <input
            type="range"
            min={6}
            max={14}
            value={state.hours}
            onChange={(e) => set({ hours: Number(e.target.value) })}
          />
        </label>
        <label className="ma-slider">
          Lunch covers {state.coversLunch} · {state.spendLunch.toFixed(1)} €
          <input
            type="range"
            min={0}
            max={80}
            value={state.coversLunch}
            onChange={(e) => set({ coversLunch: Number(e.target.value) })}
          />
          <input
            type="range"
            min={8}
            max={24}
            step={0.5}
            value={state.spendLunch}
            onChange={(e) => set({ spendLunch: Number(e.target.value) })}
          />
        </label>
        <label className="ma-slider">
          Dinner covers {state.coversDinner} · {state.spendDinner.toFixed(1)} €
          <input
            type="range"
            min={0}
            max={80}
            value={state.coversDinner}
            onChange={(e) => set({ coversDinner: Number(e.target.value) })}
          />
          <input
            type="range"
            min={10}
            max={32}
            step={0.5}
            value={state.spendDinner}
            onChange={(e) => set({ spendDinner: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="ma-grid">
        <div className="ma-stat">
          <b>{money(m.monthly)}</b>
          <span>Modelled monthly sales</span>
        </div>
        <div className="ma-stat">
          <b>{money(m.rent)}</b>
          <span>Rent {state.sizeM2} m² × €{state.rentM2.toFixed(0)}</span>
        </div>
        <div className="ma-stat">
          <b>{money(m.labour)}</b>
          <span>
            {state.cooks} × €{MACRO.minWage.value.toFixed(2)} × {state.hours}h × {FINANCIAL_ASSUMPTIONS.daysOpen}
          </span>
        </div>
        <div className="ma-stat">
          <b>{money(m.result)}</b>
          <span>After food, labour, rent, delivery cut, other</span>
        </div>
        <div className="ma-stat">
          <b>{Number.isFinite(m.beLunch) ? m.beLunch.toFixed(0) : '—'}</b>
          <span>Break-even lunch covers / day (dinner held)</span>
        </div>
        <div className="ma-stat">
          <b>{Number.isFinite(m.beDinner) ? m.beDinner.toFixed(0) : '—'}</b>
          <span>Break-even dinner covers / day (lunch held)</span>
        </div>
      </div>
    </div>
  )
}
