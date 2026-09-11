import { motion, useReducedMotion } from 'framer-motion'

export type SpendSlice = {
  label: string
  amount: number
  tone?: 'accent' | 'ok' | 'warn'
}

export function SpendStack({
  slices,
  total,
}: {
  slices: SpendSlice[]
  total?: number
}) {
  const reduce = useReducedMotion()
  const usable = slices.filter((s) => s.amount > 0)
  const sum = usable.reduce((n, s) => n + s.amount, 0)
  const cap = total && total > 0 ? total : sum
  if (!usable.length || cap <= 0) return null

  return (
    <div className="spend-stack">
      <div className="spend-stack__track">
        {usable.map((s) => (
          <motion.span
            key={s.label}
            className={`spend-stack__slice spend-stack__slice--${s.tone || 'accent'}`}
            title={`${s.label} · ${s.amount.toFixed(0)}`}
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${Math.max(3, (s.amount / cap) * 100)}%` }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: 'spring', stiffness: 160, damping: 22 }
            }
          />
        ))}
      </div>
      <ul className="spend-stack__legend">
        {usable.map((s) => (
          <li key={s.label}>
            <span className={`spend-stack__dot spend-stack__slice--${s.tone || 'accent'}`} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
