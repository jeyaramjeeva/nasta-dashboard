import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { RESEARCH_CHECKED_LABEL, type Venue } from '../lib/marketAnalysis'
import {
  KPI_DATASET_NOTE,
  KPI_DEFS,
  closedWhen,
  kpiBreakdown,
  kpiEmptyCopy,
  kpiVenues,
  type KpiId,
} from '../lib/marketKpiDefs'
import type { CityMode } from '../lib/marketKpis'

const PREVIEW_N = 4

function canHover() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function placeLine(v: Venue) {
  return v.district ? `${v.city} · ${v.district}` : v.city
}

function lineFor(v: Venue, id: KpiId) {
  const def = KPI_DEFS[id]
  const bits = [placeLine(v), def.tag(v)]
  if (v.google.rating != null) {
    bits.push(
      `${v.google.rating.toFixed(1)} ★${v.google.reviewCount != null ? ` · ${v.google.reviewCount.toLocaleString('de-DE')} reviews` : ''}`,
    )
  }
  if (id !== 'closed' && v.status !== 'Open') bits.push(v.status)
  return bits.filter(Boolean).join(' · ')
}

function recentClosed(venues: Venue[]) {
  return [...venues]
    .sort((a, b) => {
      const ay = Number(closedWhen(a).match(/20\d{2}/)?.[0] ?? 0)
      const by = Number(closedWhen(b).match(/20\d{2}/)?.[0] ?? 0)
      return by - ay
    })
    .slice(0, 2)
}

