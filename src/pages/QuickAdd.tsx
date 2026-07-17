import { PlusCircle } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MotionCard } from '../components/MotionCard'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { canManageUploads } from '../lib/authAllowlist'
import { germanyTodayYmd } from '../lib/germanyTime'

const CATEGORIES = [
  'Grocery',
  'Stall Fee',
  'Stall Setup',
  'Operations',
  'Transport',
  'Equipment',
  'Subscription',
  'Other',
]

const PEOPLE = ['Jeeva', 'Sriram', 'Sneha', 'Box', 'Paypal']

export function QuickAdd() {
  const { snapshot, quickAddTransaction, cloudEnabled } = useData()
  const { user } = useAuth()
  const canUpload = canManageUploads(user)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [date, setDate] = useState(() => germanyTodayYmd())
  const [eventId, setEventId] = useState('Setup')
  const [type, setType] = useState('Expense')
  const [category, setCategory] = useState('Grocery')
  const [amount, setAmount] = useState('')
  const [person, setPerson] = useState('Jeeva')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('Paid')

  const events = useMemo(() => {
    const ids = snapshot?.events.map((e) => e.id) ?? []
    return ['Setup', ...ids]
  }, [snapshot])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number(String(amount).replace(',', '.'))
    if (!Number.isFinite(value) || value === 0) {
      setMsg({ type: 'err', text: 'Enter a valid amount' })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const signed = type === 'Expense' || type === 'Settlement' ? -Math.abs(value) : Math.abs(value)
      await quickAddTransaction({
        password,
        transaction: {
          date,
          eventId,
          purchaseDate: date,
          type,
          costType: type === 'Expense' ? 'Operating' : '',
          category: type === 'Income' ? 'Income' : type === 'Settlement' ? 'Settlement' : category,
          description: description || `${category} quick add`,
          amount: signed,
          person,
          status,
        },
      })
      setMsg({
        type: 'ok',
        text: cloudEnabled
          ? 'Saved & synced. Dashboard updated.'
          : 'Saved on this device. Upload Excel later to stay Excel-first.',
      })
      setDescription('')
      setAmount('')
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Quick add</h1>
          <p>
            Log a grocery or expense from your phone at the market. Excel stays the weekly master —
            merge the sheet later if you also track there.
          </p>
        </div>
        {canUpload && (
          <Link className="btn ghost" to="/upload">
            Data workflow →
          </Link>
        )}
      </div>

      {!snapshot && (
        <div className="alert-item" style={{ marginBottom: '0.9rem' }}>
          {canUpload
            ? 'No snapshot loaded yet. Publish an Excel file once from Upload before using quick-add.'
            : 'No snapshot loaded yet. Ask Jeeva to publish Excel once before using quick-add.'}
        </div>
      )}

      <MotionCard interactive={false} className="upload-panel">
        <h2>
          <PlusCircle size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
          New transaction
        </h2>
        <form onSubmit={(e) => void submit(e)}>
          <div className="filters" style={{ marginTop: '0.85rem' }}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
              {events.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="Expense">Expense</option>
              <option value="Income">Income</option>
              <option value="Settlement">Settlement</option>
            </select>
          </div>

          <div className="filters">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={type !== 'Expense'}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              inputMode="decimal"
              placeholder="Amount €"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              {PEOPLE.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="desc">Description</label>
            <input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Metro vegetables"
            />
          </div>

          <div className="filters">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="qpw">Password</label>
            <input
              id="qpw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Upload password"
              required
            />
          </div>

          <button className="btn" type="submit" disabled={busy || !snapshot}>
            {busy ? 'Saving…' : 'Save transaction'}
          </button>
        </form>

        {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
      </MotionCard>
    </>
  )
}
