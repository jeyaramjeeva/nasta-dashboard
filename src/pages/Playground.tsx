import {
  ClipboardList,
  FlaskConical,
  GraduationCap,
  RotateCcw,
  ShoppingBag,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { MotionCard } from '../components/MotionCard'
import { useDemoMode } from '../context/DemoModeContext'

export function Playground() {
  const { isDemo, enterDemo, exitDemo, resetDemo, enterTillTraining, isTillTraining } = useDemoMode()

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <GraduationCap size={22} style={{ verticalAlign: -3, marginRight: 8 }} />
            Till training
          </h1>
          <p>
            Practice the till on <strong>last Saturday’s real menu</strong> with fake tickets.
            Live sales, Excel, and cloud data stay untouched.
          </p>
        </div>
        <div className="page-actions">
          {isTillTraining || isDemo ? (
            <>
              <button type="button" className="btn ghost" onClick={resetDemo}>
                <RotateCcw size={14} /> Restart
              </button>
              <button type="button" className="btn" onClick={exitDemo}>
                Exit
              </button>
            </>
          ) : (
            <button type="button" className="btn" onClick={enterTillTraining}>
              <GraduationCap size={14} /> Start 5-minute training
            </button>
          )}
        </div>
      </div>

      <MotionCard interactive={false}>
        <div className="card-head">
          <h2>What the cousin should do</h2>
        </div>
        <ol style={{ margin: '0.5rem 0 0.85rem', paddingLeft: '1.2rem' }}>
          <li>Open <strong>New order</strong> — dishes and prices match last Saturday’s stall.</li>
          <li>Two fake customers are already in <strong>Pending</strong> — tap Delivered, take Cash or PayPal.</li>
          <li>Add one more ticket yourself, then check <strong>Sold</strong>.</li>
        </ol>
        {isTillTraining ? (
          <Link className="btn" to="/orders">
            Back to Orders →
          </Link>
        ) : (
          <button type="button" className="btn" onClick={enterTillTraining}>
            <ClipboardList size={14} /> Train on the till
          </button>
        )}
        <p className="hint-inline" style={{ marginTop: '0.75rem' }}>
          Timer is 5 minutes. After that you can keep practicing or exit. Nothing here is a real
          sale.
        </p>
      </MotionCard>

      <div className="page-head" style={{ marginTop: '1.5rem' }}>
        <div>
          <h2>
            <FlaskConical size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
            Feature playground
          </h2>
          <p className="hint-inline">
            Older sandbox with sample stalls (not last Saturday’s menu).
          </p>
        </div>
        <div className="page-actions">
          {!isDemo && !isTillTraining && (
            <button type="button" className="btn ghost" onClick={enterDemo}>
              <ShoppingBag size={14} /> Enter demo mode
            </button>
          )}
        </div>
      </div>
    </>
  )
}
