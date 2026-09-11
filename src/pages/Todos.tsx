import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, ListTodo, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EditableText } from '../components/EditableText'
import { PillTabs } from '../components/PillTabs'
import { MotionCard } from '../components/MotionCard'
import { springSoft } from '../lib/motion'
import { useStallOps } from '../context/StallOpsContext'
import { germanyTodayYmd } from '../lib/germanyTime'
import type { PrepAssignee, TeamTodo } from '../lib/stallOps'
import { pendingReminderKinds, todoDueDate } from '../lib/todoReminders'

const ASSIGNEES: PrepAssignee[] = ['Sriram', 'Sneha', 'Jeeva', '']

export function Todos() {
  const { teamTodos, addTeamTodo, updateTeamTodo, deleteTeamTodo, syncing } = useStallOps()
  const [text, setText] = useState('')
  const [assignee, setAssignee] = useState<PrepAssignee>('Sriram')
  const [dueYmd, setDueYmd] = useState(germanyTodayYmd())
  const [dueTime, setDueTime] = useState('18:00')
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open')
  const [openId, setOpenId] = useState<string | null>(null)

  const sorted = useMemo(() => {
    return [...teamTodos].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      return `${a.dueYmd}${a.dueTime || ''}`.localeCompare(`${b.dueYmd}${b.dueTime || ''}`)
    })
  }, [teamTodos])

  const visible = sorted.filter((t) => {
    if (filter === 'open') return !t.done
    if (filter === 'done') return t.done
    return true
  })

  function add() {
    addTeamTodo({ text, assignee, dueYmd, dueTime })
    setText('')
  }

  function patchTodo(t: TeamTodo, patch: Partial<TeamTodo>) {
    const dueChanged =
      (patch.dueYmd !== undefined && patch.dueYmd !== t.dueYmd) ||
      (patch.dueTime !== undefined && (patch.dueTime || '') !== (t.dueTime || ''))
    updateTeamTodo(t.id, {
      ...patch,
      ...(dueChanged ? { reminded24hAt: undefined, reminded2hAt: undefined } : {}),
    })
  }

  return (
    <>
      <div className="page-head">
        <div>
          <EditableText
            id="todos.pageTitle"
            as="h1"
            defaultText="To-dos"
            icon={<ListTodo size={22} style={{ verticalAlign: -3, marginRight: 8 }} />}
          />
          <EditableText
            id="todos.pageSub"
            as="p"
            defaultText="Assign tasks with a due date. Edit person, task, or due anytime. Open / Done / All filters — Done keeps finished tasks."
          />
          {syncing ? <p className="hint-inline">Syncing…</p> : null}
        </div>
      </div>

      <MotionCard interactive={false}>
        <EditableText id="todos.newTaskTitle" as="h2" defaultText="New task" />
        <div className="filters" style={{ marginTop: '0.65rem', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 2, minWidth: 180 }}>
            <label htmlFor="todo-text">Task</label>
            <input
              id="todo-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Buy cauliflower packets"
              onKeyDown={(e) => {
                if (e.key === 'Enter') add()
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="todo-who">Who</label>
            <select
              id="todo-who"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value as PrepAssignee)}
            >
              {ASSIGNEES.map((a) => (
                <option key={a || 'any'} value={a}>
                  {a || 'Anyone'}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="todo-due">Due date</label>
            <input
              id="todo-due"
              type="date"
              value={dueYmd}
              onChange={(e) => setDueYmd(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="todo-time">Time</label>
            <input
              id="todo-time"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
            />
          </div>
          <button type="button" className="btn" disabled={!text.trim() || !dueYmd} onClick={add}>
            <Plus size={16} /> Add
          </button>
        </div>
      </MotionCard>

      <PillTabs
        group="todos"
        style={{ margin: '0.85rem 0' }}
        value={filter}
        onChange={setFilter}
        items={[
          { id: 'open', label: 'Open' },
          { id: 'done', label: 'Done' },
          { id: 'all', label: 'All' },
        ]}
      />

      <div className="order-list">
        {visible.length === 0 && (
          <MotionCard interactive={false}>
            <p className="hint-inline">No tasks here yet.</p>
          </MotionCard>
        )}
        {visible.map((t) => {
          const due = todoDueDate(t)
          const soon = pendingReminderKinds(t)
          const overdue = !t.done && due && due.getTime() < Date.now()
          return (
            <MotionCard key={t.id} interactive={false} className="order-card">
              <div className="card-head">
                <span className={`badge ${t.done ? 'ok' : overdue ? 'warn' : ''}`}>
                  {t.done ? 'Done' : overdue ? 'Overdue' : soon.length ? 'Due soon' : 'Open'}
                </span>
                <button
                  type="button"
                  className="btn ghost todo-card__toggle"
                  onClick={() => setOpenId((id) => (id === t.id ? null : t.id))}
                  aria-expanded={openId === t.id}
                >
                  <ChevronDown
                    size={16}
                    style={{
                      transform: openId === t.id ? 'rotate(180deg)' : undefined,
                      transition: 'transform 0.2s ease',
                    }}
                  />
                  {openId === t.id ? 'Hide' : 'Details'}
                </button>
              </div>
              <div
                className="filters"
                style={{ marginTop: '0.55rem', alignItems: 'flex-end', flexWrap: 'wrap' }}
              >
                <div className="field" style={{ flex: 2, minWidth: 180 }}>
                  <label>Task</label>
                  <input
                    value={t.text}
                    disabled={t.done}
                    onChange={(e) => patchTodo(t, { text: e.target.value })}
                    style={{
                      textDecoration: t.done ? 'line-through' : undefined,
                      opacity: t.done ? 0.75 : 1,
                    }}
                  />
                </div>
              </div>
              <AnimatePresence initial={false}>
                {openId === t.id && (
                  <motion.div
                    className="disclose-extra"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={springSoft}
                  >
              <div
                className="filters"
                style={{ marginTop: '0.55rem', alignItems: 'flex-end', flexWrap: 'wrap' }}
              >
                <div className="field">
                  <label>Who</label>
                  <select
                    value={t.assignee}
                    disabled={t.done}
                    onChange={(e) =>
                      patchTodo(t, { assignee: e.target.value as PrepAssignee })
                    }
                  >
                    {ASSIGNEES.map((a) => (
                      <option key={a || 'any'} value={a}>
                        {a || 'Anyone'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Due date</label>
                  <input
                    type="date"
                    value={t.dueYmd || ''}
                    disabled={t.done}
                    onChange={(e) => patchTodo(t, { dueYmd: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Time</label>
                  <input
                    type="time"
                    value={t.dueTime || ''}
                    disabled={t.done}
                    onChange={(e) =>
                      patchTodo(t, { dueTime: e.target.value || undefined })
                    }
                  />
                </div>
              </div>
              <div className="hint-inline" style={{ marginTop: 6 }}>
                {t.reminded24hAt ? '24h reminder sent' : ''}
                {t.reminded24hAt && t.reminded2hAt ? ' · ' : ''}
                {t.reminded2hAt ? '2h reminder sent' : ''}
                {!t.reminded24hAt && !t.reminded2hAt ? 'Reminders pending' : ''}
              </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="page-actions" style={{ marginTop: '0.65rem' }}>
                <button
                  type="button"
                  className="btn action-morph"
                  onClick={() => updateTeamTodo(t.id, { done: !t.done })}
                >
                  <Check size={14} /> {t.done ? 'Reopen' : 'Done'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => deleteTeamTodo(t.id)}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </MotionCard>
          )
        })}
      </div>
    </>
  )
}
