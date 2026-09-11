import { useState } from 'react'
import {
  CONCEPTS,
  DECISION,
  DIRECTORY_SIGNALS,
  MACRO,
  MODELS,
  OBSERVED_PRICES,
  RED_FLAGS,
  RESEARCH_CHECKED_LABEL,
  RESEARCH_SOURCES,
  SAMPLE_NOTE,
  SEGMENTS,
  type City,
  type Venue,
} from '../lib/marketAnalysis'
import {
  buildKpis,
  cityPair,
  crowding,
  opportunityLabel,
  priceBands,
  recommendationTone,
  regionalCounts,
  type CityMode,
} from '../lib/marketKpis'
import { type KpiId } from '../lib/marketKpiDefs'
import { MarketKpiCard } from './MarketKpiCard'
import { CompetitorDatabase } from './MarketCompTable'
import { DataStatusBlock, LayerBadge, MarketVerdict, OpportunityScore, RecBlock } from './MarketIntel'
import { customerOpportunities, scoredConcepts } from '../lib/marketDecision'
import {
  CityCompareChart,
  ComparePicker,
  ConceptBars,
  ConceptRadar,
  FinanceChart,
  MenuSizeChart,
  PriceChart,
  RatingScatter,
  ReviewGrowthChart,
  VolumeChart,
} from './MarketAnalysisCharts'
import { DEFAULT_FINANCE, liveVerdict, modelFinance, WhatIfFinance, type FinanceState } from './MarketAnalysisFinance'
import { decisionSensitivity, defaultFinanceFromScenario, scenarioFinance } from '../lib/marketDecision'
import { StallEvidenceSection, useStallEvidence } from './MarketAnalysisStalls'
import { PeopleDemand } from './MarketPeople'

function money(n: number, d = 0) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: d })
}

function fmtRating(n: number | null) {
  return n == null ? '—' : `${n.toFixed(2)} ★`
}

export function KpiStrip({
  city,
  onOpenKpi,
  onOpenVenue,
}: {
  city: CityMode
  onOpenKpi: (id: KpiId) => void
  onOpenVenue?: (v: Venue) => void
}) {
  const k = buildKpis(city)
  const ids: KpiId[] = ['total']
  if (city !== 'Bonn') ids.push('koeln')
  if (city !== 'Köln') ids.push('bonn')
  ids.push('veg-focus', 'vegan-focus', 'closed')
  return (
    <div className="ma-kpi">
      {ids.map((id) => (
        <MarketKpiCard key={id} id={id} city={city} onOpenList={onOpenKpi} onOpenVenue={onOpenVenue} />
      ))}
      <div className="ma-stat">
        <b>{k.avgRating != null ? `${k.avgRating.toFixed(2)} ★` : '—'}</b>
        <span>Avg snapshot rating</span>
        <em>{k.ratedCount} rated businesses · not a live Google figure</em>
      </div>
      <div className="ma-stat">
        <b>{k.totalReviews.toLocaleString('de-DE')}</b>
        <span>Snapshot review sum</span>
        <em>{k.reviewedCount} businesses with a count · not live</em>
      </div>
    </div>
  )
}

