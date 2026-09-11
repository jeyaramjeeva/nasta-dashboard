import {
  Check,
  Clock,
  ImagePlus,
  LayoutGrid,
  Mail,
  MapPin,
  Palette,
  PanelLeft,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  Sparkles,
  TextQuote,
  Trash2,
  Type,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MotionCard } from '../components/MotionCard'
import { ReviewFormEditor } from '../components/ReviewFormEditor'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useSiteConfig } from '../context/SiteConfigContext'
import { useStallOps } from '../context/StallOpsContext'
import { mergeEventRows } from '../lib/eventBook'
import { fileToCompressedDataUrl, fileToMenuImageDataUrl } from '../lib/imageDataUrl'
import { getPaypalMeUrl, resolvePaypalQrSrc } from '../lib/paypalMe'
import { PASSWORD_HELP_EMAIL } from '../lib/passwordHelp'
import {
  defaultSiteConfig,
  newFeatureTab,
  newNoteWidget,
  type SiteConfig,
  type SiteFeatureTab,
  type SiteNavItem,
  type SiteWidget,
} from '../lib/siteConfig'
import type { TeamMemberName } from '../lib/stallOps'

type StudioTab =
  | 'brand'
  | 'theme'
  | 'settings'
  | 'copy'
  | 'inline'
  | 'widgets'
  | 'nav'
  | 'features'
  | 'menu'
  | 'tools'

const TEAM_NAMES: TeamMemberName[] = ['Sriram', 'Sneha', 'Jeeva']

