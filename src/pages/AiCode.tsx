import { Code2, ExternalLink, RefreshCw, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { MotionCard } from '../components/MotionCard'
import { useAuth } from '../context/AuthContext'
import { fetchAiAgentStatus, launchAiCodeAgent } from '../lib/aiClient'
import { canUseAiCodeAgent } from '../lib/authAllowlist'

export function AiCode() {
  const { user } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agentId, setAgentId] = useState('')
  const [agentUrl, setAgentUrl] = useState('')
  const [statusText, setStatusText] = useState('')
  const [log, setLog] = useState<string[]>([])

  if (!user || !canUseAiCodeAgent(user)) {
    return (
      <MotionCard interactive={false}>
        <h2>AI Code Agent</h2>
        <p className="hint-inline">
          Developer only. Everyone else can use the AI helper button (bottom right) for how-to
          questions.
        </p>
      </MotionCard>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const text = prompt.trim()
    if (!text || busy || !user) return
    setBusy(true)
    setError(null)
    setLog((l) => [`→ ${text}`, ...l].slice(0, 20))
    try {
      const data = await launchAiCodeAgent(user, text, agentId || undefined)
      const id = data.agent?.id || agentId
      const url = data.agent?.url || agentUrl
      if (id) setAgentId(id)
      if (url) setAgentUrl(url)
      setStatusText(data.agent?.status || data.run?.status || 'started')
      setLog((l) =>
        [
          `Agent ${id || '?'} · ${data.agent?.status || 'ok'}${url ? ` · ${url}` : ''}`,
          ...l,
        ].slice(0, 20),
      )
      setPrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start agent')
    } finally {
      setBusy(false)
    }
  }

  async function refreshStatus() {
    if (!agentId || !user) return
    setBusy(true)
    setError(null)
    try {
      const data = await fetchAiAgentStatus(user, agentId)
      const ag = data.agent || (data as { id?: string; status?: string; url?: string })
      setStatusText(String(ag.status || 'unknown'))
      if (ag.url) setAgentUrl(String(ag.url))
      setLog((l) => [`Status: ${ag.status || JSON.stringify(data).slice(0, 120)}`, ...l].slice(0, 20))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>
          <Code2 size={22} style={{ verticalAlign: -4, marginRight: 8 }} />
          AI Code Agent
        </h1>
        <p className="hint-inline">
          Developer only · Cursor cloud agent edits GitHub and opens a PR. You review &amp; merge.
        </p>
      </div>

      <MotionCard interactive={false}>
        <p className="hint-inline">
          Needs <code>CURSOR_API_KEY</code> in Vercel env (Cursor Dashboard → API Keys). Repo:{' '}
          <code>jeyaramjeeva/nasta-dashboard</code>. After the PR merges, redeploy / wait for
          Vercel.
        </p>

        <form className="filters" style={{ marginTop: '0.85rem' }} onSubmit={onSubmit}>
          <div className="field" style={{ flex: 1, minWidth: 240 }}>
            <label htmlFor="ai-code-prompt">What should change?</label>
            <textarea
              id="ai-code-prompt"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Add a tip default of €1 on cash delivery screen"
              disabled={busy}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
          <button type="submit" className="btn" disabled={busy || !prompt.trim()}>
            <Send size={14} /> {busy ? 'Working…' : agentId ? 'Follow-up' : 'Start agent'}
          </button>
        </form>

        {error && (
          <div className="msg err" style={{ marginTop: '0.75rem' }}>
            {error}
          </div>
        )}

        {(agentId || agentUrl) && (
          <div className="filters" style={{ marginTop: '0.85rem', alignItems: 'center' }}>
            <span className="badge">{statusText || '…'}</span>
            <code className="hint-inline">{agentId}</code>
            {agentUrl && (
              <a className="btn ghost" href={agentUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> Open in Cursor
              </a>
            )}
            <button type="button" className="btn ghost" disabled={busy || !agentId} onClick={() => void refreshStatus()}>
              <RefreshCw size={14} /> Refresh status
            </button>
          </div>
        )}

        {log.length > 0 && (
          <ul className="hint-inline" style={{ marginTop: '0.75rem', paddingLeft: '1.1rem' }}>
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </MotionCard>
    </>
  )
}
