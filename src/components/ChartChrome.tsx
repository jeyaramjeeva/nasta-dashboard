import type { ReactNode } from 'react'
import { MotionCard } from './MotionCard'

export function ChartChrome({
  title,
  hint,
  actions,
  children,
  delay = 0,
  className = '',
}: {
  title: string
  hint?: string
  actions?: ReactNode
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <MotionCard className={`chart-chrome ${className}`} delay={delay} interactive={false}>
      <div className="chart-chrome__head">
        <div>
          <h2>{title}</h2>
          {hint && <p className="chart-chrome__hint">{hint}</p>}
        </div>
        {actions && <div className="chart-chrome__actions">{actions}</div>}
      </div>
      <div className="chart-box">{children}</div>
    </MotionCard>
  )
}

export const chartTooltipStyle = {
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--elevated)',
  backdropFilter: 'blur(12px)',
  boxShadow: 'var(--shadow-lg)',
  color: 'var(--text)',
  fontSize: 12,
  padding: '10px 12px',
}

export function euroTick(v: number) {
  return new Intl.NumberFormat('de-DE', {
    notation: 'compact',
    compactDisplay: 'short',
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 1,
  }).format(v)
}

export function euroFull(v: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(v)
}
