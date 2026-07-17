import { AnimatePresence, motion } from 'framer-motion'
import {
  Banknote,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Moon,
  Package,
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
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useDemoMode } from '../context/DemoModeContext'
import { useExtras } from '../context/ExtrasContext'
import { useLocale } from '../context/LocaleContext'
import { useTheme } from '../context/ThemeContext'
import { canManageUploads } from '../lib/authAllowlist'
import { formatGermanyDateTime } from '../lib/germanyTime'
import { AmbientBackground } from './AmbientBackground'
import { CommandPalette } from './CommandPalette'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, uploadOnly: false },
  { to: '/events', label: 'Events', icon: CalendarDays, uploadOnly: false },
  { to: '/calendar', label: 'Calendar', icon: CalendarRange, uploadOnly: false },
  { to: '/partners', label: 'Partners', icon: Users, uploadOnly: false },
  { to: '/cash', label: 'Cash box', icon: Banknote, uploadOnly: false },
  { to: '/insights', label: 'Insights', icon: Lightbulb, uploadOnly: false },
  { to: '/stock', label: 'Stock', icon: Package, uploadOnly: false },
  { to: '/orders', label: 'Orders', icon: ClipboardList, uploadOnly: false },
  { to: '/upload', label: 'Upload', icon: Upload, uploadOnly: true },
  { to: '/quick-add', label: 'Quick add', icon: PlusCircle, uploadOnly: false },
  { to: '/playground', label: 'Playground', icon: FlaskConical, uploadOnly: false },
]

function formatWhen(iso: string | null) {
  if (!iso) return 'No data yet'
  return formatGermanyDateTime(iso)
}

export function Layout() {
  const {
    lastSynced,
    cloudEnabled,
    dataOrigin,
    loading,
    refresh,
    pendingOffline,
    autoPullStatus,
    flushOfflineQueue,
  } = useData()
  const { pendingOps, flushOfflineQueue: flushExtras } = useExtras()
  const { user, signOut } = useAuth()
  const { isDemo, exitDemo, resetDemo } = useDemoMode()
  const { resolved, mode, cycleMode } = useTheme()
  const { locale, toggleLocale, tr } = useLocale()
  const location = useLocation()
  const canUpload = canManageUploads(user)
  const queued = pendingOffline + pendingOps
  const navLinks = useMemo(
    () => links.filter((l) => !l.uploadOnly || canUpload),
    [canUpload],
  )
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
            {navLinks.map((l) => (
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
            {user && (
              <div className="auth-user">
                <div className="auth-user__name">{user.name}</div>
                <div className="auth-user__email">{user.email}</div>
                <button
                  type="button"
                  className="btn ghost auth-user__out"
                  onClick={() => void signOut()}
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
            <div>
              {isDemo ? 'Demo sandbox' : cloudEnabled ? 'Cloud sync on' : 'Local + seed mode'}
            </div>
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
          {isDemo && (
            <div className="alert-item demo-banner" style={{ marginBottom: '0.75rem' }}>
              <FlaskConical size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              <strong>Demo mode</strong> — practice sandbox only. Live Excel, cash, and cloud data
              stay untouched.{' '}
              <button
                type="button"
                className="btn ghost"
                style={{ display: 'inline', padding: '0.15rem 0.5rem' }}
                onClick={resetDemo}
              >
                Reset
              </button>{' '}
              <button
                type="button"
                className="btn ghost"
                style={{ display: 'inline', padding: '0.15rem 0.5rem' }}
                onClick={exitDemo}
              >
                Exit demo
              </button>
            </div>
          )}
          {!isDemo && !online && (
            <div className="alert-item" style={{ marginBottom: '0.75rem' }}>
              {tr('offline')}
              {queued > 0 ? ` · ${queued} change${queued === 1 ? '' : 's'} queued` : ''}
            </div>
          )}
          {!isDemo && online && queued > 0 && (
            <div className="alert-item" style={{ marginBottom: '0.75rem' }}>
              {queued} offline change{queued === 1 ? '' : 's'} waiting.{' '}
              <button
                type="button"
                className="btn ghost"
                style={{ display: 'inline', padding: '0.15rem 0.5rem' }}
                onClick={() => {
                  void flushOfflineQueue()
                  void flushExtras()
                }}
              >
                Sync now
              </button>
            </div>
          )}
          {!isDemo && autoPullStatus && (
            <div className="alert-item" style={{ marginBottom: '0.75rem' }}>
              {autoPullStatus}
            </div>
          )}
          {dataOrigin === 'seed' && !isDemo && (
            <div className="alert-item" style={{ marginBottom: '0.75rem' }}>
              Showing <strong>sample seed data</strong> (old demo file).{' '}
              {canUpload ? (
                <>
                  Upload your latest Excel on{' '}
                  <Link to="/upload" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                    Upload
                  </Link>{' '}
                  → choose <strong>Replace</strong> → publish with password{' '}
                  <code>Nasta998#</code>. A localhost upload does not update this website.
                </>
              ) : (
                <>Ask Jeeva to publish the latest Excel so everyone sees live numbers.</>
              )}
            </div>
          )}
          {isDemo && dataOrigin === 'seed' && (
            <div className="hint-inline" style={{ marginBottom: '0.65rem' }}>
              Demo uses sample stall numbers so you can click around safely.
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
