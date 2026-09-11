import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

export function LabeledBar({
  percent,
  labels,
  intervalMs = 2200,
}: {
  percent: number
  labels: string[]
  intervalMs?: number
}) {
  const reduce = useReducedMotion()
  const pct = Math.max(0, Math.min(100, percent))
  const [i, setI] = useState(0)
  const label = labels.length ? labels[i % labels.length] : ''

  useEffect(() => {
    if (reduce || labels.length < 2) return
    const id = window.setInterval(() => setI((n) => n + 1), intervalMs)
    return () => window.clearInterval(id)
  }, [labels.length, intervalMs, reduce])

  return (
    <div className="labeled-bar">
      <div className="labeled-bar__meta">
        <span className="labeled-bar__label" key={label}>
          {label}
        </span>
        <span className="labeled-bar__pct">{Math.round(pct)}%</span>
      </div>
      <div className="labeled-bar__track">
        <motion.div
          className="labeled-bar__fill"
          animate={{ width: `${pct}%` }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: 'spring', stiffness: 140, damping: 20 }
          }
        />
      </div>
    </div>
  )
}
