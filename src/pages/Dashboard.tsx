import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowUpRight,
  CircleDollarSign,
  HandCoins,
  ScanSearch,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartChrome, chartTooltipStyle, euroFull, euroTick } from '../components/ChartChrome'
import { HomeWidgets } from '../components/HomeWidgets'
import { KpiCard } from '../components/KpiCard'
import { Money } from '../components/Money'
import { MotionCard, Stagger } from '../components/MotionCard'
import { EmptyState, SkeletonPage } from '../components/Skeleton'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useExtras } from '../context/ExtrasContext'
import { useLocale } from '../context/LocaleContext'
import { canManageUploads } from '../lib/authAllowlist'
import { buildCalendarCards } from '../lib/calendar'
import { exportElementPdf, exportElementPng } from '../lib/exportReport'
import { germanyTodayYmd } from '../lib/germanyTime'
import { computeMetrics } from '../lib/metrics'
import { addSavedView, loadSavedViews, removeSavedView } from '../lib/savedViews'
import type { EventStatusFilter, SavedView } from '../types'

type Focus = 'all' | 'income' | 'expense'
type EventPulseFilter = 'all' | 'completed' | 'upcoming'

export function Dashboard() {
  const { snapshot, loading, error, cloudEnabled, refresh } = useData()
  const { weather } = useExtras()
  const { user } = useAuth()
  const canUpload = canManageUploads(user)
  const { tr } = useLocale()
  const reportRef = useRef<HTMLDivElement>(null)
  const [months, setMonths] = useState<string[]>([])
  const [eventTypes, setEventTypes] = useState<string[]>([])
  const [status, setStatus] = useState<EventStatusFilter>('all')
  const [category, setCategory] = useState<string | null>(null)
  const [focus, setFocus] = useState<Focus>('all')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [eventPulse, setEventPulse] = useState<EventPulseFilter>('all')
  const [views, setViews] = useState<SavedView[]>(() => loadSavedViews())
  const [viewName, setViewName] = useState('')

  const allMonths = useMemo(() => {
    if (!snapshot) return []
    const set = new Set<string>()
    for (const t of snapshot.transactions) {
      const m = t.month || (t.date ? t.date.slice(0, 7) : '')
      if (m) set.add(m)
    }
    return [...set].sort()
  }, [snapshot])

  const allTypes = useMemo(() => {
    if (!snapshot) return []
    return [...new Set(snapshot.events.map((e) => e.name))].sort()
  }, [snapshot])

  const metrics = useMemo(() => {
    if (!snapshot) return null
    return computeMetrics(snapshot, {
      months: months.length ? months : undefined,
      eventTypes: eventTypes.length ? eventTypes : undefined,
      category,
      status,
    })
  }, [snapshot, months, eventTypes, category, status])

  const categoryTx = useMemo(() => {
    if (!snapshot || !category) return []
    const allowed = new Set(
      snapshot.events
        .filter((e) => {
          if (eventTypes.length && !eventTypes.includes(e.name)) return false
          if (status === 'completed' && e.status !== 'Completed') return false
          if (status === 'upcoming' && e.status === 'Completed') return false
          return true
        })
        .map((e) => e.id),
    )
    const statusOrType = status !== 'all' || eventTypes.length > 0
    return snapshot.transactions
      .filter((t) => t.type === 'Expense' && t.category === category)
      .filter((t) => {
        if (statusOrType && !allowed.has(t.eventId)) return false
        if (!months.length) return true
        const m = t.month || (t.date ? t.date.slice(0, 7) : '')
        return m && months.includes(m)
      })
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 12)
  }, [snapshot, category, months, eventTypes, status])

  const eventCards = useMemo(() => {
    if (!snapshot || !metrics) return []
    return buildCalendarCards(snapshot, metrics, weather)
  }, [snapshot, metrics, weather])

  const completedCards = useMemo(
    () => eventCards.filter((c) => c.event.status === 'Completed'),
    [eventCards],
  )
  const upcomingCards = useMemo(
    () => eventCards.filter((c) => c.event.status !== 'Completed'),
    [eventCards],
  )

  const pulseRows = useMemo(() => {
    if (eventPulse === 'completed') return completedCards
    if (eventPulse === 'upcoming') return upcomingCards
    return eventCards
  }, [eventPulse, eventCards, completedCards, upcomingCards])

  const completedTotals = useMemo(() => {
    const spend = completedCards.reduce((s, c) => s + c.spend, 0)
    const gain = completedCards.reduce((s, c) => s + c.gain, 0)
    return {
      spend: Math.round(spend * 100) / 100,
      gain: Math.round(gain * 100) / 100,
      net: Math.round((gain - spend) * 100) / 100,
    }
  }, [completedCards])
  const upcomingTotals = useMemo(() => {
    const spend = upcomingCards.reduce((s, c) => s + c.spend, 0)
    const gain = upcomingCards.reduce((s, c) => s + c.gain, 0)
    return {
      spend: Math.round(spend * 100) / 100,
      gain: Math.round(gain * 100) / 100,
      net: Math.round((gain - spend) * 100) / 100,
    }
  }, [upcomingCards])

  const selectedEvent = metrics?.byEvent.find((e) => e.id === selectedEventId) ?? null
  const selectedCard = eventCards.find((c) => c.event.id === selectedEventId) ?? null

  const incomeSpark = useMemo(
    () => metrics?.monthly.map((m) => m.income) ?? [],
    [metrics],
  )
  const expenseSpark = useMemo(
    () => metrics?.monthly.map((m) => m.expense) ?? [],
    [metrics],
  )
  const netSpark = useMemo(() => metrics?.monthly.map((m) => m.net) ?? [], [metrics])

  const monthTrend = useMemo(() => {
    if (!metrics || metrics.monthly.length < 2) return null
    const a = metrics.monthly[metrics.monthly.length - 2]
    const b = metrics.monthly[metrics.monthly.length - 1]
    if (!a.income || !b.income) return null
    const pct = ((b.income - a.income) / Math.abs(a.income)) * 100
    if (!Number.isFinite(pct) || Math.abs(pct) > 250) return null
    return pct
  }, [metrics])

  function toggleMonth(m: string) {
    setMonths((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  function toggleType(t: string) {
    setEventTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  function clearFilters() {
    setMonths([])
    setEventTypes([])
    setStatus('all')
    setCategory(null)
    setFocus('all')
    setEventPulse('all')
    setSelectedEventId(null)
  }

  function applyView(v: SavedView) {
    setMonths(v.filter.months || [])
    setEventTypes(v.filter.eventTypes || [])
    setCategory(v.filter.category || null)
    const nextStatus = v.filter.status || 'all'
    setStatus(nextStatus)
    setEventPulse(nextStatus === 'all' ? 'all' : nextStatus)
  }

  function setStatusFilter(next: EventStatusFilter) {
    setStatus(next)
    setEventPulse(next === 'all' ? 'all' : next)
    setSelectedEventId(null)
  }

  function saveCurrentView() {
    const name =
      viewName.trim() ||
      [
        months.length ? months.join('+') : 'All months',
        eventTypes.length ? eventTypes.join('+') : 'All types',
        status === 'completed' ? 'Completed' : status === 'upcoming' ? 'Upcoming' : 'All status',
      ].join(' · ')
    addSavedView(name, {
      months: months.length ? months : undefined,
      eventTypes: eventTypes.length ? eventTypes : undefined,
      category,
      status,
    })
    setViews(loadSavedViews())
    setViewName('')
  }

  async function doExport(kind: 'png' | 'pdf') {
    if (!reportRef.current) return
    const name = `nasta-dashboard-${germanyTodayYmd()}`
    if (kind === 'png') await exportElementPng(reportRef.current, name)
    else await exportElementPdf(reportRef.current, name)
  }

  if (loading) return <SkeletonPage />
  if (error) {
    return (
      <EmptyState
        title="Couldn't load data"
        body={error}
        action={
          <button className="btn" type="button" onClick={() => void refresh()}>
            Retry
          </button>
        }
      />
    )
  }
  if (!metrics || !snapshot) {
    return (
      <EmptyState
        title="No snapshot yet"
        body={
          canUpload
            ? 'Upload your Excel tracker to publish live KPIs for every machine.'
            : 'Ask Jeeva to upload the Excel tracker so live KPIs appear for everyone.'
        }
        action={
          canUpload ? (
            <Link className="btn" to="/upload">
              Upload Excel <ArrowUpRight size={16} style={{ marginLeft: 6, verticalAlign: -2 }} />
            </Link>
          ) : undefined
        }
      />
    )
  }

  const filtersActive =
    months.length > 0 || eventTypes.length > 0 || category || status !== 'all'

  return (
    <>
      <motion.div
        className="cmd-bar"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="cmd-bar__top">
          <h1>{tr('commandCenter')}</h1>
          <div className="page-actions">
            <span className={`badge ${cloudEnabled ? 'ok' : 'warn'}`}>
              {cloudEnabled ? 'Live sync' : 'Seed / local'}
            </span>
            <button className="btn ghost" type="button" onClick={() => void doExport('png')}>
              {tr('downloadPng')}
            </button>
            <button className="btn ghost" type="button" onClick={() => void doExport('pdf')}>
              {tr('downloadPdf')}
            </button>
            {filtersActive && (
              <button className="btn ghost" type="button" onClick={clearFilters}>
                {tr('clearFilters')}
              </button>
            )}
          </div>
        </div>

        <div className="cmd-filters">
          <div className="cmd-filter">
            <span className="cmd-filter__label">{tr('month')}</span>
            <div className="cmd-filter__chips">
              <button
                type="button"
                className={`chip chip--sm ${months.length === 0 ? 'active' : ''}`}
                onClick={() => setMonths([])}
              >
                {tr('all')}
              </button>
              {allMonths.map((m) => {
                const [yy, mm] = m.split('-')
                const label = new Date(Number(yy), Number(mm) - 1, 1).toLocaleString('en', {
                  month: 'short',
                })
                return (
                  <button
                    key={m}
                    type="button"
                    className={`chip chip--sm ${months.includes(m) ? 'active' : ''}`}
                    onClick={() => toggleMonth(m)}
                    title={m}
                  >
                    {label}
                    <span className="chip-year">’{yy?.slice(2)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="cmd-filter">
            <span className="cmd-filter__label">{tr('type')}</span>
            <div className="cmd-filter__chips">
              <button
                type="button"
                className={`chip chip--sm ${eventTypes.length === 0 ? 'active' : ''}`}
                onClick={() => setEventTypes([])}
              >
                {tr('all')}
              </button>
              {allTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`chip chip--sm ${eventTypes.includes(t) ? 'active' : ''}`}
                  onClick={() => toggleType(t)}
                >
                  {t.replace(' Festival', '')}
                </button>
              ))}
            </div>
          </div>

          <div className="cmd-filter cmd-filter--status">
            <span className="cmd-filter__label">{tr('status')}</span>
            <div className="cmd-filter__chips">
              <button
                type="button"
                className={`chip chip--sm ${status === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                {tr('all')}
              </button>
              <button
                type="button"
                className={`chip chip--sm ${status === 'completed' ? 'active' : ''}`}
                onClick={() => setStatusFilter('completed')}
              >
                {tr('completed')}
              </button>
            </div>
          </div>

          <div className="cmd-filter cmd-filter--views">
            <span className="cmd-filter__label">{tr('savedViews')}</span>
            <div className="cmd-filter__chips">
              {views.map((v) => (
                <button key={v.id} type="button" className="chip chip--sm" onClick={() => applyView(v)}>
                  {v.name}
                  <span
                    className="chip-x"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeSavedView(v.id)
                      setViews(loadSavedViews())
                    }}
                  >
                    ×
                  </span>
                </button>
              ))}
              <input
                className="cmd-view-input"
                placeholder={tr('saveView')}
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
              />
              <button type="button" className="chip chip--sm active" onClick={saveCurrentView}>
                {tr('saveView')}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <div ref={reportRef}>
      <HomeWidgets cards={eventCards} metrics={metrics} />

      <Stagger className="grid kpi">
        <KpiCard
          label={tr('sales')}
          value={metrics.totalIncome}
          icon={TrendingUp}
          tone="positive"
          spark={incomeSpark}
          trend={monthTrend}
          badge="Income"
          selected={focus === 'income'}
          onClick={() => setFocus((f) => (f === 'income' ? 'all' : 'income'))}
          hint="Click to focus chart"
          delay={0}
        />
        <KpiCard
          label={tr('costs')}
          value={metrics.totalExpense}
          icon={TrendingDown}
          tone="negative"
          spark={expenseSpark}
          selected={focus === 'expense'}
          onClick={() => setFocus((f) => (f === 'expense' ? 'all' : 'expense'))}
          hint={
            status === 'completed'
              ? 'Completed stalls + Setup (excludes upcoming)'
              : 'Click to focus chart'
          }
          delay={0.05}
        />
        <KpiCard
          label={tr('net')}
          value={metrics.net}
          icon={Wallet}
          tone={metrics.net >= 0 ? 'positive' : 'negative'}
          spark={netSpark}
          hint={`${(metrics.profitMargin * 100).toFixed(0)}% of costs covered`}
          format={(n) =>
            new Intl.NumberFormat('de-DE', {
              style: 'currency',
              currency: 'EUR',
              signDisplay: 'exceptZero',
            }).format(n)
          }
          delay={0.1}
        />
        <KpiCard
          label={tr('partnerOwed')}
          value={metrics.partnerOwed}
          icon={HandCoins}
          tone="accent"
          to="/partners"
          hint={
            <>
              Settlements <Money value={metrics.settlementsPaid} />
            </>
          }
          delay={0.15}
        />
      </Stagger>

      <div className="grid two" style={{ marginTop: '0.9rem', marginBottom: '0.9rem' }}>
        <ChartChrome
          title="Monthly income vs expense"
          hint="Click a bar to filter that month"
          delay={0.08}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={metrics.monthly}
              onClick={(state) => {
                const m = (state as { activeLabel?: string })?.activeLabel
                if (m) toggleMonth(m)
              }}
            >
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-income)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--chart-income)" stopOpacity={0.45} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-expense)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--chart-expense)" stopOpacity={0.45} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--grid)" strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={euroTick} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'var(--accent-soft)' }}
                contentStyle={chartTooltipStyle}
                formatter={(v) => euroFull(Number(v ?? 0))}
              />
              <Legend />
              {(focus === 'all' || focus === 'income') && (
                <Bar dataKey="income" name="Income" fill="url(#incGrad)" radius={[8, 8, 0, 0]} cursor="pointer">
                  {metrics.monthly.map((row) => (
                    <Cell
                      key={`i-${row.month}`}
                      fillOpacity={months.length === 0 || months.includes(row.month) ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              )}
              {(focus === 'all' || focus === 'expense') && (
                <Bar dataKey="expense" name="Expense" fill="url(#expGrad)" radius={[8, 8, 0, 0]} cursor="pointer">
                  {metrics.monthly.map((row) => (
                    <Cell
                      key={`e-${row.month}`}
                      fillOpacity={months.length === 0 || months.includes(row.month) ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </ChartChrome>

        <ChartChrome title="Spend by category" hint="Click a category to drill in" delay={0.12}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.byCategory.slice(0, 8)} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke="var(--grid)" strokeDasharray="3 6" horizontal={false} />
              <XAxis type="number" tickFormatter={euroTick} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="category" width={88} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => euroFull(Number(v ?? 0))} />
              <Bar
                dataKey="amount"
                name="Amount"
                radius={[0, 8, 8, 0]}
                cursor="pointer"
                onClick={(data) => {
                  const cat = (data as { category?: string })?.category
                  if (!cat) return
                  setCategory((c) => (c === cat ? null : cat))
                }}
              >
                {metrics.byCategory.slice(0, 8).map((row) => (
                  <Cell
                    key={row.category}
                    fill={
                      category === row.category
                        ? 'var(--accent)'
                        : category
                          ? 'color-mix(in srgb, var(--chart-expense) 35%, transparent)'
                          : 'var(--chart-expense)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartChrome>
      </div>

      {category && (
        <MotionCard className="mb" delay={0.05} interactive={false}>
          <div className="card-head">
            <h2>
              Expenses in {category}{' '}
              <button type="button" className="chip" onClick={() => setCategory(null)}>
                Clear
              </button>
            </h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event</th>
                  <th>Description</th>
                  <th>Person</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {categoryTx.map((t, i) => (
                  <tr key={`${t.date}-${t.description}-${i}`}>
                    <td>{t.date ?? '—'}</td>
                    <td>{t.eventId}</td>
                    <td>{t.description}</td>
                    <td>{t.person || '—'}</td>
                    <td>
                      <Money value={Math.abs(t.amount)} />
                    </td>
                  </tr>
                ))}
                {categoryTx.length === 0 && (
                  <tr>
                    <td colSpan={5}>No matching expenses for this filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </MotionCard>
      )}

      <div style={{ marginTop: category ? '0.9rem' : 0 }}>
      <MotionCard interactive={false} delay={0.1}>
        <div className="card-head">
          <h2>Events — spend &amp; gain</h2>
          <div className="page-actions">
            <div className="split-mode-row" style={{ margin: 0 }}>
              {(
                [
                  ['all', 'All'],
                  ['completed', 'Completed'],
                  ['upcoming', 'Upcoming'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn ghost ${eventPulse === id ? 'is-on' : ''}`}
                  onClick={() => setEventPulse(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <Link to="/calendar" className="hint-inline">
              Calendar →
            </Link>
          </div>
        </div>

        <div className="grid two" style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
          <div className="glass-card" style={{ boxShadow: 'none', padding: '0.85rem 1rem' }}>
            <div className="kpi-label">Completed ({completedCards.length})</div>
            <div className="hint-inline" style={{ marginTop: '0.35rem' }}>
              Spend <Money value={completedTotals.spend} /> · Gain{' '}
              <Money value={completedTotals.gain} /> · Net{' '}
              <Money value={completedTotals.net} colored signed />
            </div>
          </div>
          <div className="glass-card" style={{ boxShadow: 'none', padding: '0.85rem 1rem' }}>
            <div className="kpi-label">Upcoming ({upcomingCards.length})</div>
            <div className="hint-inline" style={{ marginTop: '0.35rem' }}>
              Expected spend <Money value={upcomingTotals.spend} /> · Expected gain{' '}
              <Money value={upcomingTotals.gain} /> · Net{' '}
              <Money value={upcomingTotals.net} colored signed />
            </div>
          </div>
        </div>

        <div className="table-wrap table-wrap--fit">
          <table className="table-fit">
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Spend</th>
                <th>Gain</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {pulseRows
                .slice()
                .sort((a, b) => (b.event.startDate || '').localeCompare(a.event.startDate || ''))
                .slice(0, 12)
                .map((c) => (
                  <tr
                    key={c.event.id}
                    className={`click-row ${selectedEventId === c.event.id ? 'active' : ''}`}
                    onClick={() =>
                      setSelectedEventId((id) => (id === c.event.id ? null : c.event.id))
                    }
                  >
                    <td className="cell-wrap">
                      <strong>{c.event.id}</strong>
                      <div className="hint-inline">
                        {c.event.name} · {c.event.location}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${c.event.status === 'Completed' ? 'ok' : 'warn'}`}
                      >
                        {c.event.status === 'Completed' ? 'Completed' : 'Upcoming'}
                      </span>
                      {c.event.status !== 'Completed' && (
                        <div className="hint-inline">forecast + logged</div>
                      )}
                    </td>
                    <td>
                      <Money value={c.spend} />
                    </td>
                    <td>
                      <Money value={c.gain} />
                    </td>
                    <td>
                      {c.net != null ? <Money value={c.net} colored signed /> : '—'}
                    </td>
                  </tr>
                ))}
              {pulseRows.length === 0 && (
                <tr>
                  <td colSpan={5}>No events for this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {selectedEvent && selectedCard && (
          <div className="event-detail">
            <strong>
              {selectedEvent.id} · {selectedEvent.name}
            </strong>
            <div className="meta">{selectedEvent.location}</div>
            <div className="stats">
              <span>
                Spend <Money value={selectedCard.spend} />
              </span>
              <span>
                Gain <Money value={selectedCard.gain} />
              </span>
              <span>
                Net{' '}
                {selectedCard.net != null ? (
                  <Money value={selectedCard.net} colored signed />
                ) : (
                  '—'
                )}
              </span>
            </div>
            <Link to="/calendar">Open in Calendar →</Link>
          </div>
        )}
      </MotionCard>
      </div>

      <div className="grid two" style={{ marginTop: '0.9rem' }}>
        <MotionCard interactive={false} delay={0.12}>
          <div className="card-head">
            <h2>Event counts</h2>
            <Link to="/events" className="hint-inline">
              All events →
            </Link>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <div className="kpi-label">Completed</div>
              <div className="kpi-value">{metrics.eventsCompleted}</div>
              <div className="hint-inline">
                Net <Money value={completedTotals.net} colored signed />
              </div>
            </div>
            <div>
              <div className="kpi-label">Upcoming</div>
              <div className="kpi-value">{metrics.eventsUpcoming}</div>
              <div className="hint-inline">
                Expected net <Money value={upcomingTotals.net} colored signed />
              </div>
            </div>
          </div>
        </MotionCard>

        <MotionCard interactive={false} delay={0.14}>
          <div className="card-head">
            <h2>Cash & alerts</h2>
            <Link to="/cash" className="hint-inline">
              Cash box →
            </Link>
          </div>
          <div className="mini-cash">
            <div>
              <div className="kpi-label">Ledger</div>
              <strong>
                <Money value={metrics.cashExpected} />
              </strong>
            </div>
            <div>
              <div className="kpi-label">Cash counted</div>
              <strong>
                <Money value={metrics.cashCounted} />
              </strong>
            </div>
            <div>
              <div className="kpi-label">+ PayPal</div>
              <strong>
                <Money value={metrics.paypalBalance} />
              </strong>
            </div>
            <div>
              <div className="kpi-label">Mit PayPal</div>
              <strong>
                <Money value={metrics.cashWithPaypal} />
              </strong>
            </div>
          </div>
          <div style={{ margin: '0.85rem 0 1rem' }}>
            <span className={`badge ${Math.abs(metrics.cashMismatch) > 5 ? 'warn' : 'ok'}`}>
              <CircleDollarSign size={12} /> Diff <Money value={metrics.cashMismatch} signed />
            </span>
          </div>
          {metrics.alerts.length === 0 ? (
            <p style={{ color: 'var(--muted)', margin: 0 }}>All clear — no alerts right now.</p>
          ) : (
            <div className="alert-list">
              {metrics.alerts.map((a) => (
                <div
                  className="alert-item"
                  key={a.kind + a.message}
                  style={
                    a.severity === 'critical'
                      ? { background: 'var(--danger-soft)' }
                      : a.severity === 'info'
                        ? { background: 'var(--ok-soft)' }
                        : undefined
                  }
                >
                  <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                  {a.message}
                </div>
              ))}
            </div>
          )}
        </MotionCard>
      </div>

      {metrics.duplicateExpenses.length > 0 && (
        <div style={{ marginTop: '0.9rem' }}>
          <MotionCard interactive={false} delay={0.16}>
            <div className="card-head">
              <h2>
                <ScanSearch size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                Duplicate expense hunter
              </h2>
              <span className="badge warn">
                {metrics.duplicateExpenses.length} group
                {metrics.duplicateExpenses.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="hint-inline" style={{ marginBottom: '0.75rem' }}>
              Same day + person + amount — check Excel for accidental double entries.
            </p>
            <div className="table-wrap table-wrap--fit">
              <table className="table-fit">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Person</th>
                    <th>Amount</th>
                    <th>×</th>
                    <th>Descriptions</th>
                    <th>Events</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.duplicateExpenses.map((g) => (
                    <tr key={`${g.date}-${g.person}-${g.amount}`}>
                      <td>{g.date}</td>
                      <td>{g.person}</td>
                      <td>
                        <Money value={g.amount} />
                      </td>
                      <td>
                        <span className="badge warn">{g.count}×</span>
                      </td>
                      <td className="cell-wrap hint-inline">{g.descriptions.join(' · ')}</td>
                      <td className="cell-wrap hint-inline">{g.eventIds.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MotionCard>
        </div>
      )}
      </div>
    </>
  )
}
