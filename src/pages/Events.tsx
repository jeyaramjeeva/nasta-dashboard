import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Money } from '../components/Money'
import { MotionCard } from '../components/MotionCard'
import { EmptyState, SkeletonPage } from '../components/Skeleton'
import { useData } from '../context/DataContext'

export function Events() {
  const { metrics, loading } = useData()
  const [params] = useSearchParams()
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    const fromUrl = params.get('q')
    if (fromUrl) setQ(fromUrl)
  }, [params])

  const filtered = useMemo(() => {
    if (!metrics) return []
    return metrics.byEvent.filter((e) => {
      if (type !== 'all' && e.name !== type) return false
      if (status !== 'all' && e.status !== status) return false
      if (q) {
        const hay = `${e.id} ${e.name} ${e.location}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [metrics, type, status, q])

  if (loading) return <SkeletonPage />
  if (!metrics) {
    return (
      <EmptyState title="No events yet" body="Upload Excel to see event scorecards." />
    )
  }

  const types = [...new Set(metrics.byEvent.map((e) => e.name))]

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Events</h1>
          <p>Scorecards for every market and festival — filter and compare.</p>
        </div>
        <span className="badge">{filtered.length} shown</span>
      </div>

      <div className="filters">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="Completed">Completed</option>
          <option value="Upcoming">Upcoming</option>
        </select>
        <input
          placeholder="Search location or ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="event-cards" style={{ marginBottom: '1.2rem' }}>
        {filtered.map((e, i) => (
          <motion.div
            className="event-card"
            key={e.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4) }}
            whileHover={{ y: -4 }}
          >
            <div className="event-card__head">
              <div className="title">
                {e.id} · {e.name}
              </div>
              <span
                className={`pill ${
                  e.status.toLowerCase().includes('complet') ? 'completed' : 'upcoming'
                }`}
              >
                {e.status.toLowerCase().includes('complet') ? 'Completed' : 'Upcoming'}
              </span>
            </div>
            <div className="meta">
              {e.location}
              {e.startDate ? ` · ${e.startDate}` : ''}
              {e.days ? ` · ${e.days}d` : ''}
            </div>
            <div className="stats">
              <div>
                Income
                <br />
                <strong className="pos">
                  <Money value={e.income} />
                </strong>
              </div>
              <div>
                Expense
                <br />
                <strong className="neg">
                  <Money value={e.expense} />
                </strong>
              </div>
              <div>
                Profit
                <br />
                <strong>
                  <Money value={e.profit} colored />
                </strong>
              </div>
              <div>
                € / day
                <br />
                <strong>
                  <Money value={e.incomePerDay} />
                </strong>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <MotionCard interactive={false}>
        <h2>Event table</h2>
        <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Location</th>
                <th>Status</th>
                <th>Income</th>
                <th>Expense</th>
                <th>Profit</th>
                <th>€/day</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>{e.id}</td>
                  <td>{e.name}</td>
                  <td>{e.location}</td>
                  <td>
                    <span className={`pill ${e.status.toLowerCase()}`}>{e.status}</span>
                  </td>
                  <td>
                    <Money value={e.income} />
                  </td>
                  <td>
                    <Money value={e.expense} />
                  </td>
                  <td>
                    <Money value={e.profit} colored />
                  </td>
                  <td>
                    <Money value={e.incomePerDay} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MotionCard>
    </>
  )
}
