import { AnimatePresence, motion } from 'framer-motion'
import {
  Banknote,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  EyeOff,
  FlaskConical,
  LayoutDashboard,
  Lightbulb,
  Lock,
  LogOut,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  RefreshCw,
  Search,
  Settings,
  Sun,
  Upload,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useDemoMode } from '../context/DemoModeContext'
import { useExtras } from '../context/ExtrasContext'
import { useLocale } from '../context/LocaleContext'
import { useStallMode } from '../context/StallModeContext'
import { useTheme } from '../context/ThemeContext'
import { canManageUploads } from '../lib/authAllowlist'
import { formatGermanyDateTime } from '../lib/germanyTime'
import { isStallAllowedPath } from '../lib/stallMode'
import { AmbientBackground } from './AmbientBackground'
import { CommandPalette } from './CommandPalette'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, uploadOnly: false, stallOk: false },
  { to: '/events', label: 'Events', icon: CalendarDays, uploadOnly: false, stallOk: false },
  { to: '/calendar', label: 'Calendar', icon: CalendarRange, uploadOnly: false, stallOk: true },
  { to: '/partners', label: 'Partners', icon: Users, uploadOnly: false, stallOk: false },
  { to: '/cash', label: 'Cash box', icon: Banknote, uploadOnly: false, stallOk: false },
  { to: '/insights', label: 'Insights', icon: Lightbulb, uploadOnly: false, stallOk: false },
  { to: '/stock', label: 'Stock', icon: Package, uploadOnly: false, stallOk: true },
  { to: '/orders', label: 'Orders', icon: ClipboardList, uploadOnly: false, stallOk: true },
  { to: '/upload', label: 'Upload', icon: Upload, uploadOnly: true, stallOk: false },
  { to: '/quick-add', label: 'Quick add', icon: PlusCircle, uploadOnly: false, stallOk: false },
  { to: '/playground', label: 'Playground', icon: FlaskConical, uploadOnly: false, stallOk: false },
  { to: '/account', label: 'Account', icon: Settings, uploadOnly: false, stallOk: false },
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
  const { user, signOut, needsNewPassword } = useAuth()
  const { isDemo, exitDemo, resetDemo } = useDemoMode()
  const { isStall, isGuestLocked, enterStall, unlockStall } = useStallMode()
  const { resolved, cycleMode } = useTheme()
  const { locale, toggleLocale, tr } = useLocale()
  const location = useLocation()
  const navigate = useNavigate()
  const canUpload = canManageUploads(user)
  const queued = pendingOffline + pendingOps
  const navLinks = useMemo(
    () =>
      links.filter((l) => {
        if (l.uploadOnly && !canUpload) return false
        if (isStall && !l.stallOk) return false
        return true
      }),
    [canUpload, isStall],
  )
  const [collapsed, setCollapsed] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [unlockPw, setUnlockPw] = useState('')
  const [unlockErr, setUnlockErr] = useState('')
  const [online, setOnline] = useState(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true),
  )

  useEffect(() => {
    if (needsNewPassword && location.pathname !== '/account') {
      navigate('/account', { replace: true })
    }
  }, [needsNewPassword, location.pathname, navigate])

  useEffect(() => {
    if (!isStall) return
    // Password recovery may land on Account — allow that path only then.
    if (needsNewPassword && location.pathname === '/account') return
    if (!isStallAllowedPath(location.pathname)) {
      navigate('/orders', { replace: true })
    }
  }, [isStall, location.pathname, navigate, needsNewPassword])

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
        if (isStall) return
        setCmdOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isStall])

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
            {!isGuestLocked &&
              (!isStall ? (
                <button
                  type="button"
                  className="btn ghost"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => {
                    enterStall()
                    navigate('/orders')
                  }}
                  title="Hide sales & money pages while a helper takes orders"
                >
                  <EyeOff size={16} />
                  <span className="collapsed-hide">Stall mode</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn ghost"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => {
                    setUnlockOpen(true)
                    setUnlockPw('')
                    setUnlockErr('')
                  }}
                  title="Unlock money pages"
                >
                  <Lock size={16} />
                  <span className="collapsed-hide">Unlock</span>
                </button>
              ))}
            <button
              type="button"
              className="icon-btn"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
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
          {isStall && (
            <div className="alert-item stall-banner" style={{ marginBottom: '0.75rem' }}>
              <EyeOff size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              {isGuestLocked ? (
                <>
                  <strong>Guest view</strong> — Calendar, Stock &amp; Orders only. Money pages stay
                  hidden.
                </>
              ) : (
                <>
                  <strong>Stall mode</strong> — sales & money pages hidden. Helpers can take orders
                  only.{' '}
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ display: 'inline', padding: '0.15rem 0.5rem' }}
                    onClick={() => {
                      setUnlockOpen(true)
                      setUnlockPw('')
                      setUnlockErr('')
                    }}
                  >
                    Unlock…
                  </button>
                </>
              )}
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
            <button
              type="button"
              className="cmd-trigger"
              onClick={() => {
                if (!isStall) setCmdOpen(true)
              }}
              disabled={isStall}
              title={isStall ? 'Search disabled in Stall mode' : 'Search or jump'}
            >
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

      {unlockOpen && (
        <div
          className="pay-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Unlock stall mode"
          onClick={() => setUnlockOpen(false)}
        >
          <div className="pay-panel" onClick={(e) => e.stopPropagation()}>
            <h2>
              <Lock size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
              Unlock money pages
            </h2>
            <p className="hint-inline">
              Enter the 4-digit stall PIN (not the Excel publish password). Idle unlock re-locks
              after 2 minutes.
            </p>
            <div className="field" style={{ marginTop: '0.75rem' }}>
              <label htmlFor="stall-unlock-pw">Stall PIN</label>
              <input
                id="stall-unlock-pw"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                value={unlockPw}
                onChange={(e) => {
                  setUnlockPw(e.target.value.replace(/\D/g, '').slice(0, 4))
                  setUnlockErr('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (unlockStall(unlockPw)) {
                      setUnlockOpen(false)
                      setUnlockPw('')
                    } else {
                      setUnlockErr('Wrong PIN')
                    }
                  }
                }}
                placeholder="••••"
              />
            </div>
            {unlockErr && (
              <div className="hint-inline" style={{ color: 'var(--danger)', marginTop: 6 }}>
                {unlockErr}
              </div>
            )}
            <div className="page-actions" style={{ marginTop: '0.85rem' }}>
              <button type="button" className="btn ghost" onClick={() => setUnlockOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (unlockStall(unlockPw)) {
                    setUnlockOpen(false)
                    setUnlockPw('')
                  } else {
                    setUnlockErr('Wrong PIN')
                  }
                }}
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette open={cmdOpen && !isStall} onClose={() => setCmdOpen(false)} />
    </>
  )
}
