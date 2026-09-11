import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { VENUES } from '../lib/marketAnalysis'

export const TOC = [
  ['overview', 'Overview'],
  ['koeln', 'Köln'],
  ['bonn', 'Bonn'],
  ['stalls', 'Our stalls'],
  ['database', 'Database'],
  ['map', 'Map'],
  ['compare', 'Compare'],
  ['veg', 'Vegetarian'],
  ['vegan', 'Vegan'],
  ['regional', 'Regional'],
  ['price', 'Price'],
  ['ratings', 'Ratings'],
  ['sentiment', 'Sentiment'],
  ['menu', 'Menus'],
  ['hours', 'Hours'],
  ['delivery', 'Delivery'],
  ['location', 'Location'],
  ['gaps', 'Gaps'],
  ['concepts', 'Concepts'],
  ['segments', 'Segments'],
  ['models', 'Models'],
  ['finance', 'Finance'],
  ['risks', 'Risks'],
  ['cities', 'Köln vs Bonn'],
  ['decision', 'Recommendation'],
  ['sources', 'Sources'],
] as const

const OPEN_BY_DEFAULT = new Set(['overview', 'stalls', 'map', 'compare', 'finance', 'decision'])

export function jumpToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const details = el.querySelector('details')
  if (details) details.open = true
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function HowToRead() {
  return (
    <aside className="ma-howto" aria-label="How to read this page">
      <p className="ma-kicker">30 seconds</p>
      <h2>How to read this page</h2>
      <ol>
        <li>
          <strong>Answer first.</strong> The verdict at the top updates when you change city or concept. It is a
          judgment on this evidence, not a guarantee.
        </li>
        <li>
          <strong>Our stalls are the only first-party demand.</strong> Sales and location from the 15 events you
          already ran count. Stall fees do not — they are event rent, not restaurant rent.
        </li>
        <li>
          <strong>Ratings are snapshots.</strong> Last checked date is real. 30 / 90 / 365-day growth is unknown
          until a second scrape exists. The map is live OSM pins, not live Google stars.
        </li>
        <li>
          <strong>Empty is not opportunity.</strong> A missing 100% veg room is a gap with two 2026 closures. Use
          filters, compare three rooms, then walk the rings on the map.
        </li>
      </ol>
    </aside>
  )
}

export function StickyTools({
  onPickVenue,
}: {
  onPickVenue: (id: string) => void
}) {
  const [active, setActive] = useState('overview')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const nodes = TOC.map(([id]) => document.getElementById(id)).filter((n): n is HTMLElement => !!n)
    if (!nodes.length) return
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target.id) setActive(visible.target.id)
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0.15, 0.4] },
    )
    for (const n of nodes) io.observe(n)
    return () => io.disconnect()
  }, [])

  const hits = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return []
    const sections = TOC.filter(([, label]) => label.toLowerCase().includes(n)).map(([id, label]) => ({
      kind: 'section' as const,
      id,
      label,
    }))
    const venues = VENUES.filter((v) =>
      `${v.name} ${v.district} ${v.city}`.toLowerCase().includes(n),
    ).map((v) => ({ kind: 'venue' as const, id: v.id, label: `${v.name} · ${v.city}` }))
    return [...sections, ...venues].slice(0, 12)
  }, [q])

  function go(hit: { kind: 'section' | 'venue'; id: string }) {
    if (hit.kind === 'section') jumpToSection(hit.id)
    else {
      onPickVenue(hit.id)
      jumpToSection('database')
      requestAnimationFrame(() => {
        document.getElementById(`venue-${hit.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
    setQ('')
    setOpen(false)
  }

  return (
    <div className="ma-sticky">
      <div className="ma-sticky__search">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Jump to a section or restaurant"
          aria-label="Jump to a section or restaurant"
        />
        {open && hits.length > 0 && (
          <ul className="ma-jump">
            {hits.map((h) => (
              <li key={`${h.kind}-${h.id}`}>
                <button type="button" onClick={() => go(h)}>
                  <span>{h.kind === 'section' ? 'Section' : 'Restaurant'}</span>
                  {h.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <nav className="ma-chips" aria-label="Sections">
        {TOC.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className={active === id ? 'is-on' : ''}
            onClick={(e) => {
              e.preventDefault()
              jumpToSection(id)
            }}
          >
            {label}
          </a>
        ))}
      </nav>
    </div>
  )
}

export function MaSection({
  id,
  title,
  children,
  defaultOpen,
}: {
  id: string
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <section id={id} className="ma-sec" data-ma-sec={id}>
      <details open={defaultOpen ?? OPEN_BY_DEFAULT.has(id)}>
        <summary>
          <h2>{title}</h2>
        </summary>
        <div className="ma-sec__body">{children}</div>
      </details>
    </section>
  )
}

export function setAllSections(open: boolean) {
  document.querySelectorAll<HTMLDetailsElement>('.ma-sec details').forEach((d) => {
    d.open = open
  })
}

export function printCurrentView() {
  window.print()
}
