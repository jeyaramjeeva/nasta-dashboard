import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CountUp } from './CountUp'
import { MotionCard } from './MotionCard'
import { Sparkline } from './Sparkline'

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  spark,
  trend,
  badge,
  selected,
  onClick,
  to,
  delay = 0,
  format,
}: {
  label: string
  value: number
  hint?: ReactNode
  icon: LucideIcon
  tone?: 'neutral' | 'positive' | 'negative' | 'accent'
  spark?: number[]
  trend?: number | null
  badge?: string
  selected?: boolean
  onClick?: () => void
  to?: string
  delay?: number
  format?: (n: number) => string
}) {
  const content = (
    <>
      <div className="kpi-top">
        <div className={`kpi-icon kpi-icon--${tone}`}>
          <Icon size={18} strokeWidth={1.75} />
        </div>
        <div className="kpi-top-right">
          {badge && <span className="status-pill">{badge}</span>}
          {trend != null && Number.isFinite(trend) && (
            <span className={`trend ${trend >= 0 ? 'up' : 'down'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value tone-${tone}`}>
        <CountUp value={value} format={format} />
      </div>
      <div className="kpi-foot">
        <div className="kpi-hint">{hint}</div>
        {spark && spark.length > 1 && (
          <Sparkline
            values={spark}
            color={
              tone === 'negative'
                ? 'var(--danger)'
                : tone === 'positive'
                  ? 'var(--ok)'
                  : 'var(--accent)'
            }
          />
        )}
      </div>
    </>
  )

  if (to) {
    return (
      <MotionCard className={`kpi-card ${selected ? 'is-selected' : ''}`} delay={delay}>
        <Link to={to} className="kpi-link">
          {content}
        </Link>
      </MotionCard>
    )
  }

  return (
    <MotionCard
      className={`kpi-card ${selected ? 'is-selected' : ''} ${onClick ? 'is-clickable' : ''}`}
      delay={delay}
      onClick={onClick}
      interactive={Boolean(onClick)}
    >
      {content}
    </MotionCard>
  )
}
