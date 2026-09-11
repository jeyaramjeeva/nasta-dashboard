import { germanyWallTime } from './germanyTime'
import { PASSWORD_HELP_EMAIL } from './passwordHelp'
import type { TeamNotifyEmails, TeamTodo } from './stallOps'

const FUNNY_24H = [
  'Tomorrow’s you will thank today’s you — unless today’s you ghosts the task. Don’t ghost the dosa destiny!',
  '24 hours left! That’s ~1,440 minutes of potential procrastination… or one heroic finish. Choose hero mode.',
  'Gentle nudge from Stall HQ: the task isn’t going to chop the cauliflower by itself. You’ve got this!',
  'Reminder: unfinished tasks multiply like idlis in a steamer. Knock this one out before it becomes a buffet.',
]

const FUNNY_2H = [
  'TWO HOURS! The chutney is metaphorically boiling. Finish it with a smile (and maybe a chai).',
  'Final call — 2 hours left. Future you is already high-fiving you. Don’t leave them hanging!',
  'Red alert (friendly edition): 120 minutes to glory. You’ve crushed worse queues — crush this task!',
  'Tick tock! Like a busy Flohmarkt morning. Wrap it up, champion of the plate hunt!',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

export type ReminderKind = '24h' | '2h'

export function todoDueDate(todo: TeamTodo): Date | null {
  if (!todo.dueYmd) return null
  const [hh, mm] = (todo.dueTime || '18:00').split(':').map(Number)
  return germanyWallTime(todo.dueYmd, hh || 18, mm || 0)
}

/** Which reminder windows are active now (and not yet sent). */
export function pendingReminderKinds(todo: TeamTodo, now = new Date()): ReminderKind[] {
  if (todo.done) return []
  const due = todoDueDate(todo)
  if (!due) return []
  const ms = due.getTime() - now.getTime()
  if (ms <= 0) return []
  const kinds: ReminderKind[] = []
  const h24 = 24 * 3600 * 1000
  const h2 = 2 * 3600 * 1000
  if (ms <= h24 && ms > h2 && !todo.reminded24hAt) kinds.push('24h')
  if (ms <= h2 && !todo.reminded2hAt) kinds.push('2h')
  return kinds
}

export function funnyReminderBody(todo: TeamTodo, kind: ReminderKind): string {
  const joke = kind === '24h' ? pick(FUNNY_24H) : pick(FUNNY_2H)
  const who = todo.assignee || 'Team'
  return [
    `Hey ${who}!`,
    '',
    joke,
    '',
    `Task: ${todo.text}`,
    `Due: ${todo.dueYmd}${todo.dueTime ? ` ${todo.dueTime}` : ''} (Europe/Berlin)`,
    '',
    'Open Todos in Nasta Zentrum Tracker and mark it done when you’re finished — smile optional but recommended.',
  ].join('\n')
}

async function formSubmit(toEmail: string, subject: string, message: string): Promise<void> {
  const res = await fetch(`https://formsubmit.co/ajax/${toEmail}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      name: 'Nasta Zentrum Tracker',
      email: 'noreply@nastazentrum.de',
      _subject: subject,
      _template: 'table',
      _captcha: 'false',
      message,
    }),
  })
  const data = (await res.json().catch(() => null)) as
    | { success?: boolean | string; message?: string }
    | null
  if (!res.ok || (data && (data.success === false || data.success === 'false'))) {
    throw new Error(data?.message || 'Could not send reminder email.')
  }
}

function resolveNotifyInbox(
  assignee: string | undefined,
  notifyEmails: TeamNotifyEmails | undefined,
): string {
  const name = (assignee || '').trim()
  if (name === 'Jeeva' || name === 'Sriram' || name === 'Sneha') {
    const configured = notifyEmails?.[name]?.trim()
    if (configured?.includes('@')) return configured
  }
  // Fallback: Jeeva’s configured inbox, then default help email
  const jeeva = notifyEmails?.Jeeva?.trim()
  if (jeeva?.includes('@')) return jeeva
  return PASSWORD_HELP_EMAIL
}

/** Email funny reminder to the assignee’s configured inbox (Account → notify emails). */
export async function sendTodoReminderEmail(
  todo: TeamTodo,
  kind: ReminderKind,
  notifyEmails?: TeamNotifyEmails,
): Promise<void> {
  const subject = `Nasta ${kind === '24h' ? '24h' : '2h'} reminder — ${todo.assignee || 'Team'}`
  const message = funnyReminderBody(todo, kind)
  const to = resolveNotifyInbox(todo.assignee, notifyEmails)
  await formSubmit(to, subject, message)

  // Also CC Jeeva when the task is for someone else
  const jeeva = notifyEmails?.Jeeva?.trim() || PASSWORD_HELP_EMAIL
  if (todo.assignee && todo.assignee !== 'Jeeva' && jeeva.includes('@') && jeeva !== to) {
    try {
      await formSubmit(jeeva, `[CC] ${subject}`, message)
    } catch {
      /* primary already sent */
    }
  }
}

export function inspirationForEventDay(location: string): string {
  const lines = [
    `Event day in ${location}! Fresh dosa energy — smile at the first customer and the rest will follow.`,
    `Today’s stall in ${location} is your stage. Serve pride, chai warmth, and that Nasta grin.`,
    `${location} awaits! Remember: every plate is a tiny victory. Let’s cook with joy.`,
    `Market day magic in ${location}. Team Nasta — you’ve prepped, now enjoy the rush!`,
  ]
  return pick(lines)
}
