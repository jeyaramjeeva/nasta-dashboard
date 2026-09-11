import { useMemo, useState } from 'react'
import { VENUES, isCoreIndian, type Status, type Venue } from '../lib/marketAnalysis'
import { KPI_DATASET_NOTE, KPI_DEFS, kpiEmptyCopy, kpiVenues, type KpiId } from '../lib/marketKpiDefs'
import type { CityMode } from '../lib/marketKpis'
import {
  applyCompFilters,
  clearChip,
  EMPTY_FILTERS,
  filterChips,
  filterSummary,
  uniqueCuisines,
  uniqueDistricts,
  uniqueFormats,
  type CompFilters,
} from '../lib/marketFilters'

export function CompetitorDatabase({
  city,
  onOpen,
  kpiFilter,
  onClearKpi,
  seed,
}: {
  city: CityMode
  onOpen: (v: Venue) => void
  kpiFilter: KpiId | null
  onClearKpi: () => void
  seed?: Partial<CompFilters>
}) {
  const scopeCity = city === 'Compare' ? 'All' : city
  const [f, setF] = useState<CompFilters>({
    ...EMPTY_FILTERS,
    city: scopeCity === 'All' ? 'All' : scopeCity,
    ...seed,
  })
  const [open, setOpen] = useState(false)
  const [sort, setSort] = useState<'reviews' | 'rating' | 'name'>('reviews')
  const kpiDef = kpiFilter ? KPI_DEFS[kpiFilter] : null
  const base = kpiFilter
    ? kpiVenues(city, kpiFilter)
    : VENUES.filter((v) => isCoreIndian(v) && (scopeCity === 'All' || v.city === scopeCity))
  const rows = useMemo(() => {
    const list = applyCompFilters(base, kpiFilter ? { ...EMPTY_FILTERS, q: f.q } : { ...f, city: f.city })
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'rating') return (b.google.rating ?? 0) - (a.google.rating ?? 0)
      return (b.google.reviewCount ?? 0) - (a.google.reviewCount ?? 0)
    })
  }, [base, f, kpiFilter, sort])
  const sum = filterSummary(rows)
  const chips = kpiDef ? [] : filterChips({ ...f, city: scopeCity === 'All' ? f.city : scopeCity })
  const districts = uniqueDistricts(base)
  const cuisines = uniqueCuisines(base)
  const formats = uniqueFormats(base)

  function set<K extends keyof CompFilters>(key: K, value: CompFilters[K]) {
    setF((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <section className="ma-mod">
      <header className="ma-mod__tools">
        <input value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Search name or district" />
        <button type="button" className="ma-btn ma-btn--ghost ma-filterbtn" onClick={() => setOpen((v) => !v)}>
          Filters
        </button>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="reviews">Sort: reviews</option>
          <option value="rating">Sort: rating</option>
          <option value="name">Sort: name</option>
        </select>
      </header>

      <div className={`ma-filters ma-filters--grid ${open ? 'is-open' : ''}`}>
        <select value={f.city} onChange={(e) => set('city', e.target.value as CompFilters['city'])} disabled={Boolean(kpiFilter) || scopeCity !== 'All'}>
          <option value="All">City: all</option>
          <option value="Köln">Köln</option>
          <option value="Bonn">Bonn</option>
        </select>
        <select value={f.district} onChange={(e) => set('district', e.target.value)} disabled={Boolean(kpiFilter)}>
          <option value="">District: all</option>
          {districts.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select value={f.cuisine} onChange={(e) => set('cuisine', e.target.value)} disabled={Boolean(kpiFilter)}>
          <option value="">Cuisine: all</option>
          {cuisines.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={f.concept} onChange={(e) => set('concept', e.target.value)} disabled={Boolean(kpiFilter)}>
          <option value="">Concept: all</option>
          {formats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={f.veg} onChange={(e) => set('veg', e.target.value as CompFilters['veg'])} disabled={Boolean(kpiFilter)}>
          <option value="All">Vegetarian: all</option>
          <option value="veg-focus">Vegetarian-focused</option>
          <option value="veg-friendly">Vegetarian-friendly</option>
          <option value="not-verified">Not verified</option>
        </select>
        <select value={f.vegan} onChange={(e) => set('vegan', e.target.value as CompFilters['vegan'])} disabled={Boolean(kpiFilter)}>
          <option value="All">Vegan: all</option>
          <option value="vegan-focus">Vegan-focused</option>
          <option value="vegan-friendly">Vegan-friendly</option>
          <option value="not-verified">Not verified</option>
        </select>
        <select value={f.south ? 'yes' : 'All'} onChange={(e) => set('south', e.target.value === 'yes')} disabled={Boolean(kpiFilter)}>
          <option value="All">South Indian: all</option>
          <option value="yes">South Indian only</option>
        </select>
        <select value={f.dosa} onChange={(e) => set('dosa', e.target.value as CompFilters['dosa'])} disabled={Boolean(kpiFilter)}>
          <option value="All">Dosa: all</option>
          <option value="yes">Dosa yes</option>
          <option value="no">Dosa recorded as no</option>
          <option value="unknown">Dosa not verified</option>
        </select>
        <select value={f.idli ? 'yes' : 'All'} onChange={(e) => set('idli', e.target.value === 'yes')} disabled={Boolean(kpiFilter)}>
          <option value="All">Idli: all</option>
          <option value="yes">Idli mentioned</option>
        </select>
        <select value={f.lunch} onChange={(e) => set('lunch', e.target.value as CompFilters['lunch'])} disabled={Boolean(kpiFilter)}>
          <option value="All">Lunch: all</option>
          <option value="yes">Lunch yes</option>
          <option value="unknown">Lunch not verified</option>
        </select>
        <select value={f.buffet} onChange={(e) => set('buffet', e.target.value as CompFilters['buffet'])} disabled={Boolean(kpiFilter)}>
          <option value="All">Buffet: all</option>
          <option value="yes">Buffet yes</option>
          <option value="no">Buffet recorded as no</option>
          <option value="unknown">Buffet not verified</option>
        </select>
        <select value={f.price} onChange={(e) => set('price', e.target.value as CompFilters['price'])} disabled={Boolean(kpiFilter)}>
          <option value="All">Price: all</option>
          <option value="€">€</option>
          <option value="€€">€€</option>
          <option value="€€€">€€€</option>
          <option value="Not verified">Not verified</option>
        </select>
        <select
          value={f.ratingMin == null ? '' : String(f.ratingMin)}
          onChange={(e) => set('ratingMin', e.target.value ? Number(e.target.value) : null)}
          disabled={Boolean(kpiFilter)}
        >
          <option value="">Rating: all</option>
          <option value="4">≥ 4.0</option>
          <option value="4.5">≥ 4.5</option>
        </select>
        <select
          value={f.reviewsMin == null ? '' : String(f.reviewsMin)}
          onChange={(e) => set('reviewsMin', e.target.value ? Number(e.target.value) : null)}
          disabled={Boolean(kpiFilter)}
        >
          <option value="">Reviews: all</option>
          <option value="200">≥ 200</option>
          <option value="1000">≥ 1.000</option>
        </select>
        <select value={f.status} onChange={(e) => set('status', e.target.value as CompFilters['status'])} disabled={Boolean(kpiFilter)}>
          <option value="All">Status: all</option>
          <option value="Open">Open</option>
          <option value="Temporarily closed">Temporarily closed</option>
          <option value="Permanently closed">Permanently closed</option>
          <option value="Opening soon">Opening soon</option>
          <option value="Unknown">Status unknown</option>
        </select>
      </div>

      {kpiDef && (
        <div className="ma-kpi-context">
          <p className="ma-kpi-crumb">
            Competitors <span aria-hidden="true">›</span> {kpiDef.title}
          </p>
          <p className="ma-kpi-found">
            {base.length} {base.length === 1 ? 'business' : 'businesses'} found
          </p>
          <div className="ma-kpi-chips">
            <span>
              Showing {rows.length} {rows.length === 1 ? 'business' : 'businesses'}
            </span>
            <button type="button" className="ma-filterchip" onClick={onClearKpi}>
              {kpiDef.chip} <span aria-hidden="true">×</span>
            </button>
          </div>
          <p className="ma-ev">{KPI_DATASET_NOTE}</p>
          {base.length === 0 && <p className="ma-callout">{kpiEmptyCopy(kpiFilter!, city)}</p>}
        </div>
      )}

      <div className="ma-sumcards">
        <button type="button" className={!f.south && f.veg === 'All' && f.vegan === 'All' ? 'is-on' : ''} onClick={() => setF({ ...f, south: false, veg: 'All', vegan: 'All' })}>
          <span>Businesses</span>
          <strong>{sum.total}</strong>
        </button>
        <button type="button" className={f.south ? 'is-on' : ''} onClick={() => set('south', !f.south)} disabled={Boolean(kpiFilter)}>
          <span>South Indian</span>
          <strong>{sum.south}</strong>
        </button>
        <button
          type="button"
          className={f.veg === 'veg-focus' ? 'is-on' : ''}
          onClick={() => set('veg', f.veg === 'veg-focus' ? 'All' : 'veg-focus')}
          disabled={Boolean(kpiFilter)}
        >
          <span>Vegetarian-focused</span>
          <strong>{sum.veg}</strong>
        </button>
        <button
          type="button"
          className={f.vegan === 'vegan-focus' ? 'is-on' : ''}
          onClick={() => set('vegan', f.vegan === 'vegan-focus' ? 'All' : 'vegan-focus')}
          disabled={Boolean(kpiFilter)}
        >
          <span>Vegan-focused</span>
          <strong>{sum.vegan}</strong>
        </button>
      </div>
      {chips.length > 0 && (
        <div className="ma-kpi-chips">
          {chips.map((c) => (
            <button key={c.key} type="button" className="ma-filterchip" onClick={() => setF(clearChip(f, c.key as keyof CompFilters))}>
              {c.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="ma-filterchip" onClick={() => setF({ ...EMPTY_FILTERS, city: scopeCity === 'All' ? 'All' : scopeCity })}>
            Clear all ×
          </button>
        </div>
      )}

      <div className="ma-table-wrap ma-table-wrap--cards">
        <table className="ma-slimtable">
          <thead>
            <tr>
              <th>Business</th>
              <th>City</th>
              <th>District</th>
              <th>Cuisine</th>
              <th>Concept</th>
              <th>Rating</th>
              <th>Reviews</th>
              <th>Veg</th>
              <th>Vegan</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} onClick={() => onOpen(v)}>
                <td>
                  <strong>{v.name}</strong>
                  <div className="ma-cardmeta">{statusLabel(v.status)}</div>
                </td>
                <td>{v.city}</td>
                <td>{v.district}</td>
                <td>{v.cuisine.slice(0, 2).join(', ')}</td>
                <td>{v.format}</td>
                <td>{v.google.rating != null ? `${v.google.rating.toFixed(1)} ★` : 'Not retrieved'}</td>
                <td>{v.google.reviewCount != null ? v.google.reviewCount.toLocaleString('de-DE') : 'Not retrieved'}</td>
                <td>{v.veg}</td>
                <td>{v.vegan}</td>
                <td>
                  <span className="ma-ev">{v.google.source || 'No rating source'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function statusLabel(s: Status) {
  if (s === 'Unknown') return 'Status unknown'
  return s
}
