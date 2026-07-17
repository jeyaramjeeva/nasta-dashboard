import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { fadeUp, springSoft } from '../lib/motion'

export function MotionCard({
  children,
  className = '',
  delay = 0,
  interactive = true,
  onClick,
}: {
  children: ReactNode
  className?: string
  delay?: number
  interactive?: boolean
  onClick?: () => void
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={`glass-card ${interactive ? 'glass-card--interactive' : ''} ${className}`}
      variants={reduce ? undefined : fadeUp}
      initial={reduce ? false : 'hidden'}
      animate={reduce ? undefined : 'show'}
      transition={{ ...springSoft, delay }}
      whileHover={
        reduce || !interactive
          ? undefined
          : { y: -4, transition: springSoft }
      }
      whileTap={reduce || !interactive ? undefined : { scale: 0.985 }}
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
    </motion.div>
  )
}

export function Stagger({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: reduce ? 0 : 0.07 } },
      }}
    >
      {children}
    </motion.div>
  )
}
