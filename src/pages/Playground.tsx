import {
  Banknote,
  CalendarRange,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  Package,
  RotateCcw,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { MotionCard } from '../components/MotionCard'
import { useDemoMode } from '../context/DemoModeContext'

const TOURS = [
  {
    to: '/orders',
    icon: ClipboardList,
    title: 'Orders & payment',
    body: 'Pick event → Combo Pack with chai or lassi → singles → Delivered → cash/change. Set event prices under Menu prices.',
  },
  {
    to: '/stock',
    icon: Package,
    title: 'Stall stock',
    body: 'Buy packets, Use for the stall, watch Remaining and low-stock alerts.',
  },
  {
    to: '/cash',
    icon: Banknote,
    title: 'Live cash box',
    body: 'After a few deliveries, see Excel count + POS cash in on Cash box.',
  },
  {
    to: '/calendar',
    icon: CalendarRange,
    title: 'Calendar & weather',
    body: 'Open Calendar for live weather icons and go/caution/skip tip.',
  },
  {
    to: '/plates',
    icon: UtensilsCrossed,
    title: 'Plate counter',
    body: 'Tap +/− during a stall. Demo counters stay in the sandbox.',
  },
  {
    to: '/',
    icon: LayoutDashboard,
    title: 'Dashboard widgets',
    body: 'Countdown, mission, plate hunt — all on demo seed numbers.',
  },
]

export function Playground() {
  const { isDemo, enterDemo, exitDemo, resetDemo } = useDemoMode()

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <FlaskConical size={22} style={{ verticalAlign: -3, marginRight: 8 }} />
            Feature playground
          </h1>
          <p>
            Safe sandbox to show how Orders, Stock, Cash, and more work.{' '}
            <strong>Live Excel, partners, and cloud data are never changed.</strong>
          </p>
        </div>
        <div className="page-actions">
          {isDemo ? (
            <>
              <button type="button" className="btn ghost" onClick={resetDemo}>
                <RotateCcw size={14} /> Reset demo
              </button>
              <button type="button" className="btn" onClick={exitDemo}>
                Exit demo
              </button>
            </>
          ) : (
            <button type="button" className="btn" onClick={enterDemo}>
              <ShoppingBag size={14} /> Enter demo mode
            </button>
          )}
        </div>
      </div>

      {!isDemo && (
        <div className="alert-item" style={{ marginBottom: '0.9rem' }}>
          You are still on <strong>live data</strong>. Click <strong>Enter demo mode</strong> to
          load a disposable sandbox (sample stalls + empty POS). Nothing you do there syncs to
          Supabase or overwrites your real tracker.
        </div>
      )}

      {isDemo && (
        <div className="alert-item demo-banner" style={{ marginBottom: '0.9rem' }}>
          <strong>Demo mode is ON.</strong> Try the tour below. Reset anytime. Exit to return to
          live numbers.
        </div>
      )}

      <div className="grid two">
        {TOURS.map((t) => (
          <MotionCard key={t.to} interactive={false}>
            <div className="card-head">
              <h2>
                <t.icon size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                {t.title}
              </h2>
            </div>
            <p className="hint-inline" style={{ margin: '0.5rem 0 0.85rem' }}>
              {t.body}
            </p>
            {isDemo ? (
              <Link className="btn" to={t.to}>
                Try it →
              </Link>
            ) : (
              <button type="button" className="btn ghost" onClick={enterDemo}>
                Enter demo first
              </button>
            )}
          </MotionCard>
        ))}
      </div>
    </>
  )
}
