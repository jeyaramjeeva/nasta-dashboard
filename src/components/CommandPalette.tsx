import { AnimatePresence, motion } from 'framer-motion'
import {
  Banknote,
  Code2,
  FlaskConical,
  LayoutDashboard,
  Lightbulb,
  MapPinned,
  PlusCircle,
  Search,
  Settings,
  Upload,
  Users,
  Package,
  ChefHat,
  Contact,
  ClipboardList,
  CalendarDays,
  CalendarRange,
  ListTodo,
  MessageSquare,
  Sparkles,
  Target,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canDevelop, isJeevaAccount } from '../lib/authAllowlist'
import { isGuestUser } from '../lib/guestAuth'
import { springSnappy } from '../lib/motion'
import { searchMarket } from '../lib/marketCommand'

const ACTIONS = [
  { id: 'dash', label: 'Dashboard', hint: 'Overview & KPIs', to: '/', icon: LayoutDashboard, guestOnly: false, developerOnly: false },
  { id: 'market', label: 'Market analysis', hint: 'Köln / Bonn Indian restaurant study', to: '/market-analysis', icon: MapPinned, guestOnly: false, developerOnly: false, jeevaOnly: true },
  { id: 'events', label: 'Events', hint: 'Scorecards & filters', to: '/events', icon: CalendarDays, guestOnly: false, developerOnly: false },
  { id: 'kitchen', label: 'Kitchen', hint: 'Stock, food prep, cards', to: '/kitchen', icon: ChefHat, guestOnly: false, developerOnly: false },
  { id: 'plan', label: 'Plan', hint: 'Calendar, to-dos, Learn DE', to: '/plan', icon: CalendarRange, guestOnly: false, developerOnly: false },
  { id: 'money', label: 'Money', hint: 'Cash box & partners', to: '/money', icon: Banknote, guestOnly: false, developerOnly: false },
  { id: 'calendar', label: 'Calendar', hint: 'Prep, weather, inventory', to: '/plan', icon: CalendarRange, guestOnly: false, developerOnly: false },
  { id: 'partners', label: 'Partners', hint: 'Balances & settlements', to: '/money/partners', icon: Users, guestOnly: false, developerOnly: false },
  { id: 'cash', label: 'Cash box', hint: 'Ledger vs count', to: '/money', icon: Banknote, guestOnly: false, developerOnly: false },
  { id: 'insights', label: 'Insights', hint: 'Live intel, locations & forecasts', to: '/insights', icon: Lightbulb, guestOnly: false, developerOnly: false },
  { id: 'stock', label: 'Stall stock', hint: 'Buy / use / remaining', to: '/kitchen', icon: Package, guestOnly: false, developerOnly: false },
  { id: 'food', label: 'Food prep', hint: 'Made / sold / remaining by day', to: '/kitchen/food', icon: ChefHat, guestOnly: false, developerOnly: false },
  { id: 'cards', label: 'Business cards', hint: 'Photo front/back + contacts', to: '/kitchen/cards', icon: Contact, guestOnly: false, developerOnly: false },
  { id: 'orders', label: 'Orders', hint: 'Pending tickets & sold count', to: '/orders', icon: ClipboardList, guestOnly: false, developerOnly: false },
  { id: 'todos', label: 'To-dos', hint: 'Tasks, assignees, reminders', to: '/plan/todos', icon: ListTodo, guestOnly: false, developerOnly: false },
  { id: 'reviews', label: 'Reviews', hint: 'Customer QR feedback', to: '/insights/reviews', icon: MessageSquare, guestOnly: false, developerOnly: false },
  { id: 'goals', label: 'Goals', hint: 'Main target & milestones', to: '/insights/goals', icon: Target, guestOnly: false, developerOnly: false },
  { id: 'ai-code', label: 'AI Code Agent', hint: 'Developer — Cursor edits repo + PR', to: '/ai-code', icon: Code2, guestOnly: false, developerOnly: true },
  { id: 'playground', label: 'Till training', hint: '5-minute practice on last Saturday’s menu', to: '/playground', icon: FlaskConical, guestOnly: false, developerOnly: false },
  { id: 'upload', label: 'Upload Excel', hint: 'Publish weekly sheet', to: '/upload', icon: Upload, guestOnly: false, developerOnly: true },
  { id: 'quick', label: 'Quick add', hint: 'Log expense on the go', to: '/quick-add', icon: PlusCircle, guestOnly: false, developerOnly: true },
  { id: 'studio', label: 'Developer Studio', hint: 'Edit text, UI, tabs, team tools', to: '/studio', icon: Sparkles, guestOnly: false, developerOnly: true },
  { id: 'account', label: 'Account', hint: 'Change password & profile', to: '/account', icon: Settings, guestOnly: false, developerOnly: false },
]

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isDev = canDevelop(user)
  const isGuest = isGuestUser(user)
  const isJeeva = isJeevaAccount(user)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const items = useMemo(() => {
    const allowed = ACTIONS.filter((a) => {
      if (a.developerOnly && !isDev) return false
      if ('jeevaOnly' in a && a.jeevaOnly && !isJeeva) return false
      if (a.guestOnly && !isGuest) return false
      if (
        isGuest &&
        !['calendar', 'stock', 'orders', 'todos', 'reviews', 'playground'].includes(a.id)
      )
        return false
      return true
    })
    const query = q.trim().toLowerCase()
    const pages = !query
      ? allowed
      : allowed.filter(
          (a) => a.label.toLowerCase().includes(query) || a.hint.toLowerCase().includes(query),
        )
    const market = isJeeva && query ? searchMarket(q) : []
    return { pages, market }
  }, [q, isGuest, isDev, isJeeva])

  function run(to: string) {
    navigate(to)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cmd-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="cmd-palette"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={springSnappy}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cmd-input-row">
              <Search size={16} />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search or jump… vegan restaurants, South Indian Köln, Ganesha"
              />
            </div>
            <ul className="cmd-list">
              {items.pages.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => run(a.to)}>
                    <a.icon size={16} />
                    <span>
                      <strong>{a.label}</strong>
                      <span className="hint-inline">{a.hint}</span>
                    </span>
                  </button>
                </li>
              ))}
              {items.market.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => run(h.to)}>
                    <MapPinned size={16} />
                    <span>
                      <strong>
                        {h.kind === 'business' ? 'Business' : h.kind === 'filter' ? 'Filter' : h.kind === 'insight' ? 'Insight' : 'Page'} · {h.label}
                      </strong>
                      <span className="hint-inline">{h.hint}</span>
                    </span>
                  </button>
                </li>
              ))}
              {items.pages.length === 0 && items.market.length === 0 && <li className="hint-inline">No matches</li>}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
