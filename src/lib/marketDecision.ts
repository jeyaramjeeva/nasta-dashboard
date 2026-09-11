import {
  CONCEPTS,
  DECISION,
  DIRECTORY_SIGNALS,
  FINANCIAL_ASSUMPTIONS,
  MACRO,
  OBSERVED_PRICES,
  RESEARCH_CHECKED_LABEL,
  RESEARCH_SOURCES,
  SEGMENTS,
  VENUES,
  isCoreIndian,
  type City,
  type Confidence,
  type Flag,
  type Venue,
} from './marketAnalysis'
import { buildKpis, isSouth, isVegFocused, isVeganFocused, venuesIn, type CityMode } from './marketKpis'
import { DEFAULT_FINANCE, modelFinance, type FinanceState } from '../pages/MarketAnalysisFinance'

export type EvidenceKind = 'observed' | 'calculated' | 'interpretation' | 'assumption' | 'model'
export type Confidence4 = Confidence | 'Insufficient evidence'

export type ScorePart = {
  id: string
  label: string
  score: number | null
  kind: EvidenceKind
  method: string
  factors: string[]
  sources: string[]
  completeness: string
  confidence: Confidence4
}

export type ConceptIntel = {
  id: string
  name: string
  score: number
  demand: number
  competitionEase: number
  crowding: number
  priceOpp: number
  locationOpp: number
  conceptFit: number
  opsComplexity: number
  risk: number
  demandLabel: string
  competitionLabel: string
  priceLabel: string
  locationLabel: string
  opsLabel: string
  riskLabel: string
  evidence: string
  advantage: string
  risks: string
  target: string
  cityNote: string
  avgPrice: string
  confidence: Confidence4
  confidenceWhy: string[]
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function mean(nums: number[]) {
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

export function band10(n: number) {
  if (n >= 8) return 'High'
  if (n >= 6.5) return 'Medium-high'
  if (n >= 5.5) return 'Moderate'
  if (n >= 4.5) return 'Medium'
  if (n >= 3.5) return 'Potential'
  return 'Low'
}

export function crowdingBand(crowding: number) {
  if (crowding <= 3.5) return 'Low'
  if (crowding <= 4.5) return 'Moderate-low'
  if (crowding <= 5.5) return 'Moderate'
  if (crowding <= 7) return 'Medium-high'
  return 'High'
}

export function scopeCity(city: CityMode): City | 'All' {
  if (city === 'Compare') return 'All'
  return city
}

export function hasReviewGrowth(v: Venue) {
  return v.google.growth30d != null || v.google.growth90d != null || v.google.growth12m != null
}

export function anyReviewGrowth() {
  return VENUES.some(hasReviewGrowth)
}

export function conceptScore100(c: (typeof CONCEPTS)[number]) {
  const parts = [c.demand, c.competition, c.gap, c.priceOpp, c.locationOpp, c.sentiment, c.differentiation, c.ops, c.finance]
  return clamp(mean(parts) * 10)
}

export function scoredConcepts(): ConceptIntel[] {
  const k = buildKpis('All')
  const growth = anyReviewGrowth()
  return CONCEPTS.map((c) => {
    const score = conceptScore100(c)
    const crowding = Number((11 - c.competition).toFixed(1))
    const conceptFit = Number(((c.differentiation + c.gap) / 2).toFixed(1))
    const opsComplexity = Number((11 - c.ops).toFixed(1))
    const risk = Number((11 - c.finance).toFixed(1))
    const why = [
      `${k.total} core Indian records in the sample`,
      `${k.south} tagged South Indian / dosa`,
      `${k.ratedCount} rating snapshots · ${k.reviewedCount} review counts`,
      growth ? 'A second rating snapshot exists' : 'No second Google snapshot — 30/90/365 growth unavailable',
      c.evidence,
    ]
    const confidence: Confidence4 = growth ? 'Medium' : c.id === 'street-fast' || c.id === 'vegan-indian' ? 'Medium' : 'Medium'
    return {
      id: c.id,
      name: c.name,
      score,
      demand: c.demand,
      competitionEase: c.competition,
      crowding,
      priceOpp: c.priceOpp,
      locationOpp: c.locationOpp,
      conceptFit,
      opsComplexity,
      risk,
      demandLabel: band10(c.demand),
      competitionLabel: crowdingBand(crowding),
      priceLabel: band10(c.priceOpp) === 'High' ? 'Good' : band10(c.priceOpp),
      locationLabel: band10(c.locationOpp),
      opsLabel: band10(opsComplexity) === 'High' ? 'High' : band10(opsComplexity) === 'Low' ? 'Low' : 'Medium',
      riskLabel: band10(risk),
      evidence: c.evidence,
      advantage: c.advantage,
      risks: c.risks,
      target: c.target,
      cityNote: c.city,
      avgPrice: c.avgPrice,
      confidence,
      confidenceWhy: why,
    }
  }).sort((a, b) => b.score - a.score)
}

export function bestConcept() {
  return scoredConcepts()[0]
}

function studentShare(city: CityMode) {
  if (city === 'Bonn') return MACRO.bonnStudents.value / MACRO.bonnPop.value
  if (city === 'Köln') return MACRO.koelnStudents.value / MACRO.koelnPop.value
  return (MACRO.koelnStudents.value + MACRO.bonnStudents.value) / (MACRO.koelnPop.value + MACRO.bonnPop.value)
}

export function marketScoreParts(city: CityMode): ScorePart[] {
  const k = buildKpis(city)
  const share = studentShare(city)
  const southShare = k.total ? k.south / k.total : 0
  const dir = DIRECTORY_SIGNALS
  const dosaShare = dir.dosaKoeln.value / dir.speisekarteKoelnCount.value
  const vegOpen = k.list.filter((v) => isVegFocused(v) && v.status === 'Open').length
  const heavy = k.list.filter((v) => (v.google.reviewCount ?? 0) >= 1000 && v.status === 'Open').length
  const lunchPrices = OBSERVED_PRICES.filter((p) => p.kind === 'Dosa' || p.kind === 'Veg main' || p.kind === 'Buffet')
  const lunchAvg = lunchPrices.length ? mean(lunchPrices.map((p) => p.eur)) : null
  const best = bestConcept()
  const growth = anyReviewGrowth()

  const demand = clamp(48 + share * 220 + (k.total >= 20 ? 6 : 0) + (city === 'Bonn' ? -4 : city === 'Köln' ? 6 : 4))
  const gap = clamp(92 - southShare * 260 - Math.min(18, heavy * 2) + (1 - dosaShare) * 14)
  const price =
    k.priceN === 0
      ? null
      : clamp(52 + Math.min(16, k.priceN) + (lunchAvg != null && lunchAvg <= 15 ? 10 : 0) + (k.medianMeal != null && k.medianMeal <= 16 ? 6 : 0))
  const location = clamp(
    city === 'Bonn' ? 54 : city === 'Köln' ? 78 : 70 + (MACRO.koelnPop.value / (MACRO.koelnPop.value + MACRO.bonnPop.value)) * 12,
  )
  const fit = best.score
  const riskResidual = clamp(88 - k.closed * 7 - Math.min(22, heavy * 3) - (vegOpen === 0 ? 4 : 0))

  const conf: Confidence4 = growth ? 'Medium' : 'Medium'
  const sampleNote = `${k.total} core records · ${k.ratedCount} ratings · directory Köln Indian ${dir.speisekarteKoelnCount.value}`

  return [
    {
      id: 'demand',
      label: 'Customer demand',
      score: demand,
      kind: 'calculated',
      method: '48 + student-share×220 + sample-size bonus. Student counts are official MLP 2025; residents are register 31.12.2025.',
      factors: [
        `Student share ${(share * 100).toFixed(1)}% (${city === 'Bonn' ? MACRO.bonnStudents.value.toLocaleString('de-DE') : city === 'Köln' ? MACRO.koelnStudents.value.toLocaleString('de-DE') : `${MACRO.koelnStudents.value.toLocaleString('de-DE')} + ${MACRO.bonnStudents.value.toLocaleString('de-DE')}`})`,
        `Residents: Köln ${MACRO.koelnPop.value.toLocaleString('de-DE')} · Bonn ${MACRO.bonnPop.value.toLocaleString('de-DE')}`,
        `SEGMENTS: Students and office lunch coded High / Moderate evidence`,
      ],
      sources: [MACRO.koelnStudents.source, MACRO.koelnPop.source],
      completeness: sampleNote,
      confidence: 'Medium',
    },
    {
      id: 'gap',
      label: 'Competition gap',
      score: gap,
      kind: 'calculated',
      method: '92 − (South-Indian share × 260) − high-review generalists + directory dosa rarity. Higher = less South Indian saturation.',
      factors: [
        `${k.south} South Indian / dosa tagged of ${k.total} core records (${(southShare * 100).toFixed(1)}%)`,
        `Directory: ${dir.dosaKoeln.value} dosa / ${dir.sambarKoeln.value} sambar vs ${dir.speisekarteKoelnCount.value} Köln Indian listings`,
        `${heavy} open rooms with ≥1.000 snapshot reviews`,
        `${vegOpen} vegetarian-focused rooms listed open`,
      ],
      sources: [dir.speisekarteKoelnCount.url, 'Core Indian sample in this file'],
      completeness: sampleNote,
      confidence: conf,
    },
    {
      id: 'price',
      label: 'Price opportunity',
      score: price,
      kind: price == null ? 'observed' : 'calculated',
      method:
        k.priceN === 0
          ? 'Insufficient observed menu euros.'
          : '52 + min(16, priced-item count) + bonus if lunch/dosa/veg/buffet average ≤ €15 and median meal ≤ €16.',
      factors:
        k.priceN === 0
          ? ['No observed price records in this city filter']
          : [
              `${k.priceN} observed priced items`,
              k.medianMeal != null ? `Median observed dish €${k.medianMeal.toFixed(2)}` : 'Median unavailable',
              lunchAvg != null ? `Dosa / veg / buffet average €${lunchAvg.toFixed(2)}` : 'No lunch/dosa/buffet prices',
              'Royal India lunch buffet €14.90 is the recorded lunch ceiling',
            ],
      sources: OBSERVED_PRICES.map((p) => p.source).filter((s, i, a) => a.indexOf(s) === i),
      completeness: `${k.priceN} menu euros · not a census`,
      confidence: k.priceN >= 8 ? 'Medium' : k.priceN > 0 ? 'Low' : 'Insufficient evidence',
    },
    {
      id: 'location',
      label: 'Location opportunity',
      score: location,
      kind: 'calculated',
      method: 'Köln starts higher because register population and student stock are larger. Not a street-level score. District walk still required.',
      factors: [
        `Köln ${MACRO.koelnPop.value.toLocaleString('de-DE')} vs Bonn ${MACRO.bonnPop.value.toLocaleString('de-DE')} residents`,
        `Open sample density: Köln ${k.densityKoeln.per10k.toFixed(2)} / 10k · Bonn ${k.densityBonn.per10k.toFixed(2)} / 10k`,
        'DECISION file: avoid Händelstraße / Markt 100; investigate uni/office belts',
      ],
      sources: [MACRO.koelnPop.source, MACRO.bonnPop.source],
      completeness: 'City-level only — rent and footfall not measured',
      confidence: 'Low',
    },
    {
      id: 'fit',
      label: 'Concept fit',
      score: fit,
      kind: 'interpretation',
      method: 'Mean of the nine researcher-coded 0–10 components on the leading concept, ×10. Those components are interpretation stored in CONCEPTS, not sensor readings.',
      factors: [
        `Leading concept: ${best.name}`,
        `Demand ${best.demand}/10 · competition ease ${best.competitionEase}/10 · gap ${CONCEPTS.find((c) => c.id === best.id)?.gap}/10`,
        best.evidence,
      ],
      sources: ['CONCEPTS in this research file'],
      completeness: 'Nine coded components · not a live model',
      confidence: best.confidence,
    },
    {
      id: 'risk',
      label: 'Risk residual',
      score: riskResidual,
      kind: 'calculated',
      method: '88 − 7×permanently closed − up to 22 from high-review open rooms − 4 if no open vegetarian-focused room. Higher = more residual room after known threats.',
      factors: [
        `${k.closed} permanently closed in this filter`,
        `${heavy} open ≥1.000-review rooms`,
        `${vegOpen} open vegetarian-focused rooms`,
        '2026 closures (Govardhan, Saravanaa Bhavan) are in the closed count when they match the filter',
      ],
      sources: ['Venue status field', 'HappyCow notes in statusEvidence'],
      completeness: sampleNote,
      confidence: 'Medium',
    },
  ]
}

export function overallOpportunity(city: CityMode) {
  const parts = marketScoreParts(city)
  const usable = parts.filter((p): p is ScorePart & { score: number } => p.score != null)
  const weights: Record<string, number> = { demand: 20, gap: 20, price: 15, location: 15, fit: 15, risk: 15 }
  const wsum = usable.reduce((s, p) => s + (weights[p.id] ?? 0), 0)
  const score = wsum ? clamp(usable.reduce((s, p) => s + p.score * ((weights[p.id] ?? 0) / wsum), 0)) : null
  const k = buildKpis(city)
  const growth = anyReviewGrowth()
  const missing = [
    !growth ? 'No second rating snapshot — growth unavailable' : '',
    k.priceN < 8 ? `Only ${k.priceN} observed price records` : '',
    'Sample is not the 49-listing Köln directory census',
    'Rent and weekday footfall not measured',
  ].filter(Boolean)
  const confidence: Confidence4 = score == null ? 'Insufficient evidence' : 'Medium'
  return { score, parts, confidence, missing, k }
}

export function generateVerdict(city: CityMode) {
  const k = buildKpis(city)
  const overall = overallOpportunity(city)
  const best = bestConcept()
  const köln = buildKpis('Köln')
  const bonn = buildKpis('Bonn')
  const southShare = k.total ? k.south / k.total : 0
  const largerCity = MACRO.koelnPop.value > MACRO.bonnPop.value ? 'Köln' : 'Bonn'
  const leanCity = best.id === 'south-veg-fast' ? largerCity : largerCity
  let headline = 'Promising, but concept-specific'
  let tone: 'ok' | 'warn' | 'bad' = 'warn'
  if (best.id === 'vegan-indian' || best.score < 50) {
    headline = 'Not attractive as a default new room'
    tone = 'bad'
  } else if (best.score >= 70 && leanCity === 'Köln') {
    headline = 'Promising, but concept-specific'
    tone = 'ok'
  } else if (best.score >= 55) {
    headline = 'Only a test — not a default yes'
    tone = 'warn'
  } else {
    headline = 'Weak on current evidence'
    tone = 'bad'
  }

  const why = [
    `${largerCity} has the larger recorded customer base (${MACRO.koelnPop.value.toLocaleString('de-DE')} vs ${MACRO.bonnPop.value.toLocaleString('de-DE')} residents; ${MACRO.koelnStudents.value.toLocaleString('de-DE')} vs ${MACRO.bonnStudents.value.toLocaleString('de-DE')} students).`,
    `South Indian / dosa is ${k.south} of ${k.total} core records (${(southShare * 100).toFixed(1)}%). Directory: ${DIRECTORY_SIGNALS.dosaKoeln.value} dosa / ${DIRECTORY_SIGNALS.sambarKoeln.value} sambar vs ${DIRECTORY_SIGNALS.speisekarteKoelnCount.value} Köln Indian listings.`,
    köln.vegFocused === 0 || köln.list.filter((v) => isVegFocused(v) && v.status === 'Open').length === 0
      ? 'No confirmed open 100% / mostly vegetarian Indian sit-down in the Köln core sample after the 2026 closures.'
      : `${köln.list.filter((v) => isVegFocused(v) && v.status === 'Open').length} vegetarian-focused rooms still listed open in Köln.`,
    `Observed lunch/dosa/buffet prices sit at or under the recorded €14.90 lunch buffet (${OBSERVED_PRICES.filter((p) => p.kind === 'Dosa' || p.kind === 'Veg main' || p.kind === 'Buffet').length} priced lines).`,
  ]

  const risks = [
    `Generic Indian dine-in is already strong: ${k.list.filter((v) => (v.google.reviewCount ?? 0) >= 1000 && v.status === 'Open').length} open rooms with ≥1.000 snapshot reviews in this filter.`,
    `${k.closed} permanently closed records — including the 2026 vegetarian rooms — are a warning, not an invitation.`,
    city === 'Bonn' || city === 'All'
      ? `Bonn already has named South Indian (Taste of India Süd) and centre street food; smaller city ≠ empty market (${bonn.total} core records).`
      : 'Köln directory listed 49 Indian rooms the same day as this snapshot — this file is a sample.',
  ]

  const cityLine =
    best.id === 'south-veg-fast'
      ? `${leanCity} shows the stronger potential for ${best.name.toLowerCase()} because the recorded TAM and student stock are larger and South Indian specialists remain few relative to generic Indian listings.`
      : `Leading stored concept is ${best.name} (${best.score}/100). City choice is still concept-dependent.`

  return {
    headline,
    tone,
    cityLine,
    best,
    why,
    risks,
    overall,
    leanCity,
  }
}

export function pageRecommendation(page: 'overview' | 'competitors' | 'map' | 'customers' | 'opportunities' | 'case', city: CityMode) {
  const v = generateVerdict(city)
  const base = {
    recommendation: `Prioritize ${v.leanCity} for ${v.best.name.toLowerCase()} — not another generic North Indian full-service room.`,
    next: 'Validate three lunch streets near student or office demand, off Händelstraße / Markt 100.',
    missing: [
      'Weekday footfall on candidate streets',
      'Quoted rent €/m² for 70–100 m²',
      'On-site check of Saravanaa Bhavan / Nishas status',
      'A second Google rating snapshot so 30/90/365 growth can exist',
      'Transit and evening demand on the same streets',
    ],
  }
  if (page === 'customers') {
    return {
      ...base,
      recommendation: 'Primary target is weekday lunch (students + office) plus vegetarian / veg-curious diners. Diaspora is a niche, not the volume market. Tourists are weak as a standalone plan.',
      next: 'Walk campus and office-belt lunch streets; do not plan around hotel arrivals.',
    }
  }
  if (page === 'map') {
    return {
      ...base,
      recommendation: 'Use rings to test lunch catchments. Do not treat low pin density as a proven gap — many research rows still lack coordinates.',
      next: 'Pin remaining addresses, then walk any candidate that is near campus/transit and not already stacked with Indian tags.',
    }
  }
  if (page === 'case') {
    return {
      ...base,
      recommendation: 'Treat every euro below as a model. The concept is only worth testing if lunch covers or rent clear the break-even the model computes from your assumptions.',
      next: 'Hold rent, covers and weekday spend against a real unit before any fit-out.',
    }
  }
  if (page === 'opportunities') {
    return {
      ...base,
      recommendation: `${v.best.name} leads on the stored component scores (${v.best.score}/100, ${v.best.confidence.toLowerCase()} confidence). Vegan-only Indian remains not recommended.`,
      next: 'Open the leading card, then pressure-test the finance page with conservative covers.',
    }
  }
  if (page === 'competitors') {
    return {
      ...base,
      recommendation: 'Differentiate on weekday South Indian lunch, a short card, and vegan marks — not on another encyclopedia North Indian menu next to Ginti.',
      next: 'Compare Chennai Chef, Taste of India Süd and one high-volume generalist; list what they do not cover on weekdays.',
    }
  }
  return base
}

export type CustomerOpp = {
  name: string
  potential: string
  evidence: 'Strong' | 'Moderate' | 'Weak'
  why: string
  sizeNote: string
  kind: EvidenceKind
}

export function customerOpportunities(city: CityMode): CustomerOpp[] {
  const kölnIndian = '4.186 Indian nationality (31.12.2025)'
  const bonnIndian = '2.459 India-origin (31.12.2022 only)'
  return SEGMENTS.filter((s) =>
    /Students|office lunch|Indian \/ South Asian|Tourists|Vegetarians|Vegans/.test(s.name),
  ).map((s) => {
    let potential = 'Potential'
    if (s.name === 'Students') potential = 'High potential'
    else if (s.name.startsWith('Young professionals')) potential = 'High potential'
    else if (s.name.startsWith('Indian')) potential = 'Medium-high potential'
    else if (s.name === 'Tourists') potential = 'Medium potential'
    else if (s.name === 'Vegetarians') potential = 'Potential'
    else if (s.name === 'Vegans') potential = 'Low potential'
    const sizeNote =
      s.name === 'Students'
        ? city === 'Bonn'
          ? `${MACRO.bonnStudents.value.toLocaleString('de-DE')} students (MLP 2025)`
          : city === 'Köln'
            ? `${MACRO.koelnStudents.value.toLocaleString('de-DE')} students (MLP 2025)`
            : `${MACRO.koelnStudents.value.toLocaleString('de-DE')} Köln · ${MACRO.bonnStudents.value.toLocaleString('de-DE')} Bonn (MLP 2025)`
        : s.name.startsWith('Indian')
          ? city === 'Bonn'
            ? bonnIndian
            : city === 'Köln'
              ? kölnIndian
              : `${kölnIndian} · ${bonnIndian}`
          : s.name === 'Tourists'
            ? 'Köln 4.252.560 hotel arrivals / Bonn 802.103 (2025). India is not in Köln’s published top-10 guest origins.'
            : s.relevance
    return {
      name: s.name.startsWith('Young professionals') ? 'Office workers' : s.name === 'Vegetarians' ? 'Veg-curious customers' : s.name,
      potential,
      evidence: s.evidence as CustomerOpp['evidence'],
      why: s.relevance,
      sizeNote,
      kind: 'interpretation' as const,
    }
  })
}

export function dataStatusRows() {
  return [
    {
      id: 'google',
      label: 'Google ratings',
      last: RESEARCH_CHECKED_LABEL,
      state: 'Snapshot data',
      detail: `${VENUES.filter((v) => v.google.rating != null).length} ratings · ${VENUES.filter((v) => v.google.reviewCount != null).length} review counts · growth unavailable (one snapshot)`,
    },
    {
      id: 'osm',
      label: 'OpenStreetMap',
      last: RESEARCH_CHECKED_LABEL,
      state: 'Live Overpass, else saved extract',
      detail: 'Pins are mapper-maintained. Not Google ratings.',
    },
    {
      id: 'menus',
      label: 'Menus',
      last: RESEARCH_CHECKED_LABEL,
      state: `${OBSERVED_PRICES.length} observed price records`,
      detail: 'Only sourced euros. Not a market average.',
    },
    {
      id: 'pop',
      label: 'Population / jobs',
      last: '31 Dec 2025 / 30 Jun 2025',
      state: 'Official register / BA / MLP',
      detail: 'See Customers → People for the sourced tables.',
    },
  ]
}

export const SOURCE_GROUPS = RESEARCH_SOURCES

export function flagDisplay(value: Flag, trueMeans = 'Yes') {
  if (value === 'Not verified') return { text: 'Not verified', level: 'unknown' as const }
  if (value === true) return { text: trueMeans, level: 'verified' as const }
  return { text: 'Recorded as no', level: 'observed' as const }
}

export function boolTagDisplay(value: boolean, tagged: string) {
  if (value) return { text: tagged, level: 'observed' as const }
  return { text: 'Not tagged', level: 'unknown' as const }
}

export function mentionsIdli(v: Venue) {
  return /idli/i.test(`${v.distinctive} ${v.pricesObserved} ${v.cuisine.join(' ')}`)
}

export function decisionAnswers() {
  return DECISION
}

export type SensitivityHit = {
  id: string
  label: string
  value: number
  unit: string
  reachable: boolean
}

export function decisionSensitivity(state: FinanceState): {
  attractiveIf: SensitivityHit[]
  levers: { id: string; label: string; delta: number }[]
  model: ReturnType<typeof modelFinance>
} {
  const model = modelFinance(state)
  const attractiveIf: SensitivityHit[] = [
    solveField(state, 'coversLunch', 0, 120, 'Lunch covers', '/day'),
    solveField(state, 'rentM2', 8, 45, 'Rent', '€/m²', 'max'),
    solveField(state, 'spendLunch', 8, 28, 'Average lunch spend', '€'),
    solveField(state, 'coversDinner', 0, 80, 'Dinner covers', '/day'),
  ]
  const base = model.result
  const levers = (
    [
      ['coversLunch', 'Lunch covers', 1.1],
      ['coversDinner', 'Dinner covers', 1.1],
      ['spendLunch', 'Lunch spend', 1.1],
      ['spendDinner', 'Dinner spend', 1.1],
      ['rentM2', 'Rent €/m²', 0.9],
      ['cooks', 'Cooks / FTE', 0.9],
    ] as const
  ).map(([id, label, factor]) => {
    const next = { ...state, [id]: Number(state[id]) * factor }
    return { id, label, delta: modelFinance(next).result - base }
  })
  levers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return { attractiveIf, levers, model }
}

function solveField(
  state: FinanceState,
  key: keyof FinanceState,
  lo: number,
  hi: number,
  label: string,
  unit: string,
  mode: 'min' | 'max' = 'min',
): SensitivityHit {
  let best: number | null = null
  const steps = 80
  for (let i = 0; i <= steps; i++) {
    const t = mode === 'min' ? lo + ((hi - lo) * i) / steps : hi - ((hi - lo) * i) / steps
    const next = { ...state, [key]: t }
    if (modelFinance(next).result >= 0) {
      best = t
      break
    }
  }
  return {
    id: key,
    label,
    value: best ?? (mode === 'min' ? hi : lo),
    unit,
    reachable: best != null,
  }
}

export function scenarioFinance(kind: 'conservative' | 'base' | 'strong') {
  const a = FINANCIAL_ASSUMPTIONS
  const s = a[kind]
  const labourPct = kind === 'conservative' ? a.labourPctCons : kind === 'base' ? a.labourPctBase : a.labourPctStrong
  const monthly = s.covers * s.spend * a.daysOpen
  const food = monthly * a.foodPct
  const labour = monthly * labourPct
  const rent = a.sizeM2 * ((a.rentPerM2Low + a.rentPerM2High) / 2)
  const delivery = monthly * s.deliveryShare * a.deliveryCommission
  const other = monthly * a.otherPct
  const costs = food + labour + rent + delivery + other
  return { name: kind, sales: monthly, costs, result: monthly - costs, covers: s.covers, spend: s.spend }
}

export function defaultFinanceFromScenario(kind: 'conservative' | 'base' | 'strong'): FinanceState {
  const a = FINANCIAL_ASSUMPTIONS
  const s = a[kind]
  return {
    ...DEFAULT_FINANCE,
    coversLunch: Math.round(s.covers * 0.55),
    coversDinner: Math.round(s.covers * 0.45),
    spendLunch: Math.min(s.spend, 14.9),
    spendDinner: s.spend + 3,
  }
}

export function highReviewOpen(city: CityMode) {
  return venuesIn(city).filter((v) => v.status === 'Open' && (v.google.reviewCount ?? 0) >= 1000)
}

export function coreVenues(city: CityMode) {
  return venuesIn(city)
}

export function isCore(v: Venue) {
  return isCoreIndian(v)
}

export function isSouthVenue(v: Venue) {
  return isSouth(v)
}

export function isVegFocusVenue(v: Venue) {
  return isVegFocused(v)
}

export function isVeganFocusVenue(v: Venue) {
  return isVeganFocused(v)
}

export { DEFAULT_FINANCE }
