import {
  AnimatePresence,
  motion,
} from 'framer-motion'
import {
  Banknote,
  BookOpen,
  Bot,
  CalendarDays,
  CalendarRange,
  ChefHat,
  Contact,
  ClipboardList,
  Code2,
  EyeOff,
  FlaskConical,
  LayoutDashboard,
  Lightbulb,
  ListTodo,
  Lock,
  LogOut,
  MapPinned,
  MessageCircle,
  MessageSquare,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Sun,
  Target,
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
import { useEditUi } from '../context/EditUiContext'
import { useSiteConfig } from '../context/SiteConfigContext'
import { useStallMode } from '../context/StallModeContext'
import { useStallOps } from '../context/StallOpsContext'
import { useTheme } from '../context/ThemeContext'
import { canDevelop, canManageUploads, canUseAiHelper, isJeevaAccount } from '../lib/authAllowlist'
import { formatGermanyDateTime } from '../lib/germanyTime'
import { isGuestUser } from '../lib/guestAuth'
import { isStallAllowedPath, isStallUnlockedSession } from '../lib/stallMode'
import { buildCalendarCards } from '../lib/calendar'
import { isOpenUpcomingStall } from '../lib/eventStatus'
import { germanyTodayYmd } from '../lib/germanyTime'
import { snapshotHasStallDayToday } from '../lib/loginOpenToday'
import { previewStallDayLabel } from '../lib/stallDayPreview'
import { inspirationForEventDay } from '../lib/todoReminders'
import type { SiteNavItem } from '../lib/siteConfig'
import { FloatingDock } from './FloatingDock'
import { TillTrainingBanner } from './TillTrainingBanner'
import { AmbientBackground } from './AmbientBackground'
import { CommandPalette } from './CommandPalette'
import { dueSoonTodos, TodoReminderRunner } from './TodoReminderRunner'
import { isStaleChunkError, reloadOnceForStaleChunk } from '../lib/staleChunk'

const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  events: CalendarDays,
  kitchen: ChefHat,
  plan: CalendarRange,
  money: Banknote,
  calendar: CalendarRange,
  partners: Users,
  cash: Banknote,
  insights: Lightbulb,
  'market-analysis': MapPinned,
  team: MessageCircle,
  stock: Package,
  food: ChefHat,
  cards: Contact,
  orders: ClipboardList,
  learn: BookOpen,
  todos: ListTodo,
  reviews: MessageSquare,
  goals: Target,
  'ai-helper': Bot,
  'ai-code': Code2,
  upload: Upload,
  'quick-add': PlusCircle,
  playground: FlaskConical,
  studio: Sparkles,
  account: Settings,
}

function navIcon(id: string) {
  if (NAV_ICONS[id]) return NAV_ICONS[id]
  if (id.startsWith('feature-')) return Sparkles
  return Sparkles
}

