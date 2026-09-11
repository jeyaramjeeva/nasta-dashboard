import { motion, useReducedMotion } from 'framer-motion'
import {
  CloudRain,
  FileDown,
  Flame,
  MapPin,
  Sparkles,
  StickyNote,
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
import { locationGoCautionSkip, weatherCallBadge } from '../lib/weatherAdvice'
import type { DashboardMetrics } from '../types'
import { useExtras } from '../context/ExtrasContext'
import { useLocale } from '../context/LocaleContext'
import { useSiteConfig } from '../context/SiteConfigContext'
import { isFinishedStall, usesActuals } from '../lib/eventStatus'
import type { BuiltinWidgetId, SiteWidget } from '../lib/siteConfig'
import { LabeledBar } from './LabeledBar'
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
  const { mission, weather } = useExtras()
  const { config } = useSiteConfig()
  const { locale } = useLocale()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const next = useMemo(() => nextStallCard(cards, now), [cards, now])
  const start = next ? parseEventStart(next.event.startDate) : null
  const cd = start ? countdownTo(start, now) : null
  const prep = next ? prepPercent(next) : 0

  const completed = useMemo(
    () => metrics.byEvent.filter((e) => isFinishedStall(e) || usesActuals(e.status)),
    [metrics.byEvent],
  )
  const streak = profitStreak(completed)
  const mood = moneyMood(metrics.net, next?.net ?? null)
  const platePrice = config.settings.platePriceHint || 8
  const plates = next ? platesToBreakEven(next.event, platePrice) : 0
  const locationHint = bestLocationHint(metrics.byLocation)
  const advice = useMemo(
    () =>
      locationGoCautionSkip({
        tag: next?.weather,
        history: metrics.byEvent,
        weatherByEvent: weather,
        event: next?.event,
        locationScores: metrics.byLocation,
      }),
    [next, metrics.byEvent, metrics.byLocation, weather],
  )

  const fallbackMission = next
    ? next.prepNotes.length && next.prep !== 'ready'
      ? `First gap: ${next.prepNotes[0]}.`
      : 'Float ready, fee logged — protect the coin reserve.'
    : 'Schedule the next market date in Excel to unlock missions.'

  const dateLabel = next?.event.startDate
    ? formatGermanyCalendarDay(next.event.startDate)
    : ''

  const visible = config.widgets.filter((w) => w.visible)
  const showCountdown =
    config.settings.showCountdown &&
    visible.some((w) => w.kind === 'builtin' && w.builtinId === 'countdown')
  const gridWidgets = visible.filter(
    (w) => !(w.kind === 'builtin' && w.builtinId === 'countdown'),
  )

  function titleOf(w: SiteWidget) {
    return locale === 'de' ? w.titleDe || w.titleEn : w.titleEn
  }

  function bodyOf(w: SiteWidget) {
    return locale === 'de' ? w.bodyDe || w.bodyEn : w.bodyEn
  }

  function builtinBody(id: BuiltinWidgetId | undefined): ReactNode {
    switch (id) {
      case 'weather':
        return (
          <>
            <span className={`badge ${weatherCallBadge(advice.call)}`} style={{ marginRight: 6 }}>
              {advice.call}
            </span>
            {advice.line}
          </>
        )
      case 'plates':
        return next && plates > 0 ? (
          <>
            Need about <strong>{plates} plates</strong> at €{platePrice} to clear break-even for{' '}
            {next.event.id}. <Link to="/plates">Live counter →</Link>
          </>
        ) : (
          <>Pick an upcoming stall with fee + grocery to unlock plate math.</>
        )
      case 'streak':
        return streak > 0 ? (
          <>
            Last {streak} completed stall{streak === 1 ? '' : 's'} finished in profit. Keep the
            batter flowing.
          </>
        ) : (
          <>No profit streak yet — one solid Flohmarkt can light it.</>
        )
      case 'mood':
        return mood.line
      case 'location':
        return locationHint ? (
          <>
            {locationHint}. <Link to="/insights">See scorecard →</Link>
          </>
        ) : (
          <>Locations will rank here after a few completed events.</>
        )
      default:
        return null
    }
  }

  function builtinTitle(w: SiteWidget): string {
    if (w.builtinId === 'weather') return advice.title
    if (w.builtinId === 'streak' && streak > 0) return `${streak}-stall hot streak`
    if (w.builtinId === 'mood') return mood.title
    return titleOf(w)
  }

  function builtinTone(w: SiteWidget): 'leaf' | 'gold' | 'warn' {
    if (w.builtinId === 'weather') return advice.call === 'go' ? 'leaf' : 'warn'
    if (w.builtinId === 'mood')
      return mood.tone === 'hot' ? 'gold' : mood.tone === 'ok' ? 'leaf' : 'warn'
    if (w.builtinId === 'streak') return 'gold'
    return w.tone
  }

  const countdownTitle =
    visible.find((w) => w.builtinId === 'countdown')?.titleEn || 'Next stall'

  return (
    <div className="home-widgets">
      {showCountdown && next && cd && (
        <motion.div
          className="home-countdown glass-card"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="home-countdown__glow" aria-hidden />
          <div className="home-countdown__top">
            <span className="home-countdown__eyebrow">
              <Timer size={14} />{' '}
              {locale === 'de'
                ? visible.find((w) => w.builtinId === 'countdown')?.titleDe || countdownTitle
                : countdownTitle}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
              <Link to="/calendar" className="hint-inline">
                Open calendar →
              </Link>
            </div>
          </div>

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
              Live today — <Link to="/plates">count plates →</Link>
            </div>
          ) : (
            <div className="home-countdown__digits" aria-label="Countdown">
              <TimeBlock value={cd.days} label="Days" />
              <TimeBlock value={cd.hours} label="Hrs" />
              <TimeBlock value={cd.minutes} label="Min" />
              <TimeBlock value={cd.seconds} label="Sec" pulse={!reduce} />
            </div>
          )}

          <div className="home-countdown__foot">
            <LabeledBar
              percent={prep}
              labels={
                prep >= 90
                  ? ['ready', 'good to go']
                  : ['working now', 'one moment', 'almost there', 'hang tight']
              }
            />
            <div className="home-countdown__expect">
              <div className="kpi-label">Expected net</div>
              <strong>
                {next.net != null ? <Money value={next.net} colored signed /> : '—'}
              </strong>
            </div>
          </div>
        </motion.div>
      )}

      {gridWidgets.length > 0 && (
        <div className="home-widget-grid">
          {gridWidgets.map((w) => {
            if (w.kind === 'note') {
              return (
                <Widget
                  key={w.id}
                  icon={StickyNote}
                  title={titleOf(w)}
                  tone={w.tone}
                  body={bodyOf(w)}
                />
              )
            }
            const Icon =
              w.builtinId === 'weather'
                ? CloudRain
                : w.builtinId === 'plates'
                  ? UtensilsCrossed
                  : w.builtinId === 'streak'
                    ? Flame
                    : w.builtinId === 'mood'
                      ? Sparkles
                      : MapPin
            return (
              <Widget
                key={w.id}
                icon={Icon}
                title={builtinTitle(w)}
                tone={builtinTone(w)}
                body={builtinBody(w.builtinId)}
              />
            )
          })}
        </div>
      )}
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
