import { MessageSquare, QrCode, RefreshCw, Star, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EditableText } from '../components/EditableText'
import { MotionCard } from '../components/MotionCard'
import { useAuth } from '../context/AuthContext'
import {
  REVIEW_FORM_CONFIG_ID,
  loadLocalReviews,
  normalizeReview,
  recommendLabel,
  reviewPublicUrl,
  reviewQrImageUrl,
  saveLocalReviews,
  spicyLabel,
  type CustomerReview,
} from '../lib/customerReviews'
import { SITE_CONFIG_ID } from '../lib/siteConfig'
import { formatGermanyDateTime } from '../lib/germanyTime'
import { getSupabase } from '../lib/supabase'
import { teamApiHeaders } from '../lib/teamApiHeaders'
import { analyzeSentiment, detectLanguage, langLabel } from '../lib/textIntel'

function Stars({ n }: { n: number }) {
  if (!n) return <span className="hint-inline">—</span>
  return (
    <span className="review-read-stars" aria-label={`${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} fill={i <= n ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

export function Reviews() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<CustomerReview[]>(() => loadLocalReviews())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const reviewUrl = reviewPublicUrl()
  const qrSrc = reviewQrImageUrl(220)
  const orderUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/order` : 'https://nastazentrum.vercel.app/order'
  const orderQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(orderUrl)}`

  const [needsTableSetup, setNeedsTableSetup] = useState(false)
  const [sqlCopied, setSqlCopied] = useState(false)

  const SETUP_SQL = `create table if not exists public.customer_reviews (
  id text primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);
alter table public.customer_reviews enable row level security;
drop policy if exists "Anyone can insert customer_reviews" on public.customer_reviews;
drop policy if exists "Anyone can read customer_reviews" on public.customer_reviews;
create policy "Anyone can insert customer_reviews"
  on public.customer_reviews for insert to anon, authenticated with check (true);
create policy "Anyone can read customer_reviews"
  on public.customer_reviews for select to anon, authenticated using (true);`

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    setNeedsTableSetup(false)
    const local = loadLocalReviews()
    const cloud: CustomerReview[] = []
    let tableMissing = false
    try {
      const sb = getSupabase()
      if (sb) {
        const { data, error: sbErr } = await sb
          .from('customer_reviews')
          .select('id, payload')
          .order('created_at', { ascending: false })
          .limit(300)
        if (sbErr) {
          const msg = sbErr.message || ''
          if (
            msg.includes('customer_reviews') ||
            msg.includes('schema cache') ||
            sbErr.code === 'PGRST205' ||
            sbErr.code === '42P01'
          ) {
            tableMissing = true
            setNeedsTableSetup(true)
          } else {
            setError(msg)
          }
        } else {
        for (const row of data || []) {
          const id = String((row as { id?: string }).id || '')
          // Skip config / menu-override blobs (can be hundreds of KB each).
          if (
            id === REVIEW_FORM_CONFIG_ID ||
            id === SITE_CONFIG_ID ||
            id.startsWith('__pmenu') ||
            id.startsWith('__site') ||
            id.startsWith('__nasta_login_pin__') ||
            id.startsWith('__cfg')
          ) {
            continue
          }
          const n = normalizeReview((row as { payload: CustomerReview }).payload)
          if (n && n.id !== REVIEW_FORM_CONFIG_ID && n.id !== SITE_CONFIG_ID) cloud.push(n)
        }
        }
      }
      if (user?.name && !tableMissing) {
        const res = await fetch('/api/customer-review', {
          headers: await teamApiHeaders(user),
        })
        if (res.ok) {
          const data = (await res.json()) as { reviews?: CustomerReview[] }
          for (const r of data.reviews || []) {
            const n = normalizeReview(r)
            if (n) cloud.push(n)
          }
        }
      }
      const byId = new Map<string, CustomerReview>()
      for (const r of [...cloud, ...local]) byId.set(r.id, r)
      const merged = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setReviews(merged)
      saveLocalReviews(merged)
    } catch (e) {
      setReviews(local)
      setError(e instanceof Error ? e.message : 'Could not sync cloud reviews')
    } finally {
      setLoading(false)
    }
  }, [user?.email, user?.name])

  async function copySetupSql() {
    await navigator.clipboard.writeText(SETUP_SQL)
    setSqlCopied(true)
    setTimeout(() => setSqlCopied(false), 2000)
  }

  useEffect(() => {
    void refresh()
  }, [refresh])

  const avgOverall = useMemo(() => {
    if (!reviews.length) return 0
    return reviews.reduce((s, r) => s + (r.overallRating || r.foodRating || 0), 0) / reviews.length
  }, [reviews])

  const avgFood = useMemo(() => {
    const rated = reviews.filter((r) => r.foodRating > 0)
    if (!rated.length) return 0
    return rated.reduce((s, r) => s + r.foodRating, 0) / rated.length
  }, [reviews])

  const avgService = useMemo(() => {
    const rated = reviews.filter((r) => r.serviceRating > 0)
    if (!rated.length) return 0
    return rated.reduce((s, r) => s + r.serviceRating, 0) / rated.length
  }, [reviews])

  function clearLocal() {
    if (!confirm('Clear reviews saved on this device? Cloud copies stay if synced.')) return
    saveLocalReviews([])
    setReviews([])
  }

  return (
    <>
      <div className="page-head">
        <div>
          <EditableText
            id="reviews.pageTitle"
            as="h1"
            defaultText="Reviews"
            icon={<MessageSquare size={22} style={{ verticalAlign: -3, marginRight: 8 }} />}
          />
          <EditableText
            id="reviews.pageSub"
            as="p"
            defaultText="Share the QR with customers. They only see the feedback form — all answers land here."
          />
          {loading ? <p className="hint-inline">Syncing…</p> : null}
        </div>
        <button type="button" className="btn ghost" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        <MotionCard interactive={false}>
          <div className="card-head">
            <h2>
              <QrCode size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
              Review QR
            </h2>
          </div>
          <p className="hint-inline" style={{ marginTop: '0.5rem' }}>
            Print or show this QR at the stall. Opens the review form only — no past reviews.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'center',
              marginTop: '0.85rem',
            }}
          >
            <img
              src={qrSrc}
              alt="Customer review QR"
              width={180}
              height={180}
              style={{
                borderRadius: 12,
                background: '#fff',
                objectFit: 'contain',
                border: '1px solid var(--border)',
              }}
            />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div className="field">
                <label htmlFor="review-url">Link</label>
                <input id="review-url" readOnly value={reviewUrl} onFocus={(e) => e.target.select()} />
              </div>
              <button
                type="button"
                className="btn"
                style={{ marginTop: 8 }}
                onClick={() => void navigator.clipboard.writeText(reviewUrl)}
              >
                Copy link
              </button>
            </div>
          </div>
        </MotionCard>

        <MotionCard interactive={false}>
          <div className="card-head">
            <h2>
              <QrCode size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
              Order QR
            </h2>
          </div>
          <p className="hint-inline" style={{ marginTop: '0.5rem' }}>
            Customers browse food, place an order, get a code, then show it to staff to start cooking.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'center',
              marginTop: '0.85rem',
            }}
          >
            <img
              src={orderQrSrc}
              alt="Customer order QR"
              width={180}
              height={180}
              style={{
                borderRadius: 12,
                background: '#fff',
                objectFit: 'contain',
                border: '1px solid var(--border)',
              }}
            />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div className="field">
                <label htmlFor="order-url">Link</label>
                <input id="order-url" readOnly value={orderUrl} onFocus={(e) => e.target.select()} />
              </div>
              <button
                type="button"
                className="btn"
                style={{ marginTop: 8 }}
                onClick={() => void navigator.clipboard.writeText(orderUrl)}
              >
                Copy link
              </button>
            </div>
          </div>
        </MotionCard>

        <MotionCard interactive={false}>
          <h2>Summary</h2>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.25rem',
              marginTop: '0.75rem',
            }}
          >
            <div>
              <div className="hint-inline">Responses</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{reviews.length}</div>
            </div>
            <div>
              <div className="hint-inline">Avg overall</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {reviews.length ? avgOverall.toFixed(1) : '—'}
              </div>
            </div>
            <div>
              <div className="hint-inline">Avg food</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {avgFood ? avgFood.toFixed(1) : '—'}
              </div>
            </div>
            <div>
              <div className="hint-inline">Avg service</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {avgService ? avgService.toFixed(1) : '—'}
              </div>
            </div>
          </div>
          {error && !needsTableSetup && (
            <p className="hint-inline" style={{ marginTop: 8, color: 'var(--danger, #b33)' }}>
              {error}
            </p>
          )}
        </MotionCard>
      </div>

      {needsTableSetup && (
        <MotionCard interactive={false} className="mt-card">
          <h2>One-time cloud setup</h2>
          <p className="hint-inline" style={{ marginTop: '0.5rem' }}>
            Reviews need a small table in Supabase. Open{' '}
            <strong>Supabase → SQL Editor → New query</strong>, paste the SQL below, click{' '}
            <strong>Run</strong>, then hit Refresh here.
          </p>
          <pre
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              fontSize: '0.72rem',
              overflow: 'auto',
              maxHeight: 160,
              whiteSpace: 'pre-wrap',
            }}
          >
            {SETUP_SQL}
          </pre>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn" onClick={() => void copySetupSql()}>
              {sqlCopied ? 'Copied!' : 'Copy SQL'}
            </button>
            <a
              className="btn ghost"
              href="https://supabase.com/dashboard/project/_/sql/new"
              target="_blank"
              rel="noreferrer"
            >
              Open SQL Editor
            </a>
            <button type="button" className="btn ghost" onClick={() => void refresh()}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </MotionCard>
      )}

      <MotionCard interactive={false} className="mt-card">
        <div className="card-head" style={{ justifyContent: 'space-between' }}>
          <h2>All feedback</h2>
          {reviews.length > 0 && (
            <button type="button" className="btn ghost" onClick={clearLocal}>
              <Trash2 size={14} />
              Clear local
            </button>
          )}
        </div>

        {!reviews.length ? (
          <p className="hint-inline" style={{ marginTop: '0.75rem' }}>
            No reviews yet. Share the QR after a sale.
          </p>
        ) : (
          <ul className="review-list">
            {reviews.map((r) => (
              <li key={r.id} className="review-list__item">
                <div className="review-list__head">
                  <strong>{r.name || 'Anonymous'}</strong>
                  <span className="hint-inline">{formatGermanyDateTime(r.createdAt)}</span>
                </div>
                <div className="review-list__meta">
                  <span>
                    Overall <Stars n={r.overallRating || r.foodRating} />
                  </span>
                  <span>
                    Food <Stars n={r.foodRating} />
                  </span>
                  <span>
                    Service <Stars n={r.serviceRating} />
                  </span>
                  {r.spicyOk && <span>Spice: {spicyLabel(r.spicyOk)}</span>}
                  {r.recommend && <span>Recommend: {recommendLabel(r.recommend)}</span>}
                  {(() => {
                    const text = [r.smileNote, r.itemsOther, r.wantOther].filter(Boolean).join(' ')
                    const detected = detectLanguage(text)
                    const lang =
                      r.lang === 'en' || r.lang === 'de'
                        ? r.lang
                        : detected
                    const sent = analyzeSentiment(text, r.overallRating || r.foodRating)
                    return (
                      <>
                        <span className="badge">Lang: {langLabel(lang)}</span>
                        <span
                          className={`badge ${sent.label === 'positive' ? 'ok' : sent.label === 'negative' ? 'warn' : ''}`}
                        >
                          {sent.label} ({sent.score})
                        </span>
                      </>
                    )
                  })()}
                </div>
                {r.items.length > 0 && (
                  <p>
                    <span className="chip-label">Ate</span> {r.items.join(', ')}
                  </p>
                )}
                {r.favorites.length > 0 && (
                  <p>
                    <span className="chip-label">Favorite</span> {r.favorites.join(', ')}
                  </p>
                )}
                {r.visitReason.length > 0 && (
                  <p>
                    <span className="chip-label">Visit</span> {r.visitReason.join(', ')}
                  </p>
                )}
                {r.improve.length > 0 && (
                  <p>
                    <span className="chip-label">Improve</span> {r.improve.join(', ')}
                  </p>
                )}
                {(r.wantToTry.length > 0 || r.wantOther) && (
                  <p>
                    <span className="chip-label">Want</span>{' '}
                    {[...r.wantToTry, r.wantOther].filter(Boolean).join(', ')}
                  </p>
                )}
                {r.smileNote && (
                  <p>
                    <span className="chip-label">Smile</span> {r.smileNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </MotionCard>
    </>
  )
}
