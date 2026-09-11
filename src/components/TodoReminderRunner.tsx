import { useEffect, useRef } from 'react'
import { useStallOps } from '../context/StallOpsContext'
import type { TeamTodo } from '../lib/stallOps'
import { pendingReminderKinds, sendTodoReminderEmail } from '../lib/todoReminders'

const SESSION_KEY = 'nasta-todo-remind-ran'

/**
 * On app open: send 24h / 2h funny reminder emails for due todos (once per session).
 */
export function TodoReminderRunner() {
  const { teamTodos, updateTeamTodo, notifyEmails } = useStallOps()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY)) {
      ran.current = true
      return
    }
    if (!teamTodos.length) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    ran.current = true
    void (async () => {
      const now = new Date().toISOString()
      for (const todo of teamTodos) {
        const kinds = pendingReminderKinds(todo)
        for (const kind of kinds) {
          try {
            await sendTodoReminderEmail(todo, kind, notifyEmails)
            updateTeamTodo(todo.id, {
              reminded24hAt: kind === '24h' ? now : todo.reminded24hAt,
              reminded2hAt: kind === '2h' ? now : todo.reminded2hAt,
            })
          } catch (err) {
            console.warn('Todo reminder email failed', kind, err)
          }
        }
      }
      try {
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        /* ignore */
      }
    })()
  }, [teamTodos, updateTeamTodo, notifyEmails])

  return null
}

export function dueSoonTodos(todos: TeamTodo[]): TeamTodo[] {
  return todos.filter((t) => !t.done && pendingReminderKinds(t).length > 0)
}