export function DeveloperStudio() {
  const { user } = useAuth()
  const { snapshot } = useData()
  const { config, save, loading } = useSiteConfig()
  const {
    paypalQrDataUrl,
    setPaypalQrDataUrl,
    notifyEmails,
    setNotifyEmail,
    menu,
    setMenuImageUrl,
    pushMenuPhotosToCloud,
    eventBook,
    setEventMapsQuery,
  } = useStallOps()
  const [tab, setTab] = useState<StudioTab>('brand')
  const [menuImgBusy, setMenuImgBusy] = useState<string | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const menuImgRef = useRef<HTMLInputElement>(null)
  const [menuImgTarget, setMenuImgTarget] = useState<string | null>(null)
  const [draft, setDraft] = useState<SiteConfig>(config)
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [qrBusy, setQrBusy] = useState(false)
  const [pinDrafts, setPinDrafts] = useState<Record<string, string>>({})
  const [emailDraft, setEmailDraft] = useState<Record<TeamMemberName, string>>({
    Sriram: '',
    Sneha: '',
    Jeeva: '',
  })

  const stallEvents = useMemo(() => {
    const rows = mergeEventRows(snapshot?.events || [], eventBook)
    return [...rows]
      .filter((e) => e.location || e.startDate)
      .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
      .slice(0, 80)
  }, [snapshot?.events, eventBook])

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const e of stallEvents) {
      next[e.id] = e.mapsQuery || ''
    }
    setPinDrafts(next)
  }, [stallEvents])

  useEffect(() => {
    setDraft(config)
  }, [config])

  useEffect(() => {
    setEmailDraft({
      Sriram: notifyEmails.Sriram || '',
      Sneha: notifyEmails.Sneha || '',
      Jeeva: notifyEmails.Jeeva || '',
    })
  }, [notifyEmails])

  useEffect(() => {
    if (!ok) return
    const t = window.setTimeout(() => setOk(null), 4000)
    return () => window.clearTimeout(t)
  }, [ok])

  async function saveSite() {
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      await save(draft)
      setOk('Saved. All accounts will see these changes after refresh.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  function resetSite() {
    if (!confirm('Reset brand, theme, nav and feature tabs to defaults?')) return
    setDraft(defaultSiteConfig())
  }

  function patchNav(id: string, patch: Partial<SiteNavItem>) {
    setDraft((d) => ({
      ...d,
      nav: d.nav.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }))
  }

  function addFeature() {
    const f = newFeatureTab('New feature')
    setDraft((d) => ({
      ...d,
      features: [...d.features, f],
      nav: [
        ...d.nav,
        {
          id: `feature-${f.id}`,
          to: `/feature/${f.id}`,
          labelEn: f.labelEn,
          labelDe: f.labelDe,
          visible: true,
          audience: 'team',
          stallOk: true,
          custom: true,
        },
      ],
    }))
    setTab('features')
  }

  function updateFeature(id: string, patch: Partial<SiteFeatureTab>) {
    setDraft((d) => {
      const features = d.features.map((f) => (f.id === id ? { ...f, ...patch } : f))
      const nav = d.nav.map((n) => {
        if (n.to !== `/feature/${id}` && n.id !== `feature-${id}`) return n
        return {
          ...n,
          labelEn: patch.labelEn ?? n.labelEn,
          labelDe: patch.labelDe ?? n.labelDe,
          visible: patch.visible ?? n.visible,
        }
      })
      return { ...d, features, nav }
    })
  }

  function removeFeature(id: string) {
    if (!confirm('Remove this feature tab?')) return
    setDraft((d) => ({
      ...d,
      features: d.features.filter((f) => f.id !== id),
      nav: d.nav.filter((n) => n.to !== `/feature/${id}` && n.id !== `feature-${id}`),
    }))
  }

  async function onQrFile(file: File | null) {
    if (!file) return
    setQrBusy(true)
    try {
      const dataUrl = await fileToCompressedDataUrl(file)
      setPaypalQrDataUrl(dataUrl)
      setOk('PayPal QR saved for the whole team.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'QR upload failed')
    } finally {
      setQrBusy(false)
    }
  }

  async function onMenuImgFile(file: File | null) {
    const id = menuImgTarget
    if (!file || !id) return
    setMenuImgBusy(id)
    setError(null)
    try {
      const dataUrl = await fileToMenuImageDataUrl(file)
      await setMenuImageUrl(id, dataUrl)
      const item = menu.find((m) => m.id === id)
      setOk(
        `Photo saved for ${item?.name || 'item'}. Refresh the customer /order page to see it.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo upload failed')
    } finally {
      setMenuImgBusy(null)
      setMenuImgTarget(null)
      if (menuImgRef.current) menuImgRef.current.value = ''
    }
  }

  function saveEmails() {
    for (const name of TEAM_NAMES) {
      const v = emailDraft[name].trim()
      if (v && !v.includes('@')) {
        setError(`${name}: enter a valid email`)
        return
      }
    }
    for (const name of TEAM_NAMES) setNotifyEmail(name, emailDraft[name].trim())
    setOk('Notification emails saved for the team.')
  }

  function patchWidget(id: string, patch: Partial<SiteWidget>) {
    setDraft((d) => ({
      ...d,
      widgets: d.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }))
  }

  const tabs: { id: StudioTab; label: string; icon: typeof Type }[] = [
    { id: 'brand', label: 'Brand', icon: Type },
    { id: 'theme', label: 'UI', icon: Palette },
    { id: 'settings', label: 'Settings', icon: Clock },
    { id: 'copy', label: 'Labels', icon: TextQuote },
    { id: 'inline', label: 'Inline pens', icon: Type },
    { id: 'widgets', label: 'Widgets', icon: LayoutGrid },
    { id: 'nav', label: 'Tabs', icon: PanelLeft },
    { id: 'features', label: 'Features', icon: Sparkles },
    { id: 'menu', label: 'Menu photos', icon: ImagePlus },
    { id: 'tools', label: 'Tools', icon: Wrench },
  ]

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <Sparkles size={22} style={{ verticalAlign: -3, marginRight: 8 }} />
            Developer Studio
          </h1>
          <p>
            Full control: idle times, labels, widgets, UI, tabs, and team tools. Save syncs to every
            account.
            {loading ? ' Loading…' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn ghost" onClick={resetSite}>
            <RotateCcw size={16} />
            Reset defaults
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void saveSite()}>
            <Save size={16} />
            {busy ? 'Saving…' : 'Save for everyone'}
          </button>
        </div>
      </div>

      {(ok || error) && (
        <MotionCard interactive={false} className="mt-card">
          {error && <div className="alert-item login-error">{error}</div>}
          {ok && (
            <div className="alert-item" style={{ color: 'var(--ok)' }}>
              <Check size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              {ok}
            </div>
          )}
        </MotionCard>
      )}

      <div className="chip-row" style={{ marginTop: '0.75rem' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={14} style={{ marginRight: 4 }} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'brand' && (
        <MotionCard interactive={false} className="mt-card">
          <h2>Brand & text</h2>
          <p className="hint-inline">Shown on login, sidebar, and the public review page.</p>
          <div className="filters" style={{ marginTop: 12, flexDirection: 'column', alignItems: 'stretch' }}>
            {(
              [
                ['brandName', 'Brand name'],
                ['brandTaglineEn', 'Tagline (EN)'],
                ['brandTaglineDe', 'Tagline (DE)'],
                ['loginTitleEn', 'Login title (EN)'],
                ['loginTitleDe', 'Login title (DE)'],
                ['reviewEyebrow', 'Review page eyebrow'],
                ['sidebarFooterEn', 'Sidebar footer note (EN)'],
                ['sidebarFooterDe', 'Sidebar footer note (DE)'],
              ] as const
            ).map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={key}>{label}</label>
                <input
                  id={key}
                  value={draft.text[key]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, text: { ...d.text, [key]: e.target.value } }))
                  }
                />
              </div>
            ))}
            <label className="hint-inline" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={draft.settings.showBrandSub}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    settings: { ...d.settings, showBrandSub: e.target.checked },
                  }))
                }
              />
              Show brand tagline under logo
            </label>
          </div>
        </MotionCard>
      )}

      {tab === 'theme' && (
        <MotionCard interactive={false} className="mt-card">
          <h2>UI theme</h2>
          <p className="hint-inline">Leave blank to keep app defaults. Applies for everyone.</p>
          <div className="filters" style={{ marginTop: 12 }}>
            {(
              [
                ['accent', 'Accent', '#2f7a45'],
                ['accent2', 'Accent 2', '#c4893a'],
                ['bg', 'Background', '#f4f5f7'],
                ['bgElev', 'Card background', '#ffffff'],
              ] as const
            ).map(([key, label, fallback]) => (
              <div className="field" key={key}>
                <label htmlFor={key}>{label}</label>
                <input
                  id={key}
                  type="color"
                  value={draft.theme[key] || fallback}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, theme: { ...d.theme, [key]: e.target.value } }))
                  }
                />
              </div>
            ))}
            <div className="field">
              <label htmlFor="radius">Corner radius (e.g. 12px)</label>
              <input
                id="radius"
                value={draft.theme.radius}
                placeholder="18px"
                onChange={(e) =>
                  setDraft((d) => ({ ...d, theme: { ...d.theme, radius: e.target.value } }))
                }
              />
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="customCss">Custom CSS (advanced)</label>
            <textarea
              id="customCss"
              rows={6}
              placeholder={'.brand-mark { letter-spacing: 0.08em; }'}
              value={draft.theme.customCss}
              onChange={(e) =>
                setDraft((d) => ({ ...d, theme: { ...d.theme, customCss: e.target.value } }))
              }
            />
          </div>
          <button
            type="button"
            className="btn ghost"
            style={{ marginTop: 10 }}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                theme: { accent: '', accent2: '', radius: '', bg: '', bgElev: '', customCss: '' },
              }))
            }
          >
            Clear theme overrides
          </button>
        </MotionCard>
      )}

      {tab === 'settings' && (
        <MotionCard interactive={false} className="mt-card">
          <h2>App settings</h2>
          <p className="hint-inline">Idle timers, unlock PIN, and dashboard behaviour.</p>
          <div className="filters" style={{ marginTop: 12 }}>
            <div className="field">
              <label htmlFor="idleEnter">Stall auto-lock after Orders idle (minutes)</label>
              <input
                id="idleEnter"
                type="number"
                min={1}
                max={240}
                value={draft.settings.idleEnterMinutes}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    settings: { ...d.settings, idleEnterMinutes: Number(e.target.value) || 15 },
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="idleRelock">Re-lock after unlock idle (minutes)</label>
              <input
                id="idleRelock"
                type="number"
                min={1}
                max={240}
                value={draft.settings.idleRelockMinutes}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    settings: { ...d.settings, idleRelockMinutes: Number(e.target.value) || 15 },
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="unlockPin">Stall unlock PIN</label>
              <input
                id="unlockPin"
                value={draft.settings.unlockPin}
                maxLength={8}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    settings: {
                      ...d.settings,
                      unlockPin: e.target.value.replace(/\D/g, '').slice(0, 8),
                    },
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="platePrice">Plate hunt € price hint</label>
              <input
                id="platePrice"
                type="number"
                min={1}
                max={100}
                value={draft.settings.platePriceHint}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    settings: { ...d.settings, platePriceHint: Number(e.target.value) || 8 },
                  }))
                }
              />
            </div>
          </div>
          <label
            className="hint-inline"
            style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}
          >
            <input
              type="checkbox"
              checked={draft.settings.showCountdown}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  settings: { ...d.settings, showCountdown: e.target.checked },
                }))
              }
            />
            Show dashboard countdown block
          </label>
        </MotionCard>
      )}

      {tab === 'copy' && (
        <MotionCard interactive={false} className="mt-card">
          <h2>Labels & copy</h2>
          <p className="hint-inline">
            Edit or hide common UI strings. Hidden labels disappear for everyone.
          </p>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {draft.copy.map((c, i) => (
              <div
                key={c.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr 1fr auto',
                  gap: 8,
                  alignItems: 'end',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <div className="hint-inline" style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  {c.key}
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>EN</label>
                  <input
                    value={c.en}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        copy: d.copy.map((x, idx) =>
                          idx === i ? { ...x, en: e.target.value } : x,
                        ),
                      }))
                    }
                  />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>DE</label>
                  <input
                    value={c.de}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        copy: d.copy.map((x, idx) =>
                          idx === i ? { ...x, de: e.target.value } : x,
                        ),
                      }))
                    }
                  />
                </div>
                <label className="hint-inline" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={c.hidden}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        copy: d.copy.map((x, idx) =>
                          idx === i ? { ...x, hidden: e.target.checked } : x,
                        ),
                      }))
                    }
                  />
                  Hide
                </label>
              </div>
            ))}
          </div>
        </MotionCard>
      )}

      {tab === 'inline' && (
        <MotionCard interactive={false} className="mt-card">
          <div className="card-head" style={{ justifyContent: 'space-between' }}>
            <h2>Inline Edit UI pens</h2>
            <button
              type="button"
              className="btn ghost"
              disabled={Object.keys(draft.inlineEdits || {}).length === 0}
              onClick={() => {
                if (!confirm('Clear all inline pen overrides?')) return
                setDraft((d) => ({ ...d, inlineEdits: {} }))
              }}
            >
              <RotateCcw size={16} />
              Clear all
            </button>
          </div>
          <p className="hint-inline" style={{ marginTop: 8 }}>
            Turn on the pencil in the top bar, then click pens next to labels on any page. Overrides
            sync here for every account.
          </p>
          {Object.keys(draft.inlineEdits || {}).length === 0 ? (
            <p className="hint-inline" style={{ marginTop: 12 }}>
              No inline edits yet.
            </p>
          ) : (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(draft.inlineEdits).map(([key, edit]) => (
                <div
                  key={key}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: 10,
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 8,
                    alignItems: 'start',
                  }}
                >
                  <div>
                    <div className="hint-inline" style={{ fontSize: 11 }}>
                      {key}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      {edit.deleted || edit.hidden ? (
                        <em>Hidden / deleted</em>
                      ) : (
                        edit.text || <em>Style only</em>
                      )}
                    </div>
                    <div className="hint-inline" style={{ marginTop: 4, fontSize: 11 }}>
                      {[
                        edit.fontSize && `size ${edit.fontSize}`,
                        edit.fontFamily && 'custom font',
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() =>
                      setDraft((d) => {
                        const inlineEdits = { ...d.inlineEdits }
                        delete inlineEdits[key]
                        return { ...d, inlineEdits }
                      })
                    }
                  >
                    <Trash2 size={14} />
                    Reset
                  </button>
                </div>
              ))}
            </div>
          )}
        </MotionCard>
      )}

      {tab === 'widgets' && (
        <MotionCard interactive={false} className="mt-card">
          <div className="card-head" style={{ justifyContent: 'space-between' }}>
            <h2>Dashboard widgets</h2>
            <button
              type="button"
              className="btn"
              onClick={() =>
                setDraft((d) => ({ ...d, widgets: [...d.widgets, newNoteWidget()] }))
              }
            >
              <Plus size={16} />
              Add note widget
            </button>
          </div>
          <p className="hint-inline" style={{ marginTop: 8 }}>
            Show/hide built-in widgets, rename titles, or add custom note cards.
          </p>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {draft.widgets.map((w) => (
              <div
                key={w.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div className="filters" style={{ alignItems: 'end' }}>
                  <div className="hint-inline" style={{ minWidth: 90 }}>
                    {w.kind === 'builtin' ? `Built-in: ${w.builtinId}` : 'Custom note'}
                  </div>
                  <div className="field">
                    <label>Title EN</label>
                    <input
                      value={w.titleEn}
                      onChange={(e) => patchWidget(w.id, { titleEn: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Title DE</label>
                    <input
                      value={w.titleDe}
                      onChange={(e) => patchWidget(w.id, { titleDe: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Tone</label>
                    <select
                      value={w.tone}
                      onChange={(e) =>
                        patchWidget(w.id, { tone: e.target.value as SiteWidget['tone'] })
                      }
                    >
                      <option value="leaf">Leaf</option>
                      <option value="gold">Gold</option>
                      <option value="warn">Warn</option>
                    </select>
                  </div>
                  <label className="hint-inline" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={w.visible}
                      onChange={(e) => patchWidget(w.id, { visible: e.target.checked })}
                    />
                    Visible
                  </label>
                  {w.kind === 'note' && (
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          widgets: d.widgets.filter((x) => x.id !== w.id),
                        }))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {w.kind === 'note' && (
                  <>
                    <div className="field" style={{ marginTop: 8 }}>
                      <label>Body EN</label>
                      <textarea
                        rows={2}
                        value={w.bodyEn}
                        onChange={(e) => patchWidget(w.id, { bodyEn: e.target.value })}
                      />
                    </div>
                    <div className="field" style={{ marginTop: 8 }}>
                      <label>Body DE</label>
                      <textarea
                        rows={2}
                        value={w.bodyDe}
                        onChange={(e) => patchWidget(w.id, { bodyDe: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </MotionCard>
      )}

      {tab === 'nav' && (
        <MotionCard interactive={false} className="mt-card">
          <h2>Sidebar tabs</h2>
          <p className="hint-inline">
            Show/hide tabs and who can see them. Custom feature tabs appear here too.
          </p>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {draft.nav.map((n) => (
              <div
                key={n.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 140px 100px auto',
                  gap: 8,
                  alignItems: 'end',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <div className="field" style={{ margin: 0 }}>
                  <label>EN</label>
                  <input
                    value={n.labelEn}
                    onChange={(e) => patchNav(n.id, { labelEn: e.target.value })}
                  />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>DE</label>
                  <input
                    value={n.labelDe}
                    onChange={(e) => patchNav(n.id, { labelDe: e.target.value })}
                  />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>Audience</label>
                  <select
                    value={n.audience}
                    onChange={(e) =>
                      patchNav(n.id, { audience: e.target.value as SiteNavItem['audience'] })
                    }
                  >
                    <option value="all">Everyone</option>
                    <option value="team">Team (no guest)</option>
                    <option value="jeeva">Jeeva / Developer</option>
                    <option value="developer">Developer only</option>
                    <option value="guest">Guest only</option>
                  </select>
                </div>
                <label className="hint-inline" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={n.visible}
                    onChange={(e) => patchNav(n.id, { visible: e.target.checked })}
                  />
                  Visible
                </label>
                <span className="hint-inline" style={{ fontSize: 11 }}>
                  {n.to}
                </span>
              </div>
            ))}
          </div>
        </MotionCard>
      )}

      {tab === 'features' && (
        <MotionCard interactive={false} className="mt-card">
          <div className="card-head" style={{ justifyContent: 'space-between' }}>
            <h2>Feature pages</h2>
            <button type="button" className="btn" onClick={addFeature}>
              <Plus size={16} />
              Add feature tab
            </button>
          </div>
          <p className="hint-inline" style={{ marginTop: 8 }}>
            Creates a new sidebar page with your content. Visible to the audience you set under Tabs.
          </p>
          {!draft.features.length && (
            <p className="hint-inline" style={{ marginTop: 12 }}>
              No custom features yet. Tap Add feature tab.
            </p>
          )}
          {draft.features.map((f) => (
            <div
              key={f.id}
              style={{
                marginTop: 14,
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div className="filters" style={{ alignItems: 'end' }}>
                <div className="field">
                  <label>Label EN</label>
                  <input
                    value={f.labelEn}
                    onChange={(e) => updateFeature(f.id, { labelEn: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Label DE</label>
                  <input
                    value={f.labelDe}
                    onChange={(e) => updateFeature(f.id, { labelDe: e.target.value })}
                  />
                </div>
                <label className="hint-inline" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={f.visible}
                    onChange={(e) => updateFeature(f.id, { visible: e.target.checked })}
                  />
                  Visible
                </label>
                <button type="button" className="btn ghost" onClick={() => removeFeature(f.id)}>
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <label>Body EN</label>
                <textarea
                  rows={4}
                  value={f.bodyEn}
                  onChange={(e) => updateFeature(f.id, { bodyEn: e.target.value })}
                />
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <label>Body DE</label>
                <textarea
                  rows={4}
                  value={f.bodyDe}
                  onChange={(e) => updateFeature(f.id, { bodyDe: e.target.value })}
                />
              </div>
              <p className="hint-inline">Route: /feature/{f.id}</p>
            </div>
          ))}
        </MotionCard>
      )}

      {tab === 'menu' && (
        <MotionCard interactive={false} className="mt-card">
          <div className="card-head">
            <h2>
              <ImagePlus size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
              Customer menu photos
            </h2>
          </div>
          <p className="hint-inline" style={{ marginTop: 8 }}>
            Photos show on the public <code>/order</code> page. Upload a JPG/PNG — we compress it
            for sync. Stay online while uploading. If the top banner says “offline changes
            waiting”, tap <strong>Sync now</strong>, then refresh <code>/order</code>.
          </p>
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className="btn"
              disabled={pushBusy}
              onClick={() => {
                setPushBusy(true)
                setError(null)
                void pushMenuPhotosToCloud()
                  .then(() =>
                    setOk(
                      'Photos pushed to cloud. Open Preview customer page and tap Refresh.',
                    ),
                  )
                  .catch((e) =>
                    setError(e instanceof Error ? e.message : 'Could not push photos'),
                  )
                  .finally(() => setPushBusy(false))
              }}
            >
              {pushBusy ? 'Pushing…' : 'Push photos to /order now'}
            </button>
            <a
              className="btn ghost"
              href="/order?preview=1"
              target="_blank"
              rel="noreferrer"
            >
              Preview customer page ↗
            </a>
          </div>
          <input
            ref={menuImgRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void onMenuImgFile(e.target.files?.[0] || null)}
          />
          <div className="studio-menu-photos" style={{ marginTop: 14 }}>
            {menu
              .filter((m) => !m.hidden)
              .map((m) => (
                <div key={m.id} className="studio-menu-photo-row">
                  <div className="studio-menu-photo-thumb">
                    {m.imageUrl ? (
                      <img src={m.imageUrl} alt="" />
                    ) : (
                      <span className="hint-inline">No photo</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{m.name}</strong>
                    <div className="hint-inline">{m.kind === 'combo' ? 'Combo' : 'Single'}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn"
                        disabled={menuImgBusy === m.id}
                        onClick={() => {
                          setMenuImgTarget(m.id)
                          menuImgRef.current?.click()
                        }}
                      >
                        {menuImgBusy === m.id ? '…' : m.imageUrl ? 'Replace photo' : 'Upload photo'}
                      </button>
                      {m.imageUrl && (
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            void setMenuImageUrl(m.id, '')
                              .then(() => setOk(`Cleared photo for ${m.name}.`))
                              .catch((e) =>
                                setError(e instanceof Error ? e.message : 'Clear failed'),
                              )
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </MotionCard>
      )}

      {tab === 'tools' && (
        <>
          <MotionCard interactive={false} className="mt-card">
            <div className="card-head">
              <h2>
                <MapPin size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                Exact map pins
              </h2>
            </div>
            <p className="hint-inline" style={{ marginTop: 8 }}>
              Drives the public “Find our stall” map on /order. Street address or lat,lng (e.g.
              51.256,7.151). Blank = use the event Location field.
            </p>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {stallEvents.length === 0 && (
                <p className="hint-inline">No events yet — add stalls in Events or upload Excel.</p>
              )}
              {stallEvents.map((e) => (
                <div
                  key={e.id}
                  className="filters"
                  style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.5rem' }}
                >
                  <div className="field" style={{ flex: '1 1 160px', minWidth: 140 }}>
                    <label>
                      {e.id} · {e.name}
                    </label>
                    <span className="hint-inline">{e.location}</span>
                  </div>
                  <div className="field" style={{ flex: '2 1 220px', minWidth: 180 }}>
                    <label>Map pin</label>
                    <input
                      value={pinDrafts[e.id] ?? ''}
                      onChange={(ev) =>
                        setPinDrafts((d) => ({ ...d, [e.id]: ev.target.value }))
                      }
                      placeholder="Street + city or 51.256,7.151"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setEventMapsQuery(e.id, pinDrafts[e.id] ?? '')
                      setOk(`Saved pin for ${e.id}`)
                    }}
                  >
                    <Save size={14} /> Save pin
                  </button>
                </div>
              ))}
            </div>
          </MotionCard>

          <MotionCard interactive={false} className="mt-card">
            <div className="card-head">
              <h2>
                <QrCode size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                PayPal QR
              </h2>
            </div>
            <p className="hint-inline" style={{ marginTop: 8 }}>
              Used on Orders → Delivered → PayPal for the whole team. After upload, tap Sync
              (top bar) so every device gets the new QR — older cloud copies can no longer
              overwrite a newer upload.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: 12 }}>
              <img
                src={resolvePaypalQrSrc(paypalQrDataUrl, 160)}
                alt="PayPal QR"
                width={160}
                height={160}
                style={{ borderRadius: 12, border: '1px solid var(--border)', background: '#fff' }}
              />
              <div>
                <div className="hint-inline" style={{ marginBottom: 8 }}>
                  {paypalQrDataUrl ? 'Using uploaded QR' : `Fallback: ${getPaypalMeUrl()}`}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => void onQrFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={qrBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  {qrBusy ? 'Uploading…' : 'Upload QR'}
                </button>
                {paypalQrDataUrl && (
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ marginLeft: 8 }}
                    onClick={() => {
                      setPaypalQrDataUrl('')
                      setOk('Cleared uploaded QR.')
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </MotionCard>

          <MotionCard interactive={false} className="mt-card">
            <div className="card-head">
              <h2>
                <Mail size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                Notification emails
              </h2>
            </div>
            <p className="hint-inline" style={{ marginTop: 8 }}>
              To-do reminders. Fallback: {PASSWORD_HELP_EMAIL}
            </p>
            <div className="filters" style={{ marginTop: 12, flexDirection: 'column', alignItems: 'stretch' }}>
              {TEAM_NAMES.map((name) => (
                <div className="field" key={name}>
                  <label>{name}</label>
                  <input
                    type="email"
                    value={emailDraft[name]}
                    onChange={(e) => setEmailDraft((d) => ({ ...d, [name]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <button type="button" className="btn" style={{ marginTop: 10 }} onClick={saveEmails}>
              Save emails
            </button>
          </MotionCard>

          <div style={{ marginTop: '1rem' }}>
            <ReviewFormEditor />
          </div>
          <p className="hint-inline" style={{ marginTop: 8 }}>
            Signed in as {user?.name}. Site-wide saves use “Save for everyone” above; review chips
            have their own Save button.
          </p>
        </>
      )}
    </>
  )
}
