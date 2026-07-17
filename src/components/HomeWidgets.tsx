import { motion, useReducedMotion } from 'framer-motion'
import {
  CloudRain,
  FileDown,
  Flame,
  MapPin,
  Sparkles,
  Target,
  Timer,
  UtensilsCrossed,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { CalendarEventCard } from '../lib/calendar'
import { downloadStallBriefingPdf } from '../lib/briefingPdf'
import { formatGermanyCalendarDay } from '../lib/germanyTime'
import {
  bestLocationHint,
  countdownTo,
  moneyMood,
  nextStallCard,
  parseEventStart,
  platesToBreakEven,
  prepPercent,
  profitStreak,
} from '../lib/homeWidgets'
import { weatherCallBadge, weatherGoCautionSkip } from '../lib/weatherAdvice'
import type { DashboardMetrics } from '../types'
import { useAuth } from '../context/AuthContext'
import { useExtras } from '../context/ExtrasContext'
import { canManageUploads } from '../lib/authAllowlist'
import { Money } from './Money'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function HomeWidgets({
  cards,
  metrics,
}: {
  cards: CalendarEventCard[]
  metrics: DashboardMetrics
}) {
  const reduce = useReducedMotion()
  const { user } = useAuth()
  const canUpload = canManageUploads(user)
  const { mission, setMission, weather } = useExtras()
  const [now, setNow] = useState(() => new Date())
  const [draftMission, setDraftMission] = useState(mission)

  useEffect(() => {
    setDraftMission(mission)
  }, [mission])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const next = useMemo(() => nextStallCard(cards, now), [cards, now])
  const start = next ? parseEventStart(next.event.startDate) : null
  const cd = start ? countdownTo(start, now) : null
  const prep = next ? prepPercent(next) : 0

  const completed = useMemo(
    () => metrics.byEvent.filter((e) => e.status === 'Completed'),
    [metrics.byEvent],
  )
  const streak = profitStreak(completed)
  const mood = moneyMood(metrics.net, next?.net ?? null)
  const plates = next ? platesToBreakEven(next.event, 8) : 0
  const locationHint = bestLocationHint(metrics.byLocation)
  const advice = useMemo(
    () => weatherGoCautionSkip(next?.weather, metrics.byEvent, weather),
    [next, metrics.byEvent, weather],
  )

  const fallbackMission = next
    ? next.prepNotes.length && next.prep !== 'ready'
      ? `First gap: ${next.prepNotes[0]}.`
      : 'Float ready, fee logged — protect the coin reserve.'
    : 'Schedule the next market date in Excel to unlock missions.'

  const dateLabel = next?.event.startDate
    ? formatGermanyCalendarDay(next.event.startDate)
    : ''

  return (
    <div className="home-widgets">
      <motion.div
        className="home-countdown glass-card"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="home-countdown__glow" aria-hidden />
        <div className="home-countdown__top">
          <span className="home-countdown__eyebrow">
            <Timer size={14} /> Next stall
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {next ? (
              <button
                type="button"
                className="btn ghost"
                style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                onClick={() =>
                  downloadStallBriefingPdf({
                    card: next,
                    mission: mission || fallbackMission,
                    weatherAdvice: advice,
                    platesNeeded: plates,
                  })
                }
              >
                <FileDown size={14} /> Briefing
              </button>
            ) : null}
            {next ? (
              <Link to="/calendar" className="hint-inline">
                Open calendar →
              </Link>
            ) : null}
          </div>
        </div>

        {next && cd ? (
          <>
            <div className="home-countdown__title">
              <strong>{next.event.id}</strong>
              <span>
                {next.event.name} · {next.event.location}
              </span>
            </div>
            <div className="home-countdown__meta">
              {dateLabel}
              {next.totalDays > 1 ? ` · ${next.totalDays}-day stall` : ''}
            </div>

            {cd.isLive ? (
              <div className="home-countdown__live">
                <span className="home-live-dot" />
                Live today —{' '}
                <Link to="/plates">count plates →</Link>
              </div>
            ) : cd.isPast ? (
              <div className="home-countdown__live is-past">Stall window passed</div>
            ) : (
              <div className="home-countdown__digits" aria-label="Countdown">
                <TimeBlock value={cd.days} label="Days" />
                <TimeBlock value={cd.hours} label="Hrs" />
                <TimeBlock value={cd.minutes} label="Min" />
                <TimeBlock value={cd.seconds} label="Sec" pulse={!reduce} />
              </div>
            )}

            <div className="home-countdown__foot">
              <div className="home-prep">
                <div className="home-prep__label">Prep readiness</div>
                <div className="home-prep__bar">
                  <motion.div
                    className="home-prep__fill"
                    animate={{ width: `${prep}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                  />
                </div>
                <div className="home-prep__pct">{prep}%</div>
              </div>
              <div className="home-countdown__expect">
                <div className="kpi-label">Expected net</div>
                <strong>
                  {next.net != null ? <Money value={next.net} colored signed /> : '—'}
                </strong>
              </div>
            </div>
          </>
        ) : (
          <div className="home-countdown__empty">
            <p>No upcoming stall dated yet.</p>
            {canUpload ? (
              <Link className="btn ghost" to="/upload">
                Sync Excel dates
              </Link>
            ) : (
              <p style={{ opacity: 0.75, margin: 0 }}>Ask Jeeva to sync Excel dates.</p>
            )}
          </div>
        )}
      </motion.div>

      <div className="home-widget-grid">
        <Widget
          icon={CloudRain}
          title={advice.title}
          tone={advice.call === 'go' ? 'leaf' : 'warn'}
          body={
            <>
              <span className={`badge ${weatherCallBadge(advice.call)}`} style={{ marginRight: 6 }}>
                {advice.call}
              </span>
              {advice.line}
            </>
          }
        />
        <Widget
          icon={UtensilsCrossed}
          title="Plate hunt"
          tone="leaf"
          body={
            next && plates > 0 ? (
              <>
                Need about <strong>{plates} plates</strong> at €8 to clear break-even for{' '}
                {next.event.id}. <Link to="/plates">Live counter →</Link>
              </>
            ) : (
              <>Pick an upcoming stall with fee + grocery to unlock plate math.</>
            )
          }
        />
        <Widget
          icon={Flame}
          title={streak > 0 ? `${streak}-stall hot streak` : 'Streak kitchen'}
          tone="gold"
          body={
            streak > 0 ? (
              <>
                Last {streak} completed stall{streak === 1 ? '' : 's'} finished in profit. Keep the
                batter flowing.
              </>
            ) : (
              <>No profit streak yet — one solid Flohmarkt can light it.</>
            )
          }
        />
        <Widget
          icon={Sparkles}
          title={mood.title}
          tone={mood.tone === 'hot' ? 'gold' : mood.tone === 'ok' ? 'leaf' : 'warn'}
          body={mood.line}
        />
        <Widget
          icon={MapPin}
          title="Lucky pitch"
          tone="leaf"
          body={
            locationHint ? (
              <>
                {locationHint}.{' '}
                <Link to="/insights">See scorecard →</Link>
              </>
            ) : (
              <>Locations will rank here after a few completed events.</>
            )
          }
        />
        <div className="home-chip glass-card home-chip--warn">
          <div className="home-chip__icon">
            <Target size={16} strokeWidth={1.75} />
          </div>
          <div style={{ width: '100%' }}>
            <div className="home-chip__title">Today’s mission</div>
            {canUpload ? (
              <div className="home-chip__body">
                <textarea
                  value={draftMission}
                  onChange={(e) => setDraftMission(e.target.value)}
                  rows={2}
                  placeholder={fallbackMission}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    marginTop: 4,
                    font: 'inherit',
                    background: 'var(--surface-2, transparent)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '0.4rem 0.5rem',
                    color: 'inherit',
                  }}
                />
                <button
                  type="button"
                  className="btn ghost"
                  style={{ marginTop: 6, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                  onClick={() => setMission(draftMission.trim())}
                >
                  Save mission
                </button>
              </div>
            ) : (
              <div className="home-chip__body">{mission || fallbackMission}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TimeBlock({
  value,
  label,
  pulse,
}: {
  value: number
  label: string
  pulse?: boolean
}) {
  return (
    <div className={`home-time ${pulse ? 'is-pulse' : ''}`}>
      <div className="home-time__num">{pad(value)}</div>
      <div className="home-time__label">{label}</div>
    </div>
  )
}

function Widget({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: typeof Flame
  title: string
  body: ReactNode
  tone: 'leaf' | 'gold' | 'warn'
}) {
  return (
    <div className={`home-chip glass-card home-chip--${tone}`}>
      <div className="home-chip__icon">
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <div>
        <div className="home-chip__title">{title}</div>
        <div className="home-chip__body">{body}</div>
      </div>
    </div>
  )
}
