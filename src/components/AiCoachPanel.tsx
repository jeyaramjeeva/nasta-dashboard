import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bot,
  Lightbulb,
  Package,
  RefreshCw,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react'
import { useBackgroundAi } from '../context/BackgroundAiContext'
import type { AiTip } from '../lib/backgroundAi'
import { MotionCard } from './MotionCard'

function tipIcon(kind: AiTip['kind']) {
  switch (kind) {
    case 'forecast':
      return TrendingUp
    case 'alert':
      return AlertTriangle
    case 'stock':
      return Package
    case 'prep':
      return Lightbulb
    default:
      return Sparkles
  }
}

export function AiCoachPanel() {
  const {
    visibleTips,
    briefing,
    actions,
    source,
    running,
    lastRunAt,
    refresh,
    dismiss,
    urgentCount,
  } = useBackgroundAi()

  if (!briefing && !visibleTips.length) return null

  const top = visibleTips.slice(0, 6)
  const when = lastRunAt
    ? new Date(lastRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <MotionCard interactive={false} className="ai-coach-panel">
      <div className="ai-coach-panel__head">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
            <Bot size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
            AI Coach
            {urgentCount > 0 ? (
              <span className="badge warn" style={{ marginLeft: 8 }}>
                {urgentCount} need attention
              </span>
            ) : (
              <span className="badge ok" style={{ marginLeft: 8 }}>
                Watching
              </span>
            )}
          </h2>
          <p className="hint-inline" style={{ margin: '0.25rem 0 0' }}>
            Runs in the background · forecasts, alerts & suggestions
            {when ? ` · updated ${when}` : ''}
            {source === 'llm' ? ' · AI briefing' : ' · live rules'}
          </p>
        </div>
        <button
          type="button"
          className="btn ghost"
          disabled={running}
          onClick={() => void refresh({ forceLlm: true })}
          title="Refresh coach"
        >
          <RefreshCw size={14} className={running ? 'spin' : undefined} />
          Refresh
        </button>
      </div>

      {briefing ? (
        <p className="ai-coach-panel__briefing">{briefing}</p>
      ) : null}

      {actions.length > 0 ? (
        <ul className="ai-coach-panel__actions">
          {actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}

      <div className="ai-coach-panel__tips">
        {top.map((t) => {
          const Icon = tipIcon(t.kind)
          return (
            <div
              key={t.id}
              className={`ai-coach-tip ai-coach-tip--${t.severity}`}
            >
              <Icon size={14} className="ai-coach-tip__icon" />
              <div className="ai-coach-tip__body">
                <strong>{t.title}</strong>
                <div className="hint-inline">{t.body}</div>
                {t.href ? (
                  <Link to={t.href} className="ai-coach-tip__link">
                    Open →
                  </Link>
                ) : null}
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="Dismiss tip"
                onClick={() => dismiss(t.id)}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </MotionCard>
  )
}
