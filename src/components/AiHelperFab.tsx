import { Bot, Send, X } from 'lucide-react'
import { FabDisclose } from './FabDisclose'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBackgroundAi } from '../context/BackgroundAiContext'
import { useStallOps } from '../context/StallOpsContext'
import { askAiHelper } from '../lib/aiClient'
import { canUseAiHelper } from '../lib/authAllowlist'
import { buildSalesAiContext } from '../lib/salesAnomaly'

type Msg = { role: 'user' | 'assistant'; text: string; source?: string }

const WELCOME: Msg = {
  role: 'assistant',
  text: 'Hi! I’m your built-in stall AI. I watch sales, stock, queue & prep in the background. Ask anything — or try the chips below.',
  source: 'kb',
}

/** Bottom-right floating AI helper for all team accounts. */
export function AiHelperFab({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const { orders } = useStallOps()
  const { visibleTips, briefing, urgentCount, refresh } = useBackgroundAi()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([WELCOME])
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const coachSeeded = useRef(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
      if (!coachSeeded.current && briefing) {
        coachSeeded.current = true
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text: `Background coach:\n${briefing}`,
            source: 'coach',
          },
        ])
      }
    }
  }, [open, messages.length, briefing])

  if (!user || !canUseAiHelper(user)) return null

  async function ask(q: string) {
    if (!q || busy || !user) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: q }])
    setBusy(true)
    try {
      const wantsSales =
        /saturday|slow|sales|crash|quiet|why was|weekday|revenue|forecast|coach|suggest/i.test(
          q,
        )
      const tipCtx = visibleTips
        .slice(0, 6)
        .map((t) => `- ${t.title}: ${t.body}`)
        .join('\n')
      const context = wantsSales
        ? `${buildSalesAiContext(orders)}\n\nCoach tips:\n${tipCtx}`
        : tipCtx
          ? `Coach tips:\n${tipCtx}`
          : undefined
      const res = await askAiHelper(user, q, context)
      setMessages((m) => [...m, { role: 'assistant', text: res.answer, source: res.source }])
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: err instanceof Error ? err.message : 'Something went wrong',
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await ask(input.trim())
  }

  const tipChips = visibleTips
    .filter((t) => t.id !== 'all-clear')
    .slice(0, 3)

  const body = (
    <>
      <FabDisclose open={open} className="ai-fab-panel">
          <div className="ai-fab-panel__head">
            <div>
              <strong>
                <Bot size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
                Built-in AI
              </strong>
              <div className="hint-inline" style={{ fontSize: 12 }}>
                Background coach + chat ·{' '}
                <Link to="/" onClick={() => setOpen(false)}>
                  Dashboard panel
                </Link>
              </div>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setOpen(false)}
              aria-label="Close AI helper"
            >
              <X size={16} />
            </button>
          </div>
          <div className="chip-row" style={{ padding: '0 0.75rem 0.35rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => void ask('Why was Saturday slow?')}
            >
              Why was Saturday slow?
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => void ask('What should we prep and push today?')}
            >
              Prep & push today
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => {
                void refresh({ forceLlm: true })
                void ask('Summarize the background coach tips and next actions.')
              }}
            >
              Refresh coach
            </button>
            {tipChips.map((t) => (
              <button
                key={t.id}
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => void ask(`Tell me more: ${t.title}. ${t.body}`)}
              >
                {t.title.length > 28 ? `${t.title.slice(0, 26)}…` : t.title}
              </button>
            ))}
          </div>
          <div className="ai-chat ai-fab-panel__chat" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`ai-bubble ai-bubble--${m.role}`}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                {m.source && m.role === 'assistant' && (
                  <div className="hint-inline" style={{ marginTop: 4 }}>
                    {m.source === 'llm'
                      ? 'AI'
                      : m.source === 'coach'
                        ? 'Coach'
                        : 'Guide'}
                  </div>
                )}
              </div>
            ))}
          </div>
          <form className="ai-fab-panel__form" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the stall AI…"
              disabled={busy}
              aria-label="Your question"
            />
            <button type="submit" className="btn" disabled={busy || !input.trim()} aria-label="Ask">
              <Send size={14} />
            </button>
          </form>
      </FabDisclose>
      <button
        type="button"
        className={`ai-fab-btn${open ? ' is-open' : ''}${urgentCount > 0 && !open ? ' has-alert' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close AI helper' : 'Open AI helper'}
        title="Built-in AI"
      >
        {open ? <X size={22} /> : <Bot size={22} />}
        {urgentCount > 0 && !open ? (
          <span className="ai-fab-badge">{urgentCount > 9 ? '9+' : urgentCount}</span>
        ) : null}
      </button>
    </>
  )

  if (embedded) return body
  return <div className="fab-dock">{body}</div>
}