export function OverviewView({
  city,
  onOpenOpp,
  onOpenVenue,
  onOpenKpi,
  go,
}: {
  city: CityMode
  onOpenOpp: (id: string) => void
  onOpenVenue: (v: Venue) => void
  onOpenKpi: (id: KpiId) => void
  go: (tab: string) => void
}) {
  const k = buildKpis(city)
  const pair = cityPair()
  const top = [...k.list]
    .filter((v) => v.google.reviewCount != null && v.status === 'Open')
    .sort((a, b) => (b.google.reviewCount ?? 0) - (a.google.reviewCount ?? 0))
    .slice(0, 5)

  return (
    <div className="ma-modstack">
      <MarketVerdict city={city} />
      <OpportunityScore city={city} />
      <DataStatusBlock />
      <KpiStrip city={city} onOpenKpi={onOpenKpi} onOpenVenue={onOpenVenue} />
      <p className="ma-ev">Hover a count for names. Click to open that list.</p>

      <section className="ma-mod">
        <header>
          <h3>Market snapshot</h3>
          <p>Sample only · last checked {RESEARCH_CHECKED_LABEL}. Directory Köln Indian listings: {DIRECTORY_SIGNALS.speisekarteKoelnCount.value}.</p>
        </header>
        <div className="ma-kpi ma-kpi--4">
          <MarketKpiCard id="open" city={city} onOpenList={onOpenKpi} onOpenVenue={onOpenVenue} />
          <MarketKpiCard id="veg-friendly" city={city} onOpenList={onOpenKpi} onOpenVenue={onOpenVenue} />
          <MarketKpiCard id="south" city={city} onOpenList={onOpenKpi} onOpenVenue={onOpenVenue} />
          <div className="ma-stat">
            <b>{k.avgMeal != null ? money(k.avgMeal, 2) : '—'}</b>
            <span>Avg observed dish ({k.priceN} priced items, not a census)</span>
          </div>
          <div className="ma-stat">
            <b>{k.densityKoeln.per10k.toFixed(2)}</b>
            <span>Köln sample open / 10k residents</span>
          </div>
          <div className="ma-stat">
            <b>{k.densityBonn.per10k.toFixed(2)}</b>
            <span>Bonn sample open / 10k residents</span>
          </div>
          <MarketKpiCard id="street" city={city} onOpenList={onOpenKpi} onOpenVenue={onOpenVenue} />
          <MarketKpiCard id="thali" city={city} onOpenList={onOpenKpi} onOpenVenue={onOpenVenue} />
          <MarketKpiCard id="buffet" city={city} onOpenList={onOpenKpi} onOpenVenue={onOpenVenue} />
          <MarketKpiCard id="delivery" city={city} onOpenList={onOpenKpi} onOpenVenue={onOpenVenue} />
        </div>
        <div className="ma-charts">
          <VolumeChart />
          <ConceptBars />
        </div>
      </section>

      <section className="ma-mod">
        <header>
          <h3>People base</h3>
          <p>Register / BA / tourism. Filters and the district heat sit under Customers → People.</p>
        </header>
        <div className="ma-kpi ma-kpi--4">
          <div className="ma-stat">
            <b>{MACRO.koelnPop.value.toLocaleString('de-DE')}</b>
            <span>Köln residents 31.12.2025 (register)</span>
          </div>
          <div className="ma-stat">
            <b>{MACRO.bonnPop.value.toLocaleString('de-DE')}</b>
            <span>Bonn residents 31.12.2025 (register)</span>
          </div>
          <div className="ma-stat">
            <b>4.186 / 2.459</b>
            <span>Indian nationality Köln 2025 · India-origin Bonn 2022</span>
          </div>
          <div className="ma-stat">
            <b>632k / 195k</b>
            <span>Jobs at workplace 30.06.2025 (BA)</span>
          </div>
        </div>
        <button type="button" className="ma-btn ma-btn--ghost" onClick={() => go('customers')}>
          Open people filters and heatmap
        </button>
      </section>

      <section className="ma-mod">
        <header>
          <h3>Market opportunity</h3>
          <p>Scores are the mean of nine stated components. Higher competition score in the file = easier / less crowded.</p>
        </header>
        <div className="ma-oppcards">
          {CONCEPTS.map((c) => (
            <button key={c.id} type="button" className="ma-opp" onClick={() => onOpenOpp(c.id)}>
              <span className="ma-opp__score">{c.score.toFixed(1)}</span>
              <strong>{c.name}</strong>
              <em>{opportunityLabel(c.score)}</em>
              <span>
                Demand {c.demand}/10 · crowding {crowding(c)}/10 · evidence in card
              </span>
            </button>
          ))}
        </div>
      </section>

      {city === 'Compare' && (
        <section className="ma-mod">
          <header>
            <h3>Köln vs Bonn</h3>
            <p>Do not force a single winner. Concept-dependent.</p>
          </header>
          <CityCompare />
        </section>
      )}

      <section className="ma-mod">
        <header>
          <h3>Strongest review-volume rooms</h3>
          <p>Google Maps copy 8 Sep 2026 where present. Click a name to open the panel.</p>
        </header>
        <div className="ma-minirows">
          {top.map((v) => (
            <button key={v.id} type="button" onClick={() => onOpenVenue(v)}>
              <b>{v.name}</b>
              <span>
                {v.city} · {v.google.rating} ★ · {v.google.reviewCount?.toLocaleString('de-DE')} reviews
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="ma-btn ma-btn--ghost" onClick={() => go('competitors')}>
          Open competitor database
        </button>
      </section>
      <RecBlock page="overview" city={city} />

      <p className="ma-ev">{SAMPLE_NOTE}</p>
      <p className="ma-ev">
        Köln {pair.köln.open} open / Bonn {pair.bonn.open} open in this sample. Register residents 31.12.2025: Köln{' '}
        {MACRO.koelnPop.value.toLocaleString('de-DE')} · Bonn {MACRO.bonnPop.value.toLocaleString('de-DE')} (Bonn official
        IT.NRW {MACRO.bonnPopOfficial.value.toLocaleString('de-DE')}). Students: Köln {MACRO.koelnStudents.value.toLocaleString('de-DE')} · Bonn{' '}
        {MACRO.bonnStudents.value.toLocaleString('de-DE')} (MLP 2025).
      </p>
    </div>
  )
}

function CityCompare() {
  const { köln: a, bonn: b } = cityPair()
  const rows: [string, string, string][] = [
    ['Records in sample', String(a.total), String(b.total)],
    ['Listed open', String(a.open), String(b.open)],
    ['Vegetarian-focused', String(a.vegFocused), String(b.vegFocused)],
    ['Vegan-focused', String(a.veganFocused), String(b.veganFocused)],
    ['Avg snapshot rating', fmtRating(a.avgRating), fmtRating(b.avgRating)],
    ['Snapshot reviews', a.totalReviews.toLocaleString('de-DE'), b.totalReviews.toLocaleString('de-DE')],
    ['Avg observed dish', a.avgMeal != null ? money(a.avgMeal, 2) : '—', b.avgMeal != null ? money(b.avgMeal, 2) : '—'],
    ['Sample open / 10k', a.densityKoeln.per10k.toFixed(2), b.densityBonn.per10k.toFixed(2)],
    ['Students (MLP 2025)', MACRO.koelnStudents.value.toLocaleString('de-DE'), MACRO.bonnStudents.value.toLocaleString('de-DE')],
    ['Residents (register 31.12.2025)', MACRO.koelnPop.value.toLocaleString('de-DE'), MACRO.bonnPop.value.toLocaleString('de-DE')],
    [
      'Indian / India-origin',
      '4.186 nationality (31.12.2025)',
      '2.459 origin (31.12.2022)',
    ],
    ['Employees at workplace (30.06.2025)', '631.907', '195.321'],
    ['Hotel arrivals 2025', '4.252.560', '802.103'],
  ]
  return (
    <>
      <CityCompareChart />
      <div className="ma-table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Köln</th>
              <th>Bonn</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([l, x, y]) => (
              <tr key={l}>
                <td>{l}</td>
                <td>{x}</td>
                <td>{y}</td>
              </tr>
            ))}
            <tr>
              <td>Best city by concept</td>
              <td colSpan={2}>
                Vegetarian lunch / South Indian: Köln leans better (larger TAM, weekday gap). Vegan-only: neither.
                Street food: neither centre is empty. Evidence moderate — walk the street.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}

export function CompetitorsView({
  city,
  onOpen,
  sub,
  kpiFilter,
  onClearKpi,
}: {
  city: CityMode
  onOpen: (v: Venue) => void
  sub: string
  kpiFilter: KpiId | null
  onClearKpi: () => void
}) {
  const scopeCity = city === 'Compare' ? 'All' : city

  return (
    <div className="ma-modstack">
      {sub === 'database' && (
        <CompetitorDatabase city={city} onOpen={onOpen} kpiFilter={kpiFilter} onClearKpi={onClearKpi} />
      )}

      {sub === 'compare' && (
        <section className="ma-mod">
          <ComparePicker />
        </section>
      )}

      {sub === 'ratings' && (
        <section className="ma-mod">
          <div className="ma-charts">
            <VolumeChart />
            <RatingScatter />
            <ReviewGrowthChart />
          </div>
        </section>
      )}

      {sub === 'prices' && (
        <section className="ma-mod">
          <PriceBands city={scopeCity} />
          <PriceChart />
        </section>
      )}

      {sub === 'menus' && (
        <section className="ma-mod">
          <MenuSizeChart />
        </section>
      )}
      <RecBlock page="competitors" city={city} />
    </div>
  )
}

function PriceBands({ city }: { city: CityMode }) {
  const bands = priceBands(city)
  return (
    <div className="ma-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Observed set</th>
            <th>n</th>
            <th>Average</th>
            <th>Median</th>
          </tr>
        </thead>
        <tbody>
          {bands.map((b) => (
            <tr key={b.kind}>
              <td>{b.kind}</td>
              <td>{b.n}</td>
              <td>{b.avg != null ? money(b.avg, 2) : '—'}</td>
              <td>{b.median != null ? money(b.median, 2) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ma-ev">
        Only dishes we actually recorded ({OBSERVED_PRICES.length} lines). Not an average of every menu in the city.
      </p>
    </div>
  )
}

export function CustomersView({ city, sub, onSub }: { city: CityMode; sub: string; onSub: (s: string) => void }) {
  const k = buildKpis(city)
  const targets = customerOpportunities(city)
  return (
    <div className="ma-modstack">
      <section className="ma-mod">
        <header>
          <h3>Target customer opportunity</h3>
          <p>
            Who should we serve? Potential labels are <LayerBadge kind="interpretation" />. Headcounts are{' '}
            <LayerBadge kind="observed" />.
          </p>
        </header>
        <div className="ma-targetgrid">
          {targets.map((t) => (
            <article key={t.name} className="ma-target">
              <h4>{t.name}</h4>
              <strong>{t.potential}</strong>
              <p>{t.sizeNote}</p>
              <p className="ma-ev">
                {t.why} · Evidence {t.evidence}
              </p>
            </article>
          ))}
        </div>
      </section>
      <nav className="ma-subnav">
        {['people', 'demand', 'sentiment', 'complaints', 'trends'].map((id) => (
          <button key={id} type="button" className={sub === id ? 'is-on' : ''} onClick={() => onSub(id)}>
            {id[0].toUpperCase() + id.slice(1)}
          </button>
        ))}
      </nav>
      {sub === 'people' && <PeopleDemand city={city} />}
      {sub === 'demand' && (
        <section className="ma-mod">
          <header>
            <h3>Demand signals</h3>
            <p>Separated by evidence strength. Stall sales are first-party; directory rarity is moderate; global vegan trends are not used.</p>
          </header>
          <div className="ma-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Segment</th>
                  <th>Relevance</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {SEGMENTS.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td>{s.relevance}</td>
                    <td>{s.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <StallEvidenceSection />
        </section>
      )}
      {sub === 'sentiment' && (
        <section className="ma-mod">
          <header>
            <h3>Review analysis</h3>
            <p>
              Average snapshot {fmtRating(k.avgRating)} · {k.totalReviews.toLocaleString('de-DE')} reviews across {k.reviewedCount} rooms.
              Topic % was not coded — bars below are qualitative presence, not percentages.
            </p>
          </header>
          <div className="ma-bars">
            {[
              ['Taste', 8],
              ['Authenticity / spice', 7],
              ['Price / value', 6],
              ['Portions', 5],
              ['Service at peak', 7],
              ['Vegetarian range', 7],
              ['Vegan labels', 4],
              ['Atmosphere', 5],
            ].map(([label, n]) => (
              <div className="ma-bar" key={label}>
                <span>{label}</span>
                <i style={{ width: `${Number(n) * 10}%` }} />
                <span>{n}</span>
              </div>
            ))}
          </div>
          <p className="ma-ev">Bar length is a research judgment (1–10 mention strength), not a computed share of reviews.</p>
          <p>
            <strong>Most praised:</strong> taste, veg breadth at Ginti/Masala/Mogul, dosa at Chennai Chef / Taste of India Süd, buffet value.
          </p>
          <p>
            <strong>Most complained about:</strong> peak waits, unmarked spice, weekday lunch closed at specialists, value/portions at some generalists.
          </p>
        </section>
      )}
      {sub === 'complaints' && (
        <section className="ma-mod">
          <ul>
            <li>Weekday South Indian lunch missing (Chennai Chef, HaldiSpoon dinner-heavy).</li>
            <li>Vegan dishes not labelled.</li>
            <li>Encyclopedia cards vs a set lunch.</li>
            <li>Isolated one-star hygiene notes are not treated as market evidence.</li>
          </ul>
        </section>
      )}
      {sub === 'trends' && (
        <section className="ma-mod">
          <ReviewGrowthChart />
          <p>Review growth is unknown until a second snapshot exists.</p>
        </section>
      )}
      <RecBlock page="customers" city={city} />
    </div>
  )
}

export function OpportunitiesView({
  city,
  sub,
  onSub,
  focusId,
  onOpenKpi,
  onOpenVenue,
}: {
  city: CityMode
  sub: string
  onSub: (s: string) => void
  focusId: string | null
  onOpenKpi: (id: KpiId) => void
  onOpenVenue?: (v: Venue) => void
}) {
  const regional = regionalCounts(city)
  const intel = scoredConcepts()
  const focus = CONCEPTS.find((c) => c.id === focusId) ?? CONCEPTS.find((c) => c.id === sub) ?? CONCEPTS[0]

  return (
    <div className="ma-modstack">
      <div className="ma-oppcards ma-oppcards--intel">
        {intel.map((c) => (
          <button key={c.id} type="button" className="ma-opp" onClick={() => onSub(c.id)}>
            <span className="ma-opp__score">{c.score}</span>
            <strong>{c.name}</strong>
            <em>
              {c.score}/100 · Confidence {c.confidence}
            </em>
            <span>
              Demand {c.demandLabel} · Competition {c.competitionLabel} · Price {c.priceLabel}
            </span>
            <span>
              Location {c.locationLabel} · Ops {c.opsLabel} · Risk {c.riskLabel}
            </span>
          </button>
        ))}
      </div>
      <nav className="ma-subnav">
        {['matrix', 'vegetarian', 'vegan', 'regional', 'location', 'concepts', 'activity'].map((id) => (
          <button key={id} type="button" className={sub === id || focusId === id ? 'is-on' : ''} onClick={() => onSub(id)}>
            {id[0].toUpperCase() + id.slice(1)}
          </button>
        ))}
      </nav>

      {(sub === 'matrix' || sub === 'concepts' || CONCEPTS.some((c) => c.id === sub)) && (
        <section className="ma-mod">
          <header>
            <h3>Opportunity matrix</h3>
            <p>X = crowding (10 − stored “competition ease”). Y = demand. Click a concept.</p>
          </header>
          <div className="ma-matrix">
            {CONCEPTS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`ma-dot ${focus?.id === c.id ? 'is-on' : ''}`}
                style={{ left: `${crowding(c) * 10}%`, bottom: `${c.demand * 10}%` }}
                onClick={() => onSub(c.id)}
                title={c.name}
              >
                {c.score.toFixed(1)}
              </button>
            ))}
            <span className="ma-matrix__x">Crowding →</span>
            <span className="ma-matrix__y">Demand →</span>
          </div>
          {focus && (
            <article className="ma-card">
              <div className="ma-score">{intel.find((c) => c.id === focus.id)?.score ?? Math.round(focus.score * 10)}</div>
              <h3>{focus.name}</h3>
              <p>
                {opportunityLabel(focus.score)} · {intel.find((c) => c.id === focus.id)?.score}/100
              </p>
              <p>
                Demand {focus.demand}/10 · crowding {crowding(focus)}/10 · gap {focus.gap}/10 · ops {focus.ops}/10 ·
                finance {focus.finance}/10
              </p>
              <p>
                <strong>Why switch:</strong> {focus.advantage}
              </p>
              <p>
                <strong>Risk:</strong> {focus.risks}
              </p>
              <p className="ma-ev">
                <LayerBadge kind="interpretation" /> Mean of nine stored components × 10. {focus.evidence}
              </p>
              <p className="ma-ev">Confidence {intel.find((c) => c.id === focus.id)?.confidence}: {(intel.find((c) => c.id === focus.id)?.confidenceWhy ?? []).join(' · ')}</p>
            </article>
          )}
          <ConceptRadar />
        </section>
      )}

      {sub === 'vegetarian' && (
        <section className="ma-mod">
          <div className="ma-kpi ma-kpi--4">
            <MarketKpiCard id="veg-focus" city={city} onOpenList={onOpenKpi} onOpenVenue={onOpenVenue} />
            <MarketKpiCard id="veg-friendly" city={city} onOpenList={onOpenKpi} onOpenVenue={onOpenVenue} />
            <MarketKpiCard id="closed" city={city} onOpenList={onOpenKpi} onOpenVenue={onOpenVenue} />
            <div className="ma-stat">
              <b>5.6</b>
              <span>Concept score — 100% veg casual</span>
            </div>
          </div>
          <p>
            Confirmed 100% vegetarian Indian sit-down currently operating: none in Köln after Saravanaa Bhavan closed
            March 2026. Mixed rooms already sell paneer and dal. Gap with red flags — not “underserved vegetarians.”
          </p>
        </section>
      )}

      {sub === 'vegan' && (
        <section className="ma-mod">
          <div className="ma-kpi ma-kpi--4">
            <MarketKpiCard id="vegan-focus" city={city} onOpenList={onOpenKpi} onOpenVenue={onOpenVenue} />
            <div className="ma-stat">
              <b>4.3</b>
              <span>Concept score — vegan Indian</span>
            </div>
          </div>
          <p>
            No confirmed open 100% vegan Indian restaurant in Köln. Nishas Bonn claims 100% vegan and showed Closed —
            status Unknown. Do not open a vegan-only Indian room on this evidence.
          </p>
        </section>
      )}

      {sub === 'regional' && (
        <section className="ma-mod">
          <div className="ma-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cuisine bucket</th>
                  <th>Records</th>
                  <th>Avg snapshot rating</th>
                </tr>
              </thead>
              <tbody>
                {regional.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{r.count}</td>
                    <td>{fmtRating(r.avgRating)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ma-ev">
            Tamil / Gujarati / Bengali dedicated rooms: not verified (zero in this coding). Default card is North Indian.
            Directory: {DIRECTORY_SIGNALS.dosaKoeln.value} dosa / {DIRECTORY_SIGNALS.sambarKoeln.value} sambar vs{' '}
            {DIRECTORY_SIGNALS.speisekarteKoelnCount.value} Köln Indian listings.
          </p>
        </section>
      )}

      {sub === 'location' && (
        <section className="ma-mod">
          <div className="ma-map">
            <div className="ma-card">
              <h3>High competition</h3>
              <p>Köln Belgisches Viertel / Ring / Barbarossaplatz. Bonn Altstadt + Markt + Kessenich. Actual competitor pins.</p>
            </div>
            <div className="ma-card">
              <h3>Medium</h3>
              <p>Ehrenfeld, Sülz, Kalk, Porz, Beuel, Bad Godesberg.</p>
            </div>
            <div className="ma-card">
              <h3>Lower in this sample</h3>
              <p>Deutz, Nippes, university-only pockets. Low density ≠ opportunity without footfall and rent evidence.</p>
            </div>
            <div className="ma-card">
              <h3>Estimates (Low confidence)</h3>
              <p>
                Gastro rent often cited €18–30/m² Veedel. Students and residents are official. Office daytime and
                tourism counts: not independently counted here.
              </p>
            </div>
          </div>
        </section>
      )}

      {sub === 'activity' && (
        <section className="ma-mod">
          <header>
            <h3>Openings and closures</h3>
            <p>Only dated closures we sourced. New openings in 2026: not independently listed — unknown.</p>
          </header>
          <ol className="ma-timeline">
            <li>
              <b>Feb 2026</b> Govardhan (Roonstr.) closed / converted to mixed Royal India buffet.
            </li>
            <li>
              <b>Mar 2026</b> Saravanaa Bhavan (Heumarkt) closed — 100% veg South Indian at a high-footfall node.
            </li>
            <li>
              <b>Long-running</b> Ganesha (seit 1987) still in the Belgian Quarter sample.
            </li>
          </ol>
        </section>
      )}
      <RecBlock page="opportunities" city={city} />
    </div>
  )
}

export function CaseView({
  city,
  sub,
  onSub,
}: {
  city: CityMode
  sub: string
  onSub: (s: string) => void
}) {
  const [finance, setFinance] = useState<FinanceState>(DEFAULT_FINANCE)
  const [scenario, setScenario] = useState<'conservative' | 'base' | 'strong'>('base')
  const [conceptId, setConceptId] = useState('south-veg-fast')
  const stalls = useStallEvidence()
  const verdictCity: City = city === 'Bonn' ? 'Bonn' : 'Köln'
  const v = liveVerdict({ conceptId, city: verdictCity, stalls })
  const tone = recommendationTone(conceptId, verdictCity)
  const live = modelFinance(finance)
  const sense = decisionSensitivity(finance)
  const rows = (['conservative', 'base', 'strong'] as const).map(scenarioFinance)

  return (
    <div className="ma-modstack">
      <nav className="ma-subnav">
        {['pricing', 'model', 'risks', 'decision', 'sources'].map((id) => (
          <button key={id} type="button" className={sub === id ? 'is-on' : ''} onClick={() => onSub(id)}>
            {id[0].toUpperCase() + id.slice(1)}
          </button>
        ))}
      </nav>

      {sub === 'pricing' && (
        <section className="ma-mod">
          <PriceBands city={city === 'Compare' ? 'All' : city} />
          <div className="ma-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Typical ticket</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {MODELS.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td>{m.atv}</td>
                    <td>{m.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {sub === 'model' && (
        <section className="ma-mod">
          <p className="ma-assumekick">Assumptions, not forecasts</p>
          <div className="ma-pnl">
            <div>
              <span>Monthly sales</span>
              <b>{money(live.monthly)}</b>
              <em>
                <LayerBadge kind="model" />
              </em>
            </div>
            <div>
              <span>Monthly costs</span>
              <b>{money(live.food + live.labour + live.rent + live.delivery + live.other)}</b>
              <em>
                <LayerBadge kind="model" />
              </em>
            </div>
            <div>
              <span>Estimated result</span>
              <b>{money(live.result)}</b>
              <em>
                <LayerBadge kind="model" />
              </em>
            </div>
            <div>
              <span>Break-even lunch</span>
              <b>{Number.isFinite(live.beLunch) ? `${Math.ceil(live.beLunch)} covers/day` : '—'}</b>
              <em>
                <LayerBadge kind="model" />
              </em>
            </div>
          </div>
          <div className="ma-citysw" role="group" aria-label="Scenario">
            {(['conservative', 'base', 'strong'] as const).map((id) => (
              <button
                key={id}
                type="button"
                className={scenario === id ? 'is-on' : ''}
                onClick={() => {
                  setScenario(id)
                  setFinance(defaultFinanceFromScenario(id))
                }}
              >
                {id[0].toUpperCase() + id.slice(1)}
              </button>
            ))}
          </div>
          <p className="ma-ev">
            Observed: min wage €{MACRO.minWage.value.toFixed(2)}/h, VAT food {MACRO.vatFood.value}%. User assumptions:
            covers, spend, rent, size, cooks. Model calculations: sales, costs, result, break-even.
          </p>
          <WhatIfFinance state={finance} onChange={setFinance} />
          <FinanceChart rows={rows} />
          <h3>What would change the decision?</h3>
          <p className="ma-ev">Solved from the current assumption set so monthly result ≥ 0. Not observed market data.</p>
          <ul className="ma-sense">
            {sense.attractiveIf.map((h) => (
              <li key={h.id}>
                {h.reachable
                  ? `${h.label} ${h.id === 'rentM2' ? 'stays below' : 'exceeds'} ${h.id === 'rentM2' || h.id.includes('spend') ? `€${h.value.toFixed(0)}` : Math.ceil(h.value)}${h.unit === '€/m²' ? '/m²' : h.unit === '€' ? '' : ` ${h.unit}`}`
                  : `${h.label}: not reachable inside the slider range with the other assumptions held`}
              </li>
            ))}
          </ul>
          <h4>Largest effect on the result</h4>
          <ol>
            {sense.levers.map((l) => (
              <li key={l.id}>
                {l.label}: {l.delta >= 0 ? '+' : ''}
                {money(l.delta)} when moved 10%
              </li>
            ))}
          </ol>
        </section>
      )}

      {sub === 'risks' && (
        <section className="ma-mod">
          {RED_FLAGS.map((r) => (
            <div key={r.title} className={`ma-callout ${r.severity === 'High' ? 'ma-callout--danger' : 'ma-callout--warn'}`}>
              <strong>
                {r.severity}: {r.title}
              </strong>
              <p>{r.evidence}</p>
            </div>
          ))}
        </section>
      )}

      {sub === 'decision' && (
        <section className="ma-mod ma-decision">
          <label>
            Concept
            <select value={conceptId} onChange={(e) => setConceptId(e.target.value)}>
              {CONCEPTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className={`ma-verdict ma-verdict--${v.tone}`}>
            <p className="ma-kicker">
              {tone === 'proceed-test' ? 'Proceed with testing' : tone === 'needs-evidence' ? 'Needs more evidence' : 'Not recommended'}
            </p>
            <h3>{v.title}</h3>
            <p>{v.body}</p>
          </div>
          <dl className="ma-facts">
            <div>
              <dt>Best city on this evidence</dt>
              <dd>Köln for South Indian veg lunch; Bonn only if a campus street is empty.</dd>
            </div>
            <div>
              <dt>Best concept</dt>
              <dd>South Indian vegetarian fast-casual with weekday lunch</dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>Weekday lunch (students + office) + veg-curious diners</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>€ / lower €€ — at or under the €14.90 buffet</dd>
            </div>
            <div>
              <dt>Location type</dt>
              <dd>Not Händelstraße / Markt 100. Lunch street with footfall.</dd>
            </div>
            <div>
              <dt>Main risk</dt>
              <dd>Two 2026 veg closures; Chennai Chef already owns dinner authenticity.</dd>
            </div>
          </dl>
          {DECISION.slice(0, 6).map((d) => (
            <div className="ma-q" key={d.q}>
              <strong>{d.q}</strong>
              <p>{d.a}</p>
              <div className="ma-ev">Evidence: {d.evidence}</div>
            </div>
          ))}
        </section>
      )}

      {sub === 'sources' && (
        <section className="ma-mod">
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
        </section>
      )}
      <RecBlock page="case" city={city} />
    </div>
  )
}

