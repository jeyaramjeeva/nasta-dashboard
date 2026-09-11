import { MessageSquare, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  DEFAULT_REVIEW_FORM_CONFIG,
  fetchReviewFormConfig,
  newReviewChip,
  normalizeReviewFormConfig,
  publishReviewFormConfig,
  type ReviewChip,
  type ReviewFormConfig,
} from '../lib/customerReviews'
import { MotionCard } from './MotionCard'

type SectionKey =
  | 'eatExtras'
  | 'spicy'
  | 'improve'
  | 'favorites'
  | 'recommend'
  | 'visitReasons'
  | 'wantTry'

const SECTIONS: { key: SectionKey; title: string; hint: string }[] = [
  { key: 'eatExtras', title: 'What did you eat? (extra chips)', hint: 'Added next to the live menu items.' },
  { key: 'spicy', title: 'Spice level', hint: 'Single-choice chips.' },
  { key: 'improve', title: 'What should we improve?', hint: 'Multi-select chips.' },
  { key: 'favorites', title: 'Favorite today', hint: 'Multi-select chips.' },
  { key: 'recommend', title: 'Would you recommend us?', hint: 'Single-choice chips.' },
  { key: 'visitReasons', title: 'Why did you visit?', hint: 'Multi-select chips.' },
  { key: 'wantTry', title: 'What would you like us to add?', hint: 'Multi-select chips.' },
]

function ChipEditor({
  chips,
  onChange,
}: {
  chips: ReviewChip[]
  onChange: (next: ReviewChip[]) => void
}) {
  function patch(i: number, field: 'en' | 'de', value: string) {
    onChange(chips.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {chips.map((chip, i) => (
        <div
          key={chip.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto',
            gap: 8,
            alignItems: 'end',
          }}
        >
          <div className="field" style={{ margin: 0 }}>
            <label>EN</label>
            <input value={chip.en} onChange={(e) => patch(i, 'en', e.target.value)} maxLength={80} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>DE</label>
            <input value={chip.de} onChange={(e) => patch(i, 'de', e.target.value)} maxLength={80} />
          </div>
          <button
            type="button"
            className="btn ghost"
            title="Remove"
            onClick={() => onChange(chips.filter((_, idx) => idx !== i))}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn ghost"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => onChange([...chips, newReviewChip()])}
      >
        <Plus size={14} />
        Add option
      </button>
    </div>
  )
}

export function ReviewFormEditor() {
  const { user } = useAuth()
  const [draft, setDraft] = useState<ReviewFormConfig>(() =>
    normalizeReviewFormConfig(DEFAULT_REVIEW_FORM_CONFIG),
  )
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<SectionKey | null>('wantTry')

  useEffect(() => {
    void fetchReviewFormConfig().then(setDraft)
  }, [])

  useEffect(() => {
    if (!ok) return
    const t = window.setTimeout(() => setOk(null), 4000)
    return () => window.clearTimeout(t)
  }, [ok])

  async function save() {
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      if (!draft.spicy.length || !draft.wantTry.length) {
        throw new Error('Keep at least one spice option and one “add to menu” option.')
      }
      const saved = await publishReviewFormConfig(draft, user)
      setDraft(saved)
      setOk('Review page options saved. Customers will see them on /review.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  function resetDefaults() {
    if (!confirm('Reset all review options to the built-in defaults?')) return
    setDraft(normalizeReviewFormConfig(DEFAULT_REVIEW_FORM_CONFIG))
  }

  return (
    <MotionCard interactive={false} className="upload-panel mt-card">
      <div className="card-head">
        <h2>
          <MessageSquare size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
          Review page options
        </h2>
      </div>
      <p className="hint-inline" style={{ marginTop: '0.5rem' }}>
        Add, edit, or remove chips on the customer QR form (EN + DE). Save publishes to the live
        /review page.
      </p>

      <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SECTIONS.map((section) => {
          const isOpen = open === section.key
          return (
            <div
              key={section.key}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '0.65rem 0.75rem',
                background: 'var(--bg-elev)',
              }}
            >
              <button
                type="button"
                className="btn ghost"
                style={{ width: '100%', justifyContent: 'space-between' }}
                onClick={() => setOpen(isOpen ? null : section.key)}
              >
                <span>
                  <strong>{section.title}</strong>
                  <span className="hint-inline" style={{ marginLeft: 8 }}>
                    ({draft[section.key].length})
                  </span>
                </span>
                <span>{isOpen ? 'Hide' : 'Edit'}</span>
              </button>
              {isOpen && (
                <>
                  <p className="hint-inline" style={{ marginTop: 6 }}>
                    {section.hint}
                  </p>
                  <ChipEditor
                    chips={draft[section.key]}
                    onChange={(next) => setDraft((d) => ({ ...d, [section.key]: next }))}
                  />
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="page-actions" style={{ marginTop: '0.85rem', gap: 8 }}>
        <button type="button" className="btn" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save review page'}
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={resetDefaults}>
          <RotateCcw size={14} />
          Reset defaults
        </button>
      </div>
      {error && (
        <div className="alert-item login-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
      {ok && (
        <div className="alert-item" style={{ color: 'var(--ok)', marginTop: 10 }}>
          {ok}
        </div>
      )}
    </MotionCard>
  )
}
