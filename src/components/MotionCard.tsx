import type { ReactNode } from 'react'

export function MotionCard({
  children,
  className = '',
  interactive = true,
  onClick,
}: {
  children: ReactNode
  className?: string
  delay?: number
  interactive?: boolean
  onClick?: () => void
}) {
  return (
    <div
      className={`glass-card ${interactive ? 'glass-card--interactive' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <div className="glass-card__shine" aria-hidden />
      {children}
    </div>
  )
}

export function Stagger({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}
