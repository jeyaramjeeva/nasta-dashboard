import { Flag, Plus, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CountUp } from '../components/CountUp'
import { EditableText } from '../components/EditableText'
import { LabeledBar } from '../components/LabeledBar'
import { Money } from '../components/Money'
import { MotionCard } from '../components/MotionCard'
import { useStallOps } from '../context/StallOpsContext'
import { germanyTodayYmd } from '../lib/germanyTime'
import { newId, type TeamGoal } from '../lib/stallOps'

function dueTone(dueDate?: string, done?: boolean): 'ok' | 'warn' | 'danger' | null {
  if (!dueDate || done) return null
  const today = germanyTodayYmd()
  if (dueDate < today) return 'danger'
  if (dueDate === today) return 'warn'
  return 'ok'
}

export function Goals() {
  const {
    teamGoals,
    upsertTeamGoal,
    deleteTeamGoal,
    setGoalMilestone,
    addGoalMilestone,
    syncing,
  } = useStallOps()
  const [title, setTitle] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [currentNote, setCurrentNote] = useState('')
  const [msDraft, setMsDraft] = useState<Record<string, string>>({})
  const [msDueDraft, setMsDueDraft] = useState<Record<string, string>>({})

  function createGoal() {
    const t = title.trim()
    if (!t) return
    const goal: TeamGoal = {
      id: newId('goal'),
      title: t,
      currentNote: currentNote.trim(),
      targetAmount: targetAmount ? Number(targetAmount) || undefined : undefined,
      currentAmount: currentAmount ? Number(currentAmount) || undefined : undefined,
      milestones: [],
    }
    upsertTeamGoal(goal)
    setTitle('')
    setTargetAmount('')
    setCurrentAmount('')
    setCurrentNote('')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <EditableText
            id="goals.pageTitle"
            as="h1"
            defaultText="Goals"
            icon={<Target size={22} style={{ verticalAlign: -3, marginRight: 8 }} />}
          />
          <EditableText
            id="goals.pageSub"
            as="p"
            defaultText="Main target, where you are now, and milestones with due dates."
          />
          {syncing ? <p className="hint-inline">Syncing…</p> : null}
        </div>
      </div>

      <MotionCard interactive={false}>
        <EditableText id="goals.newTitle" as="h2" defaultText="New main goal" />
        <p className="hint-inline" style={{ marginTop: 6 }}>
          After you add a goal, each milestone gets a Due date field (Overdue / Today badges).
        </p>
        <div className="filters" style={{ marginTop: '0.65rem', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 2, minWidth: 180 }}>
            <label>Goal</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Hit €5,000 net this season"
            />
          </div>
          <div className="field">
            <label>Target €</label>
            <input
              type="number"
              min={0}
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Now €</label>
            <input
              type="number"
              min={0}
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label>Where we are</label>
            <input
              value={currentNote}
              onChange={(e) => setCurrentNote(e.target.value)}
              placeholder="Short status note"
            />
          </div>
          <button type="button" className="btn" disabled={!title.trim()} onClick={createGoal}>
            <Plus size={16} /> Add goal
          </button>
        </div>
      </MotionCard>

      <div className="order-list" style={{ marginTop: '0.9rem' }}>
        {teamGoals.length === 0 && (
          <MotionCard interactive={false}>
            <p className="hint-inline">
              No goals yet — add a main goal above, then add milestones with a Due date under that
              goal.
            </p>
          </MotionCard>
        )}
        {teamGoals.map((g) => {
          const pct =
            g.targetAmount && g.targetAmount > 0
              ? Math.min(100, Math.round(((g.currentAmount || 0) / g.targetAmount) * 100))
              : g.milestones.length
                ? Math.round(
                    (g.milestones.filter((m) => m.done).length / g.milestones.length) * 100,
                  )
                : 0
          return (
            <MotionCard key={g.id} interactive={false} className="order-card">
              <div className="card-head">
                <h2>
                  <Flag size={16} style={{ verticalAlign: -2, marginRight: 6 }} />
                  {g.title}
                </h2>
                <span className="badge">{pct}%</span>
              </div>
              <div className="stats" style={{ marginTop: '0.5rem' }}>
                <div>
                  Target
                  <br />
                  <strong>
                    {g.targetAmount != null ? (
                      <CountUp value={g.targetAmount} />
                    ) : (
                      '—'
                    )}
                  </strong>
                </div>
                <div>
                  Now
                  <br />
                  <strong>
                    {g.currentAmount != null ? (
                      <CountUp value={g.currentAmount} />
                    ) : (
                      '—'
                    )}
                  </strong>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  Status
                  <br />
                  <strong>{g.currentNote || '—'}</strong>
                </div>
              </div>
              <div style={{ marginTop: '0.65rem' }}>
                <LabeledBar
                  percent={pct}
                  labels={
                    pct >= 100
                      ? ['done', 'target hit']
                      : pct >= 70
                        ? ['almost there', 'finishing up', 'hang tight']
                        : ['working now', 'one moment', 'keep going']
                  }
                />
              </div>

              <h3 style={{ margin: '0.85rem 0 0.4rem', fontSize: '0.95rem' }}>Milestones</h3>
              <ul className="order-lines">
                {g.milestones.map((m) => {
                  const tone = dueTone(m.dueDate, m.done)
                  return (
                    <li
                      key={m.id}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 140 }}>
                        <input
                          type="checkbox"
                          checked={m.done}
                          onChange={(e) =>
                            setGoalMilestone(g.id, m.id, { done: e.target.checked })
                          }
                        />
                        <span style={{ textDecoration: m.done ? 'line-through' : undefined }}>
                          {m.label}
                          {m.targetAmount != null ? (
                            <>
                              {' '}
                              (<Money value={m.targetAmount} />)
                            </>
                          ) : null}
                        </span>
                      </label>
                      <input
                        type="date"
                        value={m.dueDate || ''}
                        title="Due date"
                        aria-label={`Due date for ${m.label}`}
                        onChange={(e) =>
                          setGoalMilestone(g.id, m.id, {
                            dueDate: e.target.value || undefined,
                          })
                        }
                        style={{ width: 'auto' }}
                      />
                      {m.dueDate ? (
                        <span
                          className={`badge ${tone === 'danger' ? 'warn' : tone === 'warn' ? 'warn' : 'ok'}`}
                          title={
                            tone === 'danger'
                              ? 'Overdue'
                              : tone === 'warn'
                                ? 'Due today'
                                : 'Upcoming'
                          }
                        >
                          {tone === 'danger' ? 'Overdue' : tone === 'warn' ? 'Today' : m.dueDate}
                        </span>
                      ) : (
                        <span className="hint-inline">No due date</span>
                      )}
                    </li>
                  )
                })}
                {g.milestones.length === 0 && (
                  <li className="hint-inline">Add small goals between here and the main target.</li>
                )}
              </ul>
              <div className="filters" style={{ marginTop: '0.55rem', alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Add milestone</label>
                  <input
                    value={msDraft[g.id] || ''}
                    onChange={(e) => setMsDraft((d) => ({ ...d, [g.id]: e.target.value }))}
                    placeholder="e.g. First €1,000 net"
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      addGoalMilestone(
                        g.id,
                        msDraft[g.id] || '',
                        undefined,
                        msDueDraft[g.id] || undefined,
                      )
                      setMsDraft((d) => ({ ...d, [g.id]: '' }))
                      setMsDueDraft((d) => ({ ...d, [g.id]: '' }))
                    }}
                  />
                </div>
                <div className="field">
                  <label>Due</label>
                  <input
                    type="date"
                    value={msDueDraft[g.id] || ''}
                    onChange={(e) => setMsDueDraft((d) => ({ ...d, [g.id]: e.target.value }))}
                  />
                </div>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={!(msDraft[g.id] || '').trim()}
                  onClick={() => {
                    addGoalMilestone(
                      g.id,
                      msDraft[g.id] || '',
                      undefined,
                      msDueDraft[g.id] || undefined,
                    )
                    setMsDraft((d) => ({ ...d, [g.id]: '' }))
                    setMsDueDraft((d) => ({ ...d, [g.id]: '' }))
                  }}
                >
                  <Plus size={14} /> Add
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => deleteTeamGoal(g.id)}
                  title="Delete goal"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="filters" style={{ marginTop: '0.45rem' }}>
                <div className="field">
                  <label>Update now €</label>
                  <input
                    type="number"
                    min={0}
                    value={g.currentAmount ?? ''}
                    onChange={(e) =>
                      upsertTeamGoal({
                        ...g,
                        currentAmount: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Update status note</label>
                  <input
                    value={g.currentNote}
                    onChange={(e) => upsertTeamGoal({ ...g, currentNote: e.target.value })}
                  />
                </div>
              </div>
            </MotionCard>
          )
        })}
      </div>
    </>
  )
}
