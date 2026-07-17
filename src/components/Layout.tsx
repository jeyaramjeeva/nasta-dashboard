import { AnimatePresence, motion } from 'framer-motion'
import {
  Banknote,
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  Lightbulb,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  RefreshCw,
  Search,
  Sun,
  Upload,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useLocale } from '../context/LocaleContext'
import { useTheme } from '../context/ThemeContext'
import { formatGermanyDateTime } from '../lib/germanyTime'
import { springSoft } from '../lib/motion'
import { AmbientBackground } from './AmbientBackground'
import { CommandPalette } from './CommandPalette'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/calendar', label: 'Calendar', icon: CalendarRange },
  { to: '/partners', label: 'Partners', icon: Users },
  { to: '/cash', label: 'Cash box', icon: Banknote },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/quick-add', label: 'Quick add', icon: PlusCircle },
]

function formatWhen(iso: string | null) {
  if (!iso) return 'No data yet'
  return formatGermanyDateTime(iso)
}

export function Layout() {
  const { lastSynced, cloudEnabled, loading, refresh } = useData()
  const { resolved, mode, cycleMode } = useTheme()
  const { locale, toggleLocale, tr } = useLocale()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [online, setOnline] = useState(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true),
  )

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const activeIndex = useMemo(() => {
    const idx = links.findIndex((l) =>
      l.to === '/' ? location.pathname === '/' : location.pathname.startsWith(l.to),
    )
    return Math.max(0, idx)
  }, [location.pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <AmbientBackground />
      <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
        <aside className="sidebar">
          <div className="brand">
            <img
              className="brand-logo"
              src="/nasta-logo.png"
              alt="Nasta Zentrum — Frisch. Gesund. Authentisch"
              width={48}
              height={48}
            />
            <div className="brand-text">
              <div className="brand-mark">Nasta Zentrum</div>
              <div className="brand-sub">Frisch · Gesund · Authentisch</div>
            </div>
          </div>

          <nav className="nav">
            <motion.div
              className="nav-active"
              animate={{ y: activeIndex * 48 }}
              transition={springSoft}
            />
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
                title={l.label}
              >
                <l.icon size={18} strokeWidth={1.75} />
                <span>{l.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-tools">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={toggleLocale}
              title={tr('language')}
            >
              {locale.toUpperCase()}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={cycleMode}
              title={`Theme: ${mode}`}
            >
              {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          <div className="sidebar-foot collapsed-hide">
            <div>{cloudEnabled ? 'Cloud sync on' : 'Local + seed mode'}</div>
            <div style={{ marginTop: 4 }}>
              {loading ? 'Syncing…' : `Updated ${formatWhen(lastSynced)}`}
            </div>
            <div style={{ marginTop: 6 }}>
              <span className={`badge ${online ? 'ok' : 'warn'}`}>
                {online ? tr('online') : tr('offline')}
              </span>
            </div>
          </div>
        </aside>

        <main className="main">
          {!online && (
            <div className="alert-item" style={{ marginBottom: '0.75rem' }}>
              {tr('offline')}
            </div>
          )}
          <div className="topbar">
            <button type="button" className="cmd-trigger" onClick={() => setCmdOpen(true)}>
              <Search size={16} />
              <span>Search or jump…</span>
              <kbd>⌘K</kbd>
            </button>
            <div className="page-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={() => void refresh()}
                title="Refresh data"
              >
                <RefreshCw size={16} className={loading ? 'spin' : undefined} />
              </button>
              <button type="button" className="icon-btn" onClick={toggleLocale} title={tr('language')}>
                {locale.toUpperCase()}
              </button>
              <button type="button" className="icon-btn" onClick={cycleMode} title="Toggle theme">
                {resolved === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  )
}
