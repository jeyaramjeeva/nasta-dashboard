import { useMemo, useState } from 'react'
import type { City } from '../lib/marketAnalysis'
import type { CityMode } from '../lib/marketKpis'
import {
  CAMPUSES,
  DISTRICT_SOURCES,
  HEAT_LAYERS,
  LAYER_STORY,
  PEOPLE_FILTERS,
  districtsFor,
  formatLayerValue,
  heatColor,
  layerValue,
  peopleFor,
  rankedDistricts,
  suggestedLayer,
  type DistrictRow,
  type HeatLayer,
  type PeopleFilter,
} from '../lib/marketPeople'

function fmt(n: number) {
  return n.toLocaleString('de-DE')
}

function mapCity(city: CityMode): City {
  return city === 'Bonn' ? 'Bonn' : 'Köln'
}

export function PeopleDemand({ city }: { city: CityMode }) {
  const [filter, setFilter] = useState<PeopleFilter>('residents')
  const [layer, setLayer] = useState<HeatLayer>('residents')
  const [picked, setPicked] = useState<string | null>(null)

  const stats = peopleFor(city, filter)
  const heatCity = mapCity(city)
  const districts = districtsFor(heatCity)
  const layers = HEAT_LAYERS.filter((l) => l.cities.includes(heatCity))
  const story = LAYER_STORY[layer]
  const ranked = rankedDistricts(districts, layer)
  const values = ranked.map((r) => r.value)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 1
  const top = ranked[0]
  const bottom = ranked[ranked.length - 1]
  const active = districts.find((d) => d.id === picked) ?? top?.d ?? null
  const showCampuses = filter === 'students' || filter === 'young'

  function pickFilter(id: PeopleFilter) {
    setFilter(id)
    const next = suggestedLayer(id)
    setLayer(layers.some((l) => l.id === next) ? next : 'residents')
    setPicked(null)
  }

  const filterHint = PEOPLE_FILTERS.find((f) => f.id === filter)?.hint
  const cityNote = useMemo(() => {
    if (filter === 'indian') return LAYER_STORY.asiaNonGerman.missing
    if (filter === 'students') {
      return 'Student numbers are city-wide (MLP). White campus labels on the board are addresses, not headcounts.'
    }
    if (filter === 'tourists') {
      return 'Hotel arrivals are city-wide. No official tourist count by district. Daytime Dom / Altstadt footfall is not in this file.'
    }
    if (filter === 'commuters') {
      return '322,224 people commute into Köln for work. They raise weekday lunch demand in job centres and are not drawn on the home map.'
    }
    return story.meaning
  }, [filter, story.meaning])

  return (
    <div className="ma-modstack">
      <section className="ma-mod">
        <header>
          <h3>Who is in the two cities</h3>
          <p>
            Pick a group. The cards are official city totals. The board below then shows <strong>where that group lives</strong>,
            if the city published a district table.
          </p>
        </header>
        <div className="ma-peoplefilters" role="tablist" aria-label="Population group">
          {PEOPLE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={filter === f.id ? 'is-on' : ''}
              onClick={() => pickFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="ma-ev">{filterHint}</p>
        <div className="ma-kpi ma-kpi--4">
          {stats.map((s) => (
            <div className="ma-stat" key={s.id}>
              <b>
                {fmt(s.value)}
                {s.unit ? ` ${s.unit}` : ''}
              </b>
              <span>
                {s.city !== 'Both' ? `${s.city} · ` : ''}
                {s.label}
              </span>
              <em>
                {s.asOf} · {s.confidence}
              </em>
            </div>
          ))}
        </div>
        {stats.length === 0 && <p>No sourced figure for this filter in the current city scope.</p>}
      </section>

      <section className="ma-mod">
        <header>
          <h3>{story.question}</h3>
          <p>{cityNote}</p>
        </header>

        {layers.length > 1 && (
          <div className="ma-heat-switch">
            <span>Colours on the board mean</span>
            <div className="ma-peoplefilters ma-peoplefilters--layers">
              {layers.map((l) => (
                <button key={l.id} type="button" className={layer === l.id ? 'is-on' : ''} onClick={() => setLayer(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {top && bottom && (
          <p className="ma-heat-takeaway">
            <strong>
              {heatCity}: most {story.unitWord} in {top.d.name} ({formatLayerValue(layer, top.value)}). Least in{' '}
              {bottom.d.name} ({formatLayerValue(layer, bottom.value)}).
            </strong>{' '}
            Darker tile = higher number. The list on the right is the same data, sorted. Use All / Köln / Bonn at the top of
            the page to switch the board.
          </p>
        )}
        {!ranked.length && (
          <p className="ma-heat-takeaway">
            {heatCity} did not publish this number by district. Use the city cards above.
          </p>
        )}

        <div className="ma-heatlayout">
          <DistrictBoard
            city={heatCity}
            districts={districts}
            layer={layer}
            min={min}
            max={max}
            picked={active?.id ?? null}
            onPick={setPicked}
            showCampuses={showCampuses}
          />
          <ol className="ma-rank">
            {ranked.map((row, i) => (
              <li key={row.d.id}>
                <button type="button" className={active?.id === row.d.id ? 'is-on' : ''} onClick={() => setPicked(row.d.id)}>
                  <em>{i + 1}</em>
                  <span>
                    <strong>{row.d.name.replace(' (Bezirk)', '')}</strong>
                    <small>{row.d.city}</small>
                  </span>
                  <b>{formatLayerValue(layer, row.value)}</b>
                </button>
              </li>
            ))}
          </ol>
        </div>

        {active && (
          <div className="ma-heat-detail">
            <p>
              <strong>{active.name}</strong> — {story.unitWord}:{' '}
              {layerValue(active, layer) != null ? formatLayerValue(layer, layerValue(active, layer) as number) : 'not published'}
            </p>
            <ul>
              {active.residents != null && <li>{fmt(active.residents)} residents</li>}
              {active.densityPerKm2 != null && <li>{fmt(active.densityPerKm2)} people / km²</li>}
              {active.employeesHome != null && <li>{fmt(active.employeesHome)} employees living there</li>}
              {active.nonGerman != null && <li>{fmt(active.nonGerman)} non-German residents</li>}
              {active.asiaNonGerman != null && <li>{fmt(active.asiaNonGerman)} Asian non-German (not India-only)</li>}
              {active.migrationShare != null && <li>{active.migrationShare.toFixed(1)}% migration background</li>}
              {active.purchasingPower != null && <li>purchasing-power index {active.purchasingPower} (city = 100)</li>}
            </ul>
          </div>
        )}

        {showCampuses && (
          <p className="ma-ev">
            Campuses marked on the Köln / Bonn board:{' '}
            {CAMPUSES.filter((c) => c.city === heatCity || city === 'All' || city === 'Compare')
              .filter((c) => city === 'All' || city === 'Compare' || c.city === heatCity)
              .map((c) => `${c.name}`)
              .join(' · ')}
            . Location only.
          </p>
        )}
        <p className="ma-ev">
          Board is a reading aid, not a street map. Left = west, right = east / right bank. Sources:{' '}
          {heatCity === 'Bonn' ? DISTRICT_SOURCES.bonnPop.label : `${DISTRICT_SOURCES.koelnPop.label}; ${DISTRICT_SOURCES.koelnJobs.label}; ${DISTRICT_SOURCES.koelnNation.label}`}.
        </p>
      </section>
    </div>
  )
}

function DistrictBoard({
  city,
  districts,
  layer,
  min,
  max,
  picked,
  onPick,
  showCampuses,
}: {
  city: City
  districts: DistrictRow[]
  layer: HeatLayer
  min: number
  max: number
  picked: string | null
  onPick: (id: string) => void
  showCampuses: boolean
}) {
  return (
    <div className={`ma-board ma-board--${city === 'Bonn' ? 'bonn' : 'koeln'}`} aria-label={`${city} districts`}>
      <div className="ma-board__meta">
        <span>{city}</span>
        <span>West ← → East</span>
        <span>North ↑</span>
      </div>
      {city === 'Köln' && <span className="ma-board__rhine">Rhine</span>}
      {districts.map((d) => {
        const v = layerValue(d, layer)
        const fill = v == null ? undefined : heatColor(v, min, max)
        const dark = v != null && max > min && (v - min) / (max - min) > 0.55
        return (
          <button
            key={d.id}
            type="button"
            className={`ma-tile ${picked === d.id ? 'is-on' : ''} ${v == null ? 'is-empty' : ''} ${dark ? 'is-dark' : ''}`}
            style={{ background: fill, gridArea: d.id }}
            onClick={() => onPick(d.id)}
          >
            <strong>{d.name.replace(' (Bezirk)', '')}</strong>
            <b>{v == null ? '—' : formatLayerValue(layer, v)}</b>
          </button>
        )
      })}
      {showCampuses && city === 'Köln' && (
        <p className="ma-board__camp">Campus: Uni Köln in Lindenthal · TH Deutz / Südstadt · Sporthochschule Müngersdorf</p>
      )}
      {showCampuses && city === 'Bonn' && (
        <p className="ma-board__camp">Campus: Uni Bonn Zentrum · Poppelsdorf · Endenich (Hardtberg side)</p>
      )}
    </div>
  )
}
