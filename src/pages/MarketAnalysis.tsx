import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RESEARCH_CHECKED_LABEL, VENUES, type Venue } from '../lib/marketAnalysis'
import { type KpiId } from '../lib/marketKpiDefs'
import { buildKpis, DATA_STATUS, type CityMode } from '../lib/marketKpis'
import { printCurrentView } from './MarketAnalysisShell'
import { LiveOsmMap } from './MarketAnalysisLive'
import { RestaurantPanel } from './MarketDashPanel'
import { RecBlock } from './MarketIntel'
import {
  CaseView,
  CompetitorsView,
  CustomersView,
  OpportunitiesView,
  OverviewView,
} from './MarketDashViews'
import './marketAnalysis.css'

const PRIMARY = [
  ['overview', 'Overview'],
  ['competitors', 'Competitors'],
  ['map', 'Map'],
  ['customers', 'Customers'],
  ['opportunities', 'Opportunities'],
  ['case', 'Business case'],
] as const

type Primary = (typeof PRIMARY)[number][0]

export function MarketAnalysis() {
  const [primary, setPrimary] = useState<Primary>('overview')
  const [city, setCity] = useState<CityMode>('All')
  const [selected, setSelected] = useState<Venue | null>(null)
  const [panel, setPanel] = useState(false)
  const [compSub, setCompSub] = useState('database')
  const [custSub, setCustSub] = useState('people')
  const [oppSub, setOppSub] = useState('matrix')
  const [caseSub, setCaseSub] = useState('model')
  const [oppFocus, setOppFocus] = useState<string | null>(null)
  const [kpiFilter, setKpiFilter] = useState<KpiId | null>(null)
  const [params] = useSearchParams()

  const k = useMemo(() => buildKpis(city === 'Compare' ? 'All' : city), [city])
  const mapCity = city === 'Bonn' ? 'Bonn' : city === 'Köln' ? 'Köln' : 'All'

  function openVenue(v: Venue) {
    setSelected(v)
    setPanel(true)
  }

  function openOpp(id: string) {
    setOppFocus(id)
    setOppSub(id)
    setPrimary('opportunities')
  }

  function openKpi(id: KpiId) {
    setKpiFilter(id)
    setCompSub('database')
    setPrimary('competitors')
  }

  useEffect(() => {
    const tab = params.get('tab') as Primary | null
    if (tab && PRIMARY.some(([id]) => id === tab)) setPrimary(tab)
    const venueId = params.get('venue')
    if (venueId) {
      const v = VENUES.find((x) => x.id === venueId)
      if (v) {
        setSelected(v)
        setPanel(true)
        setPrimary('competitors')
      }
    }
    const concept = params.get('concept')
    if (concept) {
      setOppFocus(concept)
      setOppSub(concept)
      setPrimary('opportunities')
    }
    const vegan = params.get('vegan')
    if (vegan === 'vegan-focus') setKpiFilter('vegan-focus')
    const veg = params.get('veg')
    if (veg === 'veg-focus') setKpiFilter('veg-focus')
    if (params.get('south') === '1') setKpiFilter('south')
    const status = params.get('status')
    if (status === 'Permanently closed') setKpiFilter('closed')
    if (params.get('reviewsMin')) setKpiFilter('reviewed')
    const sub = params.get('sub')
    if (sub) setCaseSub(sub)
  }, [params])

  return (
    <div className={`ma ma--app ma-dash ${panel ? 'has-drawer' : ''}`}>
      <header className="ma-top ma-dashhead">
        <div>
          <div className="ma-brand">
            <img src="/nasta-logo.png" alt="" width={32} height={32} />
            Market Analysis
          </div>
          <p className="ma-dashhead__title">Indian food market · Köln + Bonn</p>
          <p className="ma-meta ma-meta--left">
            {k.total} businesses · Köln {k.koeln} · Bonn {k.bonn} · Updated {RESEARCH_CHECKED_LABEL}
          </p>
        </div>
        <div className="ma-dashhead__status">
          <span className="ma-status ma-status--partial">{DATA_STATUS.label}</span>
          <div className="ma-top__actions">
            <button type="button" className="ma-btn" onClick={printCurrentView}>
              Print / PDF
            </button>
          </div>
        </div>
      </header>

      <div className="ma-dashbar">
        <nav className="ma-primary" aria-label="Market analysis">
          {PRIMARY.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={primary === id ? 'is-on' : ''}
              onClick={() => {
                if (id === 'competitors' && primary !== 'competitors') setKpiFilter(null)
                setPrimary(id)
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="ma-citysw" role="group" aria-label="City">
          {(['All', 'Köln', 'Bonn', 'Compare'] as const).map((c) => (
            <button key={c} type="button" className={city === c ? 'is-on' : ''} onClick={() => setCity(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {primary === 'competitors' && (
        <nav className="ma-subnav ma-dashsub" aria-label="Competitors">
          {['database', 'compare', 'ratings', 'prices', 'menus'].map((id) => (
            <button key={id} type="button" className={compSub === id ? 'is-on' : ''} onClick={() => setCompSub(id)}>
              {id[0].toUpperCase() + id.slice(1)}
            </button>
          ))}
        </nav>
      )}

      <div className="ma-dashbody">
        <main className="ma-dashmain">
          {primary === 'overview' && (
            <OverviewView
              city={city}
              onOpenOpp={openOpp}
              onOpenVenue={openVenue}
              onOpenKpi={openKpi}
              go={(t) => setPrimary(t as Primary)}
            />
          )}
          {primary === 'competitors' && (
            <CompetitorsView
              city={city}
              onOpen={openVenue}
              sub={compSub}
              kpiFilter={kpiFilter}
              onClearKpi={() => setKpiFilter(null)}
            />
          )}
          {primary === 'map' && (
            <section className="ma-mod">
              <header>
                <h3>Competitor map</h3>
              </header>
              <LiveOsmMap onOpenVenue={openVenue} focusVenueId={selected?.id} city={mapCity} />
              <RecBlock page="map" city={city} />
            </section>
          )}
          {primary === 'customers' && <CustomersView city={city} sub={custSub} onSub={setCustSub} />}
          {primary === 'opportunities' && (
            <OpportunitiesView
              city={city}
              sub={oppSub}
              onSub={setOppSub}
              focusId={oppFocus}
              onOpenKpi={openKpi}
              onOpenVenue={openVenue}
            />
          )}
          {primary === 'case' && <CaseView city={city} sub={caseSub} onSub={setCaseSub} />}
        </main>
        {panel && selected && <RestaurantPanel venue={selected} onClose={() => setPanel(false)} />}
      </div>
    </div>
  )
}
