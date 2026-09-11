import { GraduationCap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDemoMode } from '../context/DemoModeContext'
import { readTillTrainingMeta } from '../lib/tillTraining'

function formatLeft(ms: number): string {
  if (ms <= 0) return '0:00'
  const s = Math.ceil(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function TillTrainingBanner() {
  const { isTillTraining, resetDemo, exitDemo } = useDemoMode()
  const [now, setNow] = useState(() => Date.now())
  const meta = isTillTraining ? readTillTrainingMeta() : null

  useEffect(() => {
    if (!isTillTraining) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [isTillTraining])

  if (!isTillTraining || !meta) return null

  const left = meta.until - now
  const dayLabel = meta.usedLastSaturday ? 'last Saturday' : meta.dayYmd
  const timedOut = left <= 0

  return (
    <div className="alert-item demo-banner" style={{ marginBottom: '0.75rem' }} role="status">
      <GraduationCap size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
      <strong>Till training</strong>
      {' — '}
      {meta.eventLabel} menu from {dayLabel}. Fake tickets only; live sales are untouched.{' '}
      {timedOut ? (
        <span>5 minutes is up — keep practicing or exit.</span>
      ) : (
        <span>
          {formatLeft(left)} left · New order → Pending pay → Sold
        </span>
      )}{' '}
      <button
        type="button"
        className="btn ghost"
        style={{ display: 'inline', padding: '0.15rem 0.5rem' }}
        onClick={resetDemo}
      >
        Restart
      </button>{' '}
      <button
        type="button"
        className="btn ghost"
        style={{ display: 'inline', padding: '0.15rem 0.5rem' }}
        onClick={exitDemo}
      >
        Exit training
      </button>
    </div>
  )
}
