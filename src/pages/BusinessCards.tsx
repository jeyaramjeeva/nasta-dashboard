import { Camera, Contact, Plus, ScanText, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { MotionCard } from '../components/MotionCard'
import { useData } from '../context/DataContext'
import { useStallOps } from '../context/StallOpsContext'
import { extractTextFromImageDataUrl } from '../lib/cardOcr'
import { formatGermanyDateTime } from '../lib/germanyTime'
import { fileToCompressedDataUrl } from '../lib/imageDataUrl'
import type { BusinessCard } from '../lib/stallOps'

const emptyDraft = (): Partial<BusinessCard> => ({
  name: '',
  company: '',
  role: '',
  phone: '',
  email: '',
  notes: '',
  extractedText: '',
  frontImageUrl: '',
  backImageUrl: '',
  eventId: '',
})

export function BusinessCards() {
  const { snapshot } = useData()
  const { businessCards, upsertBusinessCard, deleteBusinessCard, syncing } = useStallOps()
  const [draft, setDraft] = useState<Partial<BusinessCard>>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [ocrBusy, setOcrBusy] = useState<'front' | 'back' | null>(null)
  const [q, setQ] = useState('')

  const events = useMemo(
    () =>
      [...(snapshot?.events || [])]
        .filter((e) => e.id.trim().toLowerCase() !== 'setup')
        .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')),
    [snapshot],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return businessCards
    return businessCards.filter((c) =>
      [c.name, c.company, c.role, c.phone, c.email, c.notes, c.extractedText]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [businessCards, q])

  async function onPhoto(side: 'front' | 'back', file: File | null) {
    if (!file) return
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 900, 0.82, 700_000)
      setDraft((d) => ({
        ...d,
        [side === 'front' ? 'frontImageUrl' : 'backImageUrl']: dataUrl,
      }))
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not read photo')
    }
  }

  async function runOcr(side: 'front' | 'back') {
    const url = side === 'front' ? draft.frontImageUrl : draft.backImageUrl
    if (!url) {
      window.alert(`Add a ${side} photo first.`)
      return
    }
    setOcrBusy(side)
    try {
      const { text, fields } = await extractTextFromImageDataUrl(url)
      setDraft((d) => ({
        ...d,
        extractedText: [d.extractedText, text].filter(Boolean).join('\n---\n').slice(0, 4000),
        name: d.name || fields.name || '',
        company: d.company || fields.company || '',
        role: d.role || fields.role || '',
        phone: d.phone || fields.phone || '',
        email: d.email || fields.email || '',
      }))
      if (!text) {
        window.alert('Could not read text — type the details manually.')
      }
    } finally {
      setOcrBusy(null)
    }
  }

  function startEdit(c: BusinessCard) {
    setEditingId(c.id)
    setDraft({ ...c })
  }

  function save() {
    if (!String(draft.name || '').trim() && !draft.frontImageUrl && !draft.backImageUrl) {
      window.alert('Add a name or at least one photo.')
      return
    }
    upsertBusinessCard({
      ...draft,
      id: editingId || undefined,
      name: draft.name || 'Contact',
    })
    setEditingId(null)
    setDraft(emptyDraft())
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <Contact size={22} style={{ verticalAlign: -3, marginRight: 8 }} />
            Business cards
          </h1>
          <p className="hint-inline">
            Photograph front &amp; back of a card, extract text, and keep contacts even if the paper
            is lost.
          </p>
          {syncing ? <p className="hint-inline">Syncing…</p> : null}
        </div>
      </div>

      <div style={{ marginBottom: '0.9rem' }}>
        <MotionCard interactive={false}>
          <div className="card-head">
            <h2>{editingId ? 'Edit card' : 'Add card'}</h2>
            {editingId && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setEditingId(null)
                  setDraft(emptyDraft())
                }}
              >
                Cancel
              </button>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
              marginTop: '0.65rem',
            }}
          >
            {(['front', 'back'] as const).map((side) => {
              const url = side === 'front' ? draft.frontImageUrl : draft.backImageUrl
              return (
                <div key={side}>
                  <div className="hint-inline" style={{ marginBottom: 4 }}>
                    {side === 'front' ? 'Front' : 'Back'}
                  </div>
                  {url ? (
                    <img
                      src={url}
                      alt={`${side} of card`}
                      style={{
                        width: '100%',
                        maxHeight: 160,
                        objectFit: 'contain',
                        borderRadius: 10,
                        background: '#fff',
                        border: '1px solid var(--border)',
                      }}
                    />
                  ) : (
                    <div
                      className="hint-inline"
                      style={{
                        minHeight: 100,
                        display: 'grid',
                        placeItems: 'center',
                        border: '1px dashed var(--border)',
                        borderRadius: 10,
                      }}
                    >
                      No photo
                    </div>
                  )}
                  <div className="page-actions" style={{ marginTop: 6 }}>
                    <label className="btn ghost" style={{ cursor: 'pointer' }}>
                      <Camera size={14} /> Photo
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        hidden
                        onChange={(e) => {
                          void onPhoto(side, e.target.files?.[0] || null)
                          e.target.value = ''
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={ocrBusy !== null || !url}
                      onClick={() => void runOcr(side)}
                    >
                      <ScanText size={14} /> {ocrBusy === side ? 'Reading…' : 'Extract'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="filters" style={{ marginTop: '0.85rem' }}>
            <div className="field">
              <label htmlFor="card-name">Name</label>
              <input
                id="card-name"
                value={draft.name || ''}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="card-company">Company</label>
              <input
                id="card-company"
                value={draft.company || ''}
                onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="card-role">Role</label>
              <input
                id="card-role"
                value={draft.role || ''}
                onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="card-phone">Phone</label>
              <input
                id="card-phone"
                value={draft.phone || ''}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="card-email">Email</label>
              <input
                id="card-email"
                value={draft.email || ''}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="card-event">Event (optional)</label>
              <select
                id="card-event"
                value={draft.eventId || ''}
                onChange={(e) => setDraft((d) => ({ ...d, eventId: e.target.value }))}
              >
                <option value="">—</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.id} · {e.location || e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginTop: '0.65rem' }}>
            <label htmlFor="card-notes">Notes</label>
            <textarea
              id="card-notes"
              rows={2}
              value={draft.notes || ''}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </div>
          <div className="field" style={{ marginTop: '0.55rem' }}>
            <label htmlFor="card-ocr">Extracted text</label>
            <textarea
              id="card-ocr"
              rows={3}
              value={draft.extractedText || ''}
              onChange={(e) => setDraft((d) => ({ ...d, extractedText: e.target.value }))}
              placeholder="OCR text appears here — edit freely"
            />
          </div>
          <button type="button" className="btn" style={{ marginTop: '0.75rem' }} onClick={save}>
            <Plus size={14} /> {editingId ? 'Save card' : 'Add card'}
          </button>
        </MotionCard>
      </div>

      <MotionCard interactive={false}>
        <div className="card-head">
          <h2>Saved ({filtered.length})</h2>
          <input
            placeholder="Search name, company, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 240 }}
          />
        </div>
        <div className="order-list" style={{ marginTop: '0.65rem' }}>
          {filtered.map((c) => (
            <MotionCard key={c.id} interactive={false} className="order-card">
              <div className="card-head">
                <h2>{c.name}</h2>
                <div className="page-actions">
                  <button type="button" className="btn ghost" onClick={() => startEdit(c)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      if (window.confirm(`Delete card for ${c.name}?`)) deleteBusinessCard(c.id)
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="hint-inline">
                {[c.company, c.role, c.phone, c.email, c.eventId ? `Event ${c.eventId}` : '']
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <div className="hint-inline">
                Saved {formatGermanyDateTime(c.updatedAt || c.createdAt)}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 8,
                  flexWrap: 'wrap',
                }}
              >
                {c.frontImageUrl && (
                  <img
                    src={c.frontImageUrl}
                    alt="Front"
                    style={{ height: 72, borderRadius: 8, objectFit: 'cover' }}
                  />
                )}
                {c.backImageUrl && (
                  <img
                    src={c.backImageUrl}
                    alt="Back"
                    style={{ height: 72, borderRadius: 8, objectFit: 'cover' }}
                  />
                )}
              </div>
              {c.notes && <p className="hint-inline" style={{ marginTop: 6 }}>{c.notes}</p>}
            </MotionCard>
          ))}
          {filtered.length === 0 && (
            <p className="hint-inline">No cards yet — photograph the next one you receive.</p>
          )}
        </div>
      </MotionCard>
    </>
  )
}
