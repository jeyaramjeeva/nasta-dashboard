import { Minus, Plus, UtensilsCrossed } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MotionCard } from '../components/MotionCard'
import { EmptyState, SkeletonPage } from '../components/Skeleton'
import { useData } from '../context/DataContext'
import { fetchPlateCount, upsertPlateCount } from '../lib/cloudExtras'
import { germanyTodayYmd } from '../lib/germanyTime'
import { nextStallCard, platesToBreakEven } from '../lib/homeWidgets'
import { buildCalendarCards } from '../lib/calendar'
import { enqueueOffline, offlineQueueCount } from '../lib/offlineQueue'
import { demoStorageKey, isDemoMode } from '../lib/demoMode'
import { isCloudConfigured } from '../lib/supabase'
import { useExtras } from '../context/ExtrasContext'

const LOCAL_PLATES = 'nasta-plates-local-v1'

function platesStoreKey() {
  return demoStorageKey(LOCAL_PLATES)
}

function localKey(eventId: string, day: string) {
  return `${eventId}|${day}`
}

function loadLocalPlates(eventId: string, day: string): number {
  try {
    const all = JSON.parse(localStorage.getItem(platesStoreKey()) || '{}') as Record<
      string,
      number
    >
    return all[localKey(eventId, day)] || 0
  } catch {
    return 0
  }
}

function saveLocalPlates(eventId: string, day: string, plates: number) {
  try {
    const all = JSON.parse(localStorage.getItem(platesStoreKey()) || '{}') as Record<
      string,
      number
    >
    all[localKey(eventId, day)] = plates
    localStorage.setItem(platesStoreKey(), JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

function platesCloudOn() {
  return isCloudConfigured() && !isDemoMode()
}

export function Plates() {
  const { snapshot, metrics, loading } = useData()
  const { weather } = useExtras()
  const today = germanyTodayYmd()
  const [eventId, setEventId] = useState('')
  const [plates, setPlates] = useState(0)
  const [price, setPrice] = useState(8)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(() => offlineQueueCount())

  const cards = useMemo(() => {
    if (!metrics || !snapshot) return []
    return buildCalendarCards(snapshot, metrics, weather)
  }, [metrics, snapshot, weather])

  const next = useMemo(() => nextStallCard(cards), [cards])
  const activeId = eventId || next?.event.id || metrics?.byEvent[0]?.id || ''

  const eventMetrics = metrics?.byEvent.find((e) => e.id === activeId)
  const breakEvenPlates = eventMetrics ? platesToBreakEven(eventMetrics, price) : 0
  const revenue = plates * price

  useEffect(() => {
    if (!activeId) return
    let cancelled = false
    ;(async () => {
      const local = loadLocalPlates(activeId, today)
      setPlates(local)
      if (platesCloudOn() && navigator.onLine) {
        const remote = await fetchPlateCount(activeId, today)
        if (!cancelled && remote) {
          setPlates(remote.plates)
          setPrice(remote.platePrice || 8)
          saveLocalPlates(activeId, today, remote.plates)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeId, today])

  async function persist(nextPlates: number, nextPrice = price) {
    if (!activeId) return
    setPlates(nextPlates)
    saveLocalPlates(activeId, today, nextPlates)
    const row = {
      eventId: activeId,
      countedAt: today,
      plates: nextPlates,
      platePrice: nextPrice,
    }
    if (!platesCloudOn()) {
      setMsg(isDemoMode() ? 'Saved in demo sandbox only.' : 'Saved on this device.')
      return
    }
    if (!navigator.onLine) {
      enqueueOffline({ kind: 'plate_count', payload: row })
      setPending(offlineQueueCount())
      setMsg('Saved offline — will sync when online.')
      return
    }
    try {
      await upsertPlateCount(row)
      setMsg('Synced to cloud.')
    } catch {
      enqueueOffline({ kind: 'plate_count', payload: row })
      setPending(offlineQueueCount())
      setMsg('Saved offline — will sync when online.')
    }
  }

  if (loading) return <SkeletonPage />
  if (!metrics || !snapshot) {
    return <EmptyState title="No events" body="Upload Excel first, then count plates live." />
  }

  const options = metrics.byEvent.filter((e) => e.status !== 'Completed' || e.id === activeId)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <UtensilsCrossed size={22} style={{ verticalAlign: -3, marginRight: 8 }} />
            Plate counter
          </h1>
          <p>Tap during the stall. Counts sync to the team cloud (and queue offline).</p>
        </div>
      </div>

      <MotionCard interactive={false} className="upload-panel">
        <div className="field">
          <label htmlFor="plate-event">Event</label>
          <select
            id="plate-event"
            value={activeId}
            onChange={(e) => setEventId(e.target.value)}
          >
            {options.map((e) => (
              <option key={e.id} value={e.id}>
                {e.id} · {e.location}
              </option>
            ))}
          </select>
        </div>

        <div className="plate-counter">
          <button
            type="button"
            className="btn ghost plate-counter__btn"
            onClick={() => void persist(Math.max(0, plates - 1))}
            aria-label="Minus one plate"
          >
            <Minus size={28} />
          </button>
          <div className="plate-counter__value">
            <div className="plate-counter__num">{plates}</div>
            <div className="hint-inline">plates today</div>
          </div>
          <button
            type="button"
            className="btn plate-counter__btn"
            onClick={() => void persist(plates + 1)}
            aria-label="Plus one plate"
          >
            <Plus size={28} />
          </button>
        </div>

        <div className="page-actions" style={{ marginTop: '1rem', justifyContent: 'center' }}>
          <button type="button" className="btn ghost" onClick={() => void persist(plates + 5)}>
            +5
          </button>
          <button type="button" className="btn ghost" onClick={() => void persist(plates + 10)}>
            +10
          </button>
          <button type="button" className="btn ghost" onClick={() => void persist(0)}>
            Reset
          </button>
        </div>

        <div className="filters" style={{ marginTop: '1rem' }}>
          <div className="field">
            <label htmlFor="plate-price">€ / plate</label>
            <input
              id="plate-price"
              type="number"
              min={0}
              step={0.5}
              value={price}
              onChange={(e) => {
                const v = Number(e.target.value) || 0
                setPrice(v)
                void persist(plates, v)
              }}
            />
          </div>
        </div>

        <div className="chip-row" style={{ marginTop: '0.85rem' }}>
          <span className="badge ok">Revenue ~ €{revenue.toFixed(0)}</span>
          <span className={`badge ${plates >= breakEvenPlates && breakEvenPlates > 0 ? 'ok' : 'warn'}`}>
            Break-even ~ {breakEvenPlates || '—'} plates
          </span>
          {pending > 0 && <span className="badge warn">{pending} queued offline</span>}
        </div>
        {msg && <div className="hint-inline" style={{ marginTop: '0.65rem' }}>{msg}</div>}
      </MotionCard>
    </>
  )
}