export function InteractiveKpiCard({
  id,
  venues,
  city,
  compare,
  title,
  subtitle,
  lastUpdated,
  trend,
  breakdown,
  onOpenList,
  onOpenVenue,
}: {
  id: KpiId
  venues: Venue[]
  city?: CityMode
  compare?: boolean
  title?: string
  subtitle?: string
  lastUpdated?: string
  trend?: string
  breakdown?: { köln: number; bonn: number; total?: number }
  onOpenList: (id: KpiId) => void
  onOpenVenue?: (v: Venue) => void
}) {
  const def = KPI_DEFS[id]
  const count = venues.length
  const split = breakdown ?? kpiBreakdown(venues)
  const uid = useId()
  const root = useRef<HTMLDivElement>(null)
  const leaveTimer = useRef<number | undefined>(undefined)
  const [preview, setPreview] = useState(false)
  const [sheet, setSheet] = useState(false)
  const shown = venues.slice(0, PREVIEW_N)
  const more = count - shown.length
  const empty = kpiEmptyCopy(id, city)
  const heading = title ?? def.title
  const note = subtitle ?? def.subtitle
  const freshness = lastUpdated ?? KPI_DATASET_NOTE

  function cancelLeave() {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
  }

  function openPreview() {
    if (!canHover()) return
    cancelLeave()
    setPreview(true)
  }

  function scheduleClose(next?: EventTarget | null) {
    if (next instanceof Node && root.current?.contains(next)) return
    cancelLeave()
    leaveTimer.current = window.setTimeout(() => setPreview(false), 120)
  }

  function activate() {
    if (canHover()) {
      onOpenList(id)
      return
    }
    setSheet(true)
  }

  useEffect(() => () => cancelLeave(), [])

  useEffect(() => {
    if (!sheet) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSheet(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet])

  return (
    <div
      className="ma-kpicard"
      ref={root}
      onMouseEnter={openPreview}
      onMouseLeave={(e) => scheduleClose(e.relatedTarget)}
    >
      <button
        type="button"
        className="ma-stat ma-stat--kpi"
        aria-describedby={`${uid}-hint`}
        aria-expanded={preview || sheet}
        onClick={activate}
        onFocus={openPreview}
        onBlur={(e) => scheduleClose(e.relatedTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            activate()
          }
        }}
      >
        <b>{count.toLocaleString('de-DE')}</b>
        <span>{heading}</span>
        <em>{note}</em>
        {compare && count > 0 && (
          <em>
            Köln {split.köln} · Bonn {split.bonn} · Total {split.total ?? count}
          </em>
        )}
        {trend && <em>{trend}</em>}
        {id === 'closed' && count > 0 && (
          <ul className="ma-stat__recent">
            {recentClosed(venues).map((v) => (
              <li key={v.id}>
                {v.name}
                <small>
                  {v.city} · Closed {closedWhen(v)}
                </small>
              </li>
            ))}
          </ul>
        )}
        <i className="ma-stat__go">{count === 0 ? 'Why this is 0 →' : def.goLabel}</i>
      </button>
      <p id={`${uid}-hint`} className="ma-sr">
        {count} businesses. {canHover() ? 'Hover for names, activate to open the filtered list.' : 'Activate to see the businesses.'} {freshness}.
      </p>

      {preview && canHover() && (
        <div className="ma-kpop" role="dialog" aria-label={`${heading} preview`} onMouseEnter={openPreview}>
          <p className="ma-kpop__head">
            <strong>{heading}</strong>
            <span>
              {count} {count === 1 ? 'business' : 'businesses'}
            </span>
          </p>
          {count === 0 ? (
            <p className="ma-ev">{empty}</p>
          ) : (
            <KpiVenueList
              id={id}
              venues={shown}
              onOpenVenue={
                onOpenVenue
                  ? (v) => {
                      setPreview(false)
                      onOpenVenue(v)
                    }
                  : undefined
              }
            />
          )}
          {more > 0 && <p className="ma-ev">+ {more} more in the full list</p>}
          <p className="ma-ev">{freshness}</p>
          {count > 0 && (
            <button type="button" className="ma-btn ma-btn--ghost" onClick={() => onOpenList(id)}>
              View all {count} →
            </button>
          )}
        </div>
      )}

      {sheet && (
        <div
          className="ma-ksheet"
          role="dialog"
          aria-modal="true"
          aria-label={heading}
          onClick={() => setSheet(false)}
        >
          <div className="ma-ksheet__panel" onClick={(e) => e.stopPropagation()}>
            <header>
              <div>
                <h3>{heading}</h3>
                <p>
                  {count} {count === 1 ? 'business' : 'businesses'} · last checked {RESEARCH_CHECKED_LABEL}
                </p>
              </div>
              <button type="button" className="ma-btn ma-btn--ghost" onClick={() => setSheet(false)}>
                Close
              </button>
            </header>
            {count === 0 ? (
              <p>{empty}</p>
            ) : (
              <>
                <KpiVenueList
                  id={id}
                  venues={venues}
                  onOpenVenue={
                    onOpenVenue
                      ? (v) => {
                          setSheet(false)
                          onOpenVenue(v)
                        }
                      : undefined
                  }
                />
                <button
                  type="button"
                  className="ma-btn"
                  onClick={() => {
                    setSheet(false)
                    onOpenList(id)
                  }}
                >
                  View all {count} →
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiVenueList({
  id,
  venues,
  onOpenVenue,
}: {
  id: KpiId
  venues: Venue[]
  onOpenVenue?: (v: Venue) => void
}) {
  return (
    <ul className="ma-kpop__list">
      {venues.map((v) => {
        const body = (
          <>
            <strong>{v.name}</strong>
            <span>{lineFor(v, id)}</span>
            {id === 'closed' && <span>Closed since: {closedWhen(v)}</span>}
          </>
        )
        return (
          <li key={v.id}>
            {onOpenVenue ? (
              <button type="button" onClick={() => onOpenVenue(v)}>
                {body}
              </button>
            ) : (
              <div>{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function MarketKpiCard({
  id,
  city,
  compare,
  title,
  subtitle,
  trend,
  onOpenList,
  onOpenVenue,
}: {
  id: KpiId
  city: CityMode
  compare?: boolean
  title?: string
  subtitle?: string
  trend?: string
  onOpenList: (id: KpiId) => void
  onOpenVenue?: (v: Venue) => void
}) {
  const venues = useMemo(() => kpiVenues(city, id), [city, id])
  return (
    <InteractiveKpiCard
      id={id}
      venues={venues}
      city={city}
      compare={compare ?? city === 'Compare'}
      title={title}
      subtitle={subtitle}
      trend={trend}
      onOpenList={onOpenList}
      onOpenVenue={onOpenVenue}
    />
  )
}
