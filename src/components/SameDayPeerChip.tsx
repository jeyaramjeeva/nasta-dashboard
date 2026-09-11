import { Money } from './Money'
import type { SameDayPeerEvent } from '../lib/sameDayPeerEvents'

export function SameDayPeerChip({
  peers,
  onOpen,
}: {
  peers: SameDayPeerEvent[]
  onOpen: (eventId: string) => void
}) {
  if (peers.length === 0) return null
  return (
    <div className="peer-event-stack" aria-label="Other events today">
      {peers.map((p) => (
        <button
          key={p.eventId}
          type="button"
          className="peer-event-chip"
          onClick={() => onOpen(p.eventId)}
          title={`Open ${p.title}`}
        >
          <span className="peer-event-chip__kicker">Other event today</span>
          <span className="peer-event-chip__title">{p.title}</span>
          <span className="peer-event-chip__stats">
            Orders: {p.paidCount}
            <br />
            Total: <Money value={p.revenue} />
          </span>
        </button>
      ))}
    </div>
  )
}
