import { AnimatePresence, motion } from 'framer-motion'
import {
  Banknote,
  LayoutDashboard,
  Lightbulb,
  PlusCircle,
  Search,
  Upload,
  Users,
  CalendarDays,
  CalendarRange,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { springSnappy } from '../lib/motion'

const ACTIONS = [
  { id: 'dash', label: 'Dashboard', hint: 'Overview & KPIs', to: '/', icon: LayoutDashboard },
  { id: 'events', label: 'Events', hint: 'Scorecards & filters', to: '/events', icon: CalendarDays },
  { id: 'calendar', label: 'Calendar', hint: 'Prep, weather, inventory', to: '/calendar', icon: CalendarRange },
  { id: 'partners', label: 'Partners', hint: 'Balances & settlements', to: '/partners', icon: Users },
  { id: 'cash', label: 'Cash box', hint: 'Ledger vs count', to: '/cash', icon: Banknote },
  { id: 'insights', label: 'Insights', hint: 'Locations & estimates', to: '/insights', icon: Lightbulb },
  { id: 'upload', label: 'Upload Excel', hint: 'Publish weekly sheet', to: '/upload', icon: Upload },
  { id: 'quick', label: 'Quick add', hint: 'Log expense on the go', to: '/quick-add', icon: PlusCircle },
]

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
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
    const query = q.trim().toLowerCase()
    if (!query) return ACTIONS
    return ACTIONS.filter(
      (a) =>
        a.label.toLowerCase().includes(query) ||
        a.hint.toLowerCase().includes(query),
    )
  }, [q])

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
            className="cmd-panel"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={springSnappy}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cmd-input-row">
              <Search size={18} strokeWidth={1.75} />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search pages & actions…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && items[0]) run(items[0].to)
                }}
              />
              <kbd>esc</kbd>
            </div>
            <div className="cmd-list">
              {items.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="cmd-item"
                  onClick={() => run(a.to)}
                >
                  <a.icon size={16} strokeWidth={1.75} />
                  <span>
                    <strong>{a.label}</strong>
                    <small>{a.hint}</small>
                  </span>
                </button>
              ))}
              {items.length === 0 && (
                <div className="cmd-empty">No matches</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
