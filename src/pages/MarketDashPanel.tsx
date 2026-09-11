import { RESEARCH_CHECKED_LABEL, type Flag, type Venue } from '../lib/marketAnalysis'
import { mapsSearchUrl, venueQuery } from '../lib/marketGeo'
import { boolTagDisplay, flagDisplay, mentionsIdli } from '../lib/marketDecision'
import { LayerBadge } from './MarketIntel'

function Attr({ label, value }: { label: string; value: Flag }) {
  const d = flagDisplay(value)
  return (
    <li>
      <span>{label}</span>
      <strong className={`ma-attr ma-attr--${d.level}`}>{d.text}</strong>
    </li>
  )
}

export function RestaurantPanel({
  venue,
  onClose,
}: {
  venue: Venue
  onClose: () => void
}) {
  const q = venueQuery(venue)
  const query = encodeURIComponent([venue.address, venue.city].filter(Boolean).join(', ') || venue.name)

  return (
    <aside className="ma-drawer" role="dialog" aria-label={venue.name}>
      <header className="ma-drawer__head">
        <div>
          <p className="ma-kicker">
            {venue.city} · {venue.district}
          </p>
          <h2>{venue.name}</h2>
        </div>
        <button type="button" className="ma-btn ma-btn--ghost" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="ma-drawer__body">
        <p>
          <LayerBadge kind="observed" /> Last checked {RESEARCH_CHECKED_LABEL}
        </p>
        <p>
          {venue.address || 'Address not verified'}, {venue.postal} {venue.city}
        </p>
        <p>
          <a
            href={`https://www.openstreetmap.org/search?query=${query}`}
            target="_blank"
            rel="noreferrer"
          >
            Map
          </a>
          {venue.website ? (
            <>
              {' · '}
              <a href={venue.website} target="_blank" rel="noreferrer">
                Website
              </a>
            </>
          ) : (
            ' · Website not verified'
          )}
        </p>
        <p>
          Cuisine {venue.cuisine.join(', ')} · Price {venue.price}
        </p>
        <p>
          Rating {venue.google.rating != null ? `${venue.google.rating.toFixed(1)} ★` : 'Not retrieved'} · Reviews{' '}
          {venue.google.reviewCount != null ? venue.google.reviewCount.toLocaleString('de-DE') : 'Not retrieved'}
        </p>
        <p>
          Vegetarian: {venue.veg} · Vegan: {venue.vegan}
        </p>
        <p>
          Status: <strong>{venue.status === 'Unknown' ? 'Status unknown' : venue.status}</strong>
        </p>
        <p className="ma-ev">{venue.statusEvidence}</p>
        <ul className="ma-attrlist">
          <Attr label="Dosa" value={venue.dosa} />
          <li>
            <span>Idli</span>
            <strong className={`ma-attr ma-attr--${mentionsIdli(venue) ? 'observed' : 'unknown'}`}>
              {mentionsIdli(venue) ? 'Mentioned in notes' : 'Not verified'}
            </strong>
          </li>
          <Attr label="Thali" value={venue.thali} />
          <Attr label="Lunch" value={venue.lunch} />
          <Attr label="Buffet" value={venue.buffet} />
          <Attr label="Delivery" value={venue.delivery} />
          <li>
            <span>Street food</span>
            <strong className={`ma-attr ma-attr--${boolTagDisplay(venue.streetFood, 'Tagged').level}`}>
              {boolTagDisplay(venue.streetFood, 'Tagged').text}
            </strong>
          </li>
        </ul>
        <p>
          <strong>Evidence.</strong> {venue.google.note || venue.statusEvidence}
        </p>
        <p>
          <strong>Notes.</strong> {venue.distinctive}
        </p>
        <p>
          <strong>Strengths.</strong> {venue.strengths}
        </p>
        <p>
          <strong>Weaknesses.</strong> {venue.weaknesses}
        </p>
        <p className="ma-ev">
          Record confidence {venue.confidence} ·{' '}
          <a href={mapsSearchUrl(q)} target="_blank" rel="noreferrer">
            OSM search
          </a>
          {venue.google.sourceUrl ? (
            <>
              {' · '}
              <a href={venue.google.sourceUrl} target="_blank" rel="noreferrer">
                Rating source
              </a>
            </>
          ) : null}
        </p>
      </div>
    </aside>
  )
}
