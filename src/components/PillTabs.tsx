import { motion, useReducedMotion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import { springSoft } from '../lib/motion'

export function PillTabs<T extends string>({
  group,
  items,
  value,
  onChange,
  className,
  style,
  trailing,
}: {
  group: string
  items: { id: T; label: ReactNode }[]
  value: T
  onChange: (id: T) => void
  className?: string
  style?: CSSProperties
  trailing?: ReactNode
}) {
  const reduce = useReducedMotion()

  return (
    <div className={['split-mode-row', className].filter(Boolean).join(' ')} style={style}>
      {items.map((item) => {
        const on = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            className={`btn ghost pill-tab${on ? ' is-on' : ''}${on && !reduce ? ' has-glider' : ''}`}
            onClick={() => onChange(item.id)}
          >
            {on && !reduce && (
              <motion.span
                layoutId={`pill-${group}`}
                className="pill-tab__glider"
                transition={springSoft}
              />
            )}
            <span className="pill-tab__text">{item.label}</span>
          </button>
        )
      })}
      {trailing}
    </div>
  )
}
