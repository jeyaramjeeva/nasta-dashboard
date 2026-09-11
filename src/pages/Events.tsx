import { motion } from 'framer-motion'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EditableText } from '../components/EditableText'
import { PillTabs } from '../components/PillTabs'
import { MarktApplyScore } from '../components/MarktApplyScore'
import { Money } from '../components/Money'
import { MotionCard } from '../components/MotionCard'
import { EmptyState, SkeletonPage } from '../components/Skeleton'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useLocale } from '../context/LocaleContext'
import { useStallOps } from '../context/StallOpsContext'
import { canManageStallEvents } from '../lib/authAllowlist'
import { mergeEventRows } from '../lib/eventBook'
import {
  displayStallStatus,
  EVENT_STATUSES,
  impactsMetrics,
  statusLabel,
  statusPillClass,
} from '../lib/eventStatus'
import type { EventParticipant } from '../lib/stallOps'
import type { EventRow } from '../types'

const TEAM: EventParticipant[] = ['Sriram', 'Sneha', 'Jeeva']

const EMPTY_FORM = {
  id: '',
  name: 'Streetfood',
  location: '',
  startDate: '',
  endDate: '',
  fee: 0,
  status: 'Applied' as string,
}

export function Events() {
  const { user } = useAuth()
  const { metrics, loading, snapshot } = useData()
  const { tr } = useLocale()
  const {
    eventParticipants,
    setEventParticipants,
    upsertAppEvent,
    patchEvent,
    removeAppEvent,
    eventBook,
  } = useStallOps()
  const canEditEvents = canManageStallEvents(user)
  const [params] = useSearchParams()
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    const fromUrl = params.get('q')
    if (fromUrl) setQ(fromUrl)
  }, [params])

  const filtered = useMemo(() => {
    if (!metrics) return []
    return metrics.byEvent.filter((e) => {
      if (type !== 'all' && e.name !== type) return false
      if (status !== 'all') {
        const s = statusLabel(e.status)
        if (status === 'Confirmed' && s !== 'Confirmed' && s !== 'Completed') return false
        if (status === 'Applied' && s !== 'Applied' && s !== 'Upcoming') return false
        if (status === 'Rejected' && s !== 'Rejected') return false
        if (
          status !== 'Confirmed' &&
          status !== 'Applied' &&
          status !== 'Rejected' &&
          e.status !== status
        ) {
          return false
        }
      }
      if (q) {
        const hay = `${e.id} ${e.name} ${e.location}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [metrics, type, status, q])

  const appExtraIds = useMemo(
    () => new Set((eventBook.extras || []).map((e) => e.id)),
    [eventBook.extras],
  )

  const mergedById = useMemo(() => {
    const map = new Map<string, EventRow>()
    for (const e of mergeEventRows(snapshot?.events || [], eventBook)) {
      map.set(e.id, e)
    }
    return map
  }, [snapshot?.events, eventBook])

  if (loading) return <SkeletonPage />
  if (!metrics) {
    return <EmptyState title={tr('noEventsYet')} body={tr('noEventsBody')} />
  }

  const types = [...new Set(metrics.byEvent.map((e) => e.name))]

  function toggleParticipant(eventId: string, person: EventParticipant) {
    const id = String(eventId || '').trim()
    if (!id) return
    const cur = eventParticipants[id] || []
    const next = cur.includes(person) ? cur.filter((p) => p !== person) : [...cur, person]
    setEventParticipants(id, next)
  }

  function startEdit(e: { id: string; name: string; location: string; startDate: string | null; endDate: string | null; fee: number; status: string }) {
    setEditingId(e.id)
    setForm({
      id: e.id,
      name: e.name,
      location: e.location,
      startDate: e.startDate || '',
      endDate: e.endDate || e.startDate || '',
      fee: e.fee || 0,
      status: statusLabel(e.status) === 'Completed' ? 'Confirmed' : statusLabel(e.status) === 'Upcoming' ? 'Applied' : statusLabel(e.status),
    })
  }

  function saveForm() {
    if (!canEditEvents) return
    if (!form.location.trim() && !form.name.trim()) return
    const payload: Partial<EventRow> & { id?: string } = {
      id: editingId || form.id || undefined,
      name: form.name.trim() || 'Stall',
      location: form.location.trim(),
      startDate: form.startDate || null,
      endDate: form.endDate || form.startDate || null,
      fee: Number(form.fee) || 0,
      status: form.status,
    }
    if (editingId && !appExtraIds.has(editingId)) {
      patchEvent(editingId, payload)
    } else {
      upsertAppEvent(payload)
    }
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <EditableText id="events.pageTitle" as="h1" defaultText={tr('events')} />
          <EditableText
            id="events.pageSub"
            as="p"
            defaultText={
              canEditEvents
                ? 'Add or edit stalls. Status: Applied → Confirmed → Rejected. Only Confirmed hits sales KPIs.'
                : 'Stall list (view). Only Sriram can add/edit events and change status.'
            }
          />
        </div>
        <span className="badge">
          {filtered.length} {tr('shown')}
        </span>
      </div>

      {canEditEvents ? (
      <div style={{ marginBottom: '0.9rem' }}>
      <div style={{ marginBottom: '0.9rem' }}>
        <MarktApplyScore history={metrics.byEvent} />
      </div>
      <MotionCard interactive={false}>
        <div className="card-head">
          <h2>{editingId ? `Edit ${editingId}` : 'Add event'}</h2>
          {editingId ? (
            <button type="button" className="btn ghost" onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}>
              Cancel
            </button>
          ) : null}
        </div>
        <div className="filters" style={{ marginTop: '0.65rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field">
            <label>Type / name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Streetfood / Flohmarkt / …"
            />
          </div>
          <div className="field">
            <label>Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Wilhelmplatz, Köln"
            />
          </div>
          <div className="field">
            <label>Start date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  startDate: e.target.value,
                  endDate: f.endDate || e.target.value,
                }))
              }
            />
          </div>
          <div className="field">
            <label>End date</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Fee €</label>
            <input
              type="number"
              min={0}
              step={1}
              value={form.fee}
              onChange={(e) => setForm((f) => ({ ...f, fee: Number(e.target.value) || 0 }))}
              style={{ width: 90 }}
            />
          </div>
          <div className="field">
            <label>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {EVENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn" onClick={saveForm} disabled={!form.location.trim() && !form.name.trim()}>
            {editingId ? (
              <>
                <Pencil size={14} /> Save
              </>
            ) : (
              <>
                <Plus size={14} /> Add event
              </>
            )}
          </button>
        </div>
        <p className="hint-inline" style={{ marginTop: 8 }}>
          Applied / Rejected stay on the list but do not affect Dashboard totals. Confirmed (and old Completed) do.
          Exact map pins: Developer Studio → Tools.
          {snapshot ? '' : ' Upload Excel once so money sheets can attach to event ids.'}
        </p>
      </MotionCard>
      </div>
      ) : null}

      <div className="filters">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">{tr('allTypes')}</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <PillTabs
          group="events-status"
          style={{ margin: 0 }}
          value={status}
          onChange={setStatus}
          items={[
            { id: 'all', label: tr('allStatuses') },
            { id: 'Applied', label: 'Applied' },
            { id: 'Confirmed', label: 'Confirmed' },
            { id: 'Rejected', label: 'Rejected' },
            { id: 'Completed', label: `${tr('completed')} (legacy)` },
            { id: 'Upcoming', label: `${tr('upcoming')} (legacy)` },
          ]}
        />
        <input
          placeholder={tr('searchLocationOrId')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="event-cards" style={{ marginBottom: '1.2rem' }}>
        {filtered.map((e, i) => {
          const people = eventParticipants[e.id] || []
          const inBooks = impactsMetrics(e.status)
          return (
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
                <span className={`pill ${statusPillClass(displayStallStatus(e))}`}>
                  {displayStallStatus(e)}
                </span>
              </div>
              <div className="meta">
                {e.location}
                {mergedById.get(e.id)?.mapsQuery
                  ? ` · 📍 ${mergedById.get(e.id)?.mapsQuery}`
                  : ''}
                {e.startDate ? ` · ${e.startDate}` : ''}
                {e.endDate && e.endDate !== e.startDate ? ` → ${e.endDate}` : ''}
                {e.days ? ` · ${e.days}d` : ''}
                {!inBooks ? ' · not in KPIs' : ''}
              </div>
              <div className="stats">
                <div>
                  {tr('income')}
                  <br />
                  <strong className="pos">
                    <Money value={e.income} />
                  </strong>
                </div>
                <div>
                  {tr('expense')}
                  <br />
                  <strong className="neg">
                    <Money value={e.expense} />
                  </strong>
                </div>
                <div>
                  {tr('profit')}
                  <br />
                  <strong>
                    <Money value={e.profit} colored />
                  </strong>
                </div>
                <div>
                  {tr('perDay')}
                  <br />
                  <strong>
                    <Money value={e.incomePerDay} />
                  </strong>
                </div>
              </div>
              {canEditEvents ? (
              <div className="chip-row" style={{ marginTop: '0.55rem', flexWrap: 'wrap' }}>
                <select
                  value={
                    statusLabel(e.status) === 'Completed'
                      ? 'Confirmed'
                      : statusLabel(e.status) === 'Upcoming'
                        ? 'Applied'
                        : statusLabel(e.status)
                  }
                  onChange={(ev) => patchEvent(e.id, { status: ev.target.value })}
                  aria-label={`Status ${e.id}`}
                >
                  {EVENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn ghost" onClick={() => startEdit(e)}>
                  <Pencil size={14} /> Dates
                </button>
                {appExtraIds.has(e.id) ? (
                  <button
                    type="button"
                    className="btn ghost"
                    title="Remove app-created event"
                    onClick={() => {
                      if (window.confirm(`Remove event ${e.id}?`)) removeAppEvent(e.id)
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
              ) : null}
              <div
                className="event-participants"
                style={{ marginTop: '0.65rem' }}
                onClick={(ev) => ev.stopPropagation()}
                onPointerDown={(ev) => ev.stopPropagation()}
              >
                <div className="kpi-label" style={{ marginBottom: 6 }}>
                  Who participated
                  <span className="hint-inline" style={{ marginLeft: 6, fontWeight: 400 }}>
                    tap to toggle
                  </span>
                </div>
                <div className="chip-row event-participants__chips">
                  {TEAM.map((person) => {
                    const on = people.includes(person)
                    return (
                      <button
                        key={person}
                        type="button"
                        className={`participant-chip${on ? ' is-on' : ''}`}
                        aria-pressed={on}
                        onClick={(ev) => {
                          ev.preventDefault()
                          ev.stopPropagation()
                          toggleParticipant(e.id, person)
                        }}
                      >
                        {person}
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <MotionCard interactive={false}>
        <h2>{tr('eventTable')}</h2>
        <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
          <table>
            <thead>
              <tr>
                <th>{tr('colId')}</th>
                <th>{tr('colName')}</th>
                <th>{tr('colLocation')}</th>
                <th>Dates</th>
                <th>{tr('status')}</th>
                <th>{tr('income')}</th>
                <th>{tr('expense')}</th>
                <th>{tr('profit')}</th>
                <th>Team</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const people = eventParticipants[e.id] || []
                return (
                  <tr key={e.id}>
                    <td>{e.id}</td>
                    <td>{e.name}</td>
                    <td>{e.location}</td>
                    <td className="hint-inline">
                      {e.startDate || '—'}
                      {e.endDate && e.endDate !== e.startDate ? ` → ${e.endDate}` : ''}
                    </td>
                    <td>
                      <span className={`pill ${statusPillClass(displayStallStatus(e))}`}>
                        {displayStallStatus(e)}
                      </span>
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
                      <div className="chip-row event-participants__chips">
                        {TEAM.map((person) => {
                          const on = people.includes(person)
                          return (
                            <button
                              key={person}
                              type="button"
                              className={`participant-chip participant-chip--sm${on ? ' is-on' : ''}`}
                              aria-pressed={on}
                              title={on ? `Remove ${person}` : `Add ${person}`}
                              onClick={() => toggleParticipant(e.id, person)}
                            >
                              {person}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </MotionCard>
    </>
  )
}
