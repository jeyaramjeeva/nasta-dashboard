import { motion, useReducedMotion } from 'framer-motion'
import { NavLink } from 'react-router-dom'
import { springSoft } from '../lib/motion'

export interface HubTab {
  to: string
  end?: boolean
  labelEn: string
  labelDe: string
}

export function HubTabs({
  tabs,
  locale = 'en',
}: {
  tabs: HubTab[]
  locale?: string
}) {
  const reduce = useReducedMotion()

  return (
    <nav className="hub-tabs" aria-label="Section">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `hub-tabs__tab${isActive ? ' is-active' : ''}${isActive && !reduce ? ' has-glider' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && !reduce && (
                <motion.span
                  layoutId="hub-tabs-pill"
                  className="hub-tabs__glider"
                  transition={springSoft}
                />
              )}
              <span className="hub-tabs__label">{locale === 'de' ? t.labelDe : t.labelEn}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
