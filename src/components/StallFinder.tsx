import { motion } from 'framer-motion'
import { MapPin, Navigation, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { springSoft } from '../lib/motion'

export interface PublicStall {
  id: string
  name: string
  location: string
  mapsQuery?: string | null
  city: string
  startDate: string | null
  endDate: string | null
  status: string
  phase: 'open' | 'closed_today' | 'upcoming' | 'past'
  open: boolean
  mapsUrl: string
  mapsEmbed: string
}

export function StallFinder({ lang = 'en' }: { lang?: 'en' | 'de' }) {
  const [stalls, setStalls] = useState<PublicStall[]>([])
  const [selected, setSelected] = useState<PublicStall | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/public-stalls')
      const data = (await res.json()) as { stalls?: PublicStall[]; warning?: string }
      const list = data.stalls || []
      setStalls(list)
      setSelected((prev) => {
        if (prev && list.some((s) => s.id === prev.id)) {
          return list.find((s) => s.id === prev.id) || list[0] || null
        }
        return list.find((s) => s.open) || list[0] || null
      })
      if (data.warning && !list.length) setError(data.warning)
    } catch {
      setError(lang === 'de' ? 'Karte gerade nicht erreichbar.' : 'Map unavailable right now.')
    } finally {
      setLoading(false)
    }
  }, [lang])

  useEffect(() => {
    void load()
  }, [load])

  const de = lang === 'de'

  return (
    <section className="stall-finder" id="stall-map" aria-label={de ? 'Stand finden' : 'Find our stall'}>
      <div className="stall-finder__head">
        <div>
          <h2>
            <MapPin size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
            {de ? 'Stand finden' : 'Find our stall'}
          </h2>
          <p className="hint-inline">
            {de
              ? 'Nächste Märkte · offen / geschlossen · Route in Google Maps'
              : 'Next markets · open / closed · directions in Google Maps'}
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} /> {de ? 'Aktualisieren' : 'Refresh'}
        </button>
      </div>

      {loading && <p className="hint-inline">{de ? 'Lade Standorte…' : 'Loading stalls…'}</p>}
      {error && !stalls.length && <p className="hint-inline">{error}</p>}
      {!loading && !stalls.length && !error && (
        <p className="hint-inline">
          {de
            ? 'Noch keine bestätigten Märkte in der Nähe — schau bald wieder vorbei.'
            : 'No upcoming stalls listed yet — check back soon.'}
        </p>
      )}

      {stalls.length > 0 && (
        <div className="stall-finder__grid">
          <ul className="stall-finder__list">
            {stalls.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`stall-finder__item${selected?.id === s.id ? ' is-on' : ''}`}
                  onClick={() => setSelected(s)}
                >
                  <span
                    className={`stall-finder__badge stall-finder__badge--${
                      s.open ? 'open' : s.phase === 'closed_today' ? 'today' : 'soon'
                    }`}
                  >
                    {s.open
                      ? de
                        ? 'Offen'
                        : 'Open'
                      : s.phase === 'closed_today'
                        ? de
                          ? 'Heute (zu)'
                          : 'Today (closed)'
                        : de
                          ? 'Demnächst'
                          : 'Upcoming'}
                  </span>
                  <strong>
                    {s.id} · {s.name}
                  </strong>
                  <span className="hint-inline">{s.location}</span>
                  {s.mapsQuery ? (
                    <span className="hint-inline stall-finder__pin">📍 {s.mapsQuery}</span>
                  ) : null}
                  <span className="hint-inline">
                    {s.startDate}
                    {s.endDate && s.endDate !== s.startDate ? ` → ${s.endDate}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <motion.div
              key={selected.id}
              className="stall-finder__map"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springSoft}
            >
              <iframe
                title={selected.location}
                src={selected.mapsEmbed}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
              <a
                className="btn"
                href={selected.mapsUrl}
                target="_blank"
                rel="noreferrer"
                style={{ marginTop: '0.65rem' }}
              >
                <Navigation size={14} />{' '}
                {de ? 'Route öffnen' : 'Open directions'}
              </a>
            </motion.div>
          )}
        </div>
      )}
    </section>
  )
}