function canSeeNav(
  item: SiteNavItem,
  opts: {
    isGuest: boolean
    canUpload: boolean
    canHelper: boolean
    isDev: boolean
    isStall: boolean
    isJeeva: boolean
  },
): boolean {
  if (!item.visible) return false
  if (opts.isStall && !item.stallOk) return false
  switch (item.audience) {
    case 'guest':
      return opts.isGuest
    case 'developer':
      return opts.isDev
    case 'jeeva':
      return opts.isJeeva && !opts.isGuest
    case 'team':
      if (opts.isGuest) return false
      // AI helper + Team live as floating corner buttons, not sidebar tabs.
      if (item.id === 'ai-helper' || item.to === '/ai-helper') return false
      if (item.id === 'team' || item.to === '/team') return false
      if (item.id === 'intel' || item.to === '/intel') return false
      if (item.id === 'reviews' || item.to === '/reviews') return !opts.isGuest
      return true
    case 'all':
    default:
      if (opts.isGuest) return item.stallOk || item.id === 'account'
      return true
  }
}

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
    metrics,
    snapshot,
  } = useData()
  const { pendingOps, flushOfflineQueue: flushExtras, weather } = useExtras()
  const { teamTodos } = useStallOps()
  const { user, signOut, needsNewPassword } = useAuth()
  const { isDemo, exitDemo, resetDemo, isTillTraining } = useDemoMode()
  const { isStall, isGuestLocked, enterStall, unlockStall } = useStallMode()
  const { resolved, cycleMode } = useTheme()
  const { locale, toggleLocale, tr } = useLocale()
  const { config: siteConfig } = useSiteConfig()
  const { editUi, toggleEditUi, canEditUi } = useEditUi()
  // locale cycles EN → DE → TA → KA
  const location = useLocation()
  const navigate = useNavigate()
  const canUpload = canManageUploads(user)
  const canHelper = canUseAiHelper(user)
  const isDev = canDevelop(user)
  const isGuest = isGuestUser(user)
  const isJeeva = isJeevaAccount(user)
  const todayYmd = germanyTodayYmd()
  const dummyStallLabel = previewStallDayLabel()
  const todaysEvent = useMemo(() => {
    if (!metrics || !snapshot) return null
    const cards = buildCalendarCards(snapshot, metrics, weather)
    return (
      cards.find(
        (c) =>
          isOpenUpcomingStall(c.event) &&
          (c.dateSpan?.includes(todayYmd) || c.event.startDate === todayYmd),
      ) || null
    )
  }, [metrics, snapshot, weather, todayYmd])
  const soonTodos = useMemo(() => dueSoonTodos(teamTodos), [teamTodos])
  // Both contexts read the same offline queue — don't double-count
  const queued = Math.max(pendingOffline, pendingOps)
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const navLinks = useMemo(() => {
    const opts = { isGuest, canUpload, canHelper, isDev, isStall, isJeeva }
    const fromConfig = siteConfig.nav
      .filter((n) => canSeeNav(n, opts))
      .map((n) => ({
        ...n,
        icon: navIcon(n.id),
        label: locale === 'de' ? n.labelDe : n.labelEn,
      }))
    if (
      !isStall &&
      !fromConfig.some((n) => n.to === '/market-analysis' || n.id === 'market-analysis')
    ) {
      fromConfig.splice(
        Math.max(
          0,
          fromConfig.findIndex((n) => n.id === 'insights') + 1,
        ),
        0,
        {
          id: 'market-analysis',
          to: '/market-analysis',
          labelEn: 'Market analysis',
          labelDe: 'Marktanalyse',
          visible: true,
          audience: 'all',
          stallOk: false,
          icon: MapPinned,
          label: locale === 'de' ? 'Marktanalyse' : 'Market analysis',
        },
      )
    }
    return fromConfig
  }, [siteConfig.nav, isGuest, canUpload, canHelper, isDev, isStall, isJeeva, locale])
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
    if (needsNewPassword || isGuestLocked || isStall) return
    if (isStallUnlockedSession()) return
    if (!snapshotHasStallDayToday(snapshot)) return
    enterStall()
    navigate('/orders', { replace: true })
  }, [snapshot, needsNewPassword, isGuestLocked, isStall, enterStall, navigate])

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
              <div className="brand-mark">{siteConfig.text.brandName}</div>
              {siteConfig.settings.showBrandSub && (
                <div className="brand-sub">
                  {locale === 'de'
                    ? siteConfig.text.brandTaglineDe
                    : siteConfig.text.brandTaglineEn}
                </div>
              )}
            </div>
          </div>

          <nav className="nav">
            {navLinks.map((l) => (
              <NavLink
                key={l.id}
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

          <div className="sidebar-dock">
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
                    title={tr('stallMode')}
                  >
                    <EyeOff size={16} />
                    <span className="collapsed-hide">{tr('stallMode')}</span>
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
                    title={tr('unlock')}
                  >
                    <Lock size={16} />
                    <span className="collapsed-hide">{tr('unlock')}</span>
                  </button>
                ))}
              {user && (
                <button
                  type="button"
                  className="btn ghost auth-user__out"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => void signOut()}
                  title={`${tr('signOut')} · ${user.name}`}
                >
                  <LogOut size={16} />
                  <span className="collapsed-hide">{tr('signOut')}</span>
                </button>
              )}
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
                </div>
              )}
              <div>
                {isDemo
                  ? tr('demoSandbox')
                  : cloudEnabled
                    ? tr('cloudSyncOn')
                    : tr('localSeedMode')}
              </div>
              <div style={{ marginTop: 4 }}>
                {loading ? tr('syncing') : `${tr('updated')} ${formatWhen(lastSynced)}`}
              </div>
              <div style={{ marginTop: 6 }}>
                <span className={`badge ${online ? 'ok' : 'warn'}`}>
                  {online ? tr('online') : tr('offline')}
                </span>
              </div>
            </div>
          </div>
        </aside>

        <main className="main">
          <TodoReminderRunner />
          {dummyStallLabel && (
            <div className="alert-item" style={{ marginBottom: '0.75rem' }}>
              <strong>{dummyStallLabel}</strong>
              {' — '}
              Not a real market. Sign out and sign in to try stall-day login, or Unlock to leave
              stall mode.
            </div>
          )}
          {todaysEvent && (
            <div className="alert-item" style={{ marginBottom: '0.75rem' }}>
              <strong>Event day — {todaysEvent.event.location || todaysEvent.event.id}</strong>
              {' — '}
              {inspirationForEventDay(todaysEvent.event.location || todaysEvent.event.id)}
            </div>
          )}
          {soonTodos.length > 0 && !isGuest && (
            <div className="alert-item" style={{ marginBottom: '0.75rem' }}>
              <ListTodo size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              Due soon:{' '}
              {soonTodos
                .slice(0, 3)
                .map((t) => `${t.assignee || 'Team'}: ${t.text}`)
                .join(' · ')}{' '}
              <Link to="/todos" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                Open to-dos
              </Link>
            </div>
          )}
          {isTillTraining ? (
            <TillTrainingBanner />
          ) : isDemo ? (
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
          ) : null}
          {isStall && (
            <div className="alert-item stall-banner" style={{ marginBottom: '0.75rem' }}>
              <EyeOff size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              {isGuestLocked ? (
                <>
                  <strong>{tr('guestView')}</strong> — {tr('calendar')}, {tr('stock')} &amp;{' '}
                  {tr('orders')}.
                </>
              ) : (
                <>
                  <strong>{tr('stallMode')}</strong>
                  <span className="hint-inline">
                    {' '}
                    — chat &amp; AI off · data saver on (less cloud GB).{' '}
                  </span>
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
                    {tr('unlock')}…
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
          {!isDemo && online && (queued > 0 || syncMsg) && (
            <div className="alert-item" style={{ marginBottom: '0.75rem' }}>
              {queued > 0
                ? `${queued} offline change${queued === 1 ? '' : 's'} waiting. `
                : null}
              {syncMsg ? `${syncMsg} ` : null}
              <button
                type="button"
                className="btn ghost"
                style={{ display: 'inline', padding: '0.15rem 0.5rem' }}
                disabled={syncBusy}
                onClick={() => {
                  setSyncBusy(true)
                  setSyncMsg(null)
                  void (async () => {
                    try {
                      // Unified flush: pushes local menu photos + drains queue (no race)
                      await flushExtras()
                      await flushOfflineQueue()
                      setSyncMsg(
                        queued > 0
                          ? 'Synced. Refresh the customer /order page to see photos.'
                          : 'Synced.',
                      )
                    } catch (e) {
                      if (isStaleChunkError(e) && reloadOnceForStaleChunk()) return
                      setSyncMsg(
                        e instanceof Error ? e.message : 'Sync failed — try again online.',
                      )
                    } finally {
                      setSyncBusy(false)
                    }
                  })()
                }}
              >
                {syncBusy ? 'Syncing…' : syncMsg && !/fail/i.test(syncMsg) ? 'Synced' : 'Sync now'}
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
                <>Ask the Developer account to publish the latest Excel so everyone sees live numbers.</>
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
              title={tr('searchOrJump')}
            >
              <Search size={16} />
              <span>{tr('searchOrJump')}</span>
              <kbd>⌘K</kbd>
            </button>
            <div className="page-actions">
              {canEditUi && (
                <button
                  type="button"
                  className={`icon-btn${editUi ? ' is-on' : ''}`}
                  onClick={toggleEditUi}
                  title={editUi ? 'Edit UI on — click pens to change labels' : 'Turn on Edit UI'}
                  aria-pressed={editUi}
                >
                  <Pencil size={16} />
                </button>
              )}
              <button
                type="button"
                className="icon-btn"
                onClick={() => void refresh()}
                title="Refresh data"
              >
                <RefreshCw size={16} className={loading ? 'spin' : undefined} />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={toggleLocale}
                title={`${tr('language')}: EN / DE / TA / KA`}
              >
                {locale.toUpperCase()}
              </button>
              <button type="button" className="icon-btn" onClick={cycleMode} title="Toggle theme">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={resolved}
                    className="theme-toggle__icon"
                    initial={{ rotate: -80, opacity: 0, scale: 0.55 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 80, opacity: 0, scale: 0.55 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                  >
                    {resolved === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>
          </div>

          <Outlet />
        </main>
      </div>

      <AnimatePresence>
      {unlockOpen && (
        <motion.div
          key="unlock"
          className="pay-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Unlock stall mode"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setUnlockOpen(false)}
        >
          <motion.div
            className="pay-panel"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
          >
            <h2>
              <Lock size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
              {tr('unlock')}
            </h2>
            <p className="hint-inline">Enter the 4-digit stall PIN.</p>
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
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <CommandPalette open={cmdOpen && !isStall} onClose={() => setCmdOpen(false)} />
      <FloatingDock />
    </>
  )
}
