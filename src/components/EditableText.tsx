import { EyeOff, Pencil, RotateCcw, Trash2, X } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react'
import { useEditUi } from '../context/EditUiContext'
import { useSiteConfig } from '../context/SiteConfigContext'
import type { SiteInlineEdit } from '../lib/siteConfig'

const SIZE_OPTIONS = [
  { value: '', label: 'Default' },
  { value: '0.8rem', label: 'XS' },
  { value: '0.9rem', label: 'S' },
  { value: '1rem', label: 'M' },
  { value: '1.15rem', label: 'L' },
  { value: '1.35rem', label: 'XL' },
  { value: '1.6rem', label: '2XL' },
  { value: '1.85rem', label: '3XL' },
]

const FONT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: '"Trebuchet MS", "Segoe UI", sans-serif', label: 'Trebuchet' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Georgia' },
  { value: '"Palatino Linotype", Palatino, serif', label: 'Palatino' },
  { value: '"Segoe UI", system-ui, sans-serif', label: 'Segoe UI' },
  { value: 'ui-monospace, Consolas, monospace', label: 'Mono' },
]

type EditableAs = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'th' | 'label' | 'strong' | 'div'

/** Render as the real element (not wrapped in a span) so headings/tables keep layout. */
const BLOCK_AS = new Set<EditableAs>(['h1', 'h2', 'h3', 'p', 'div', 'th', 'label', 'strong'])

export function EditableText({
  id,
  as = 'span',
  children,
  className,
  defaultText,
  icon,
}: {
  id: string
  as?: EditableAs
  children?: ReactNode
  className?: string
  /** Explicit default string when children is not plain text. */
  defaultText?: string
  icon?: ReactNode
}) {
  const { editUi, canEditUi } = useEditUi()
  const { config, saveInlineEdit } = useSiteConfig()
  const edit = config.inlineEdits[id]
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draftText, setDraftText] = useState('')
  const [draftSize, setDraftSize] = useState('')
  const [draftFont, setDraftFont] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const uid = useId()

  const fallback =
    defaultText ??
    (typeof children === 'string' || typeof children === 'number' ? String(children) : '')

  const displayText =
    edit?.text != null && edit.text !== '' ? edit.text : fallback
  const isGone = Boolean(edit?.hidden || edit?.deleted)

  useEffect(() => {
    if (!open) return
    setDraftText(edit?.text != null && edit.text !== '' ? edit.text : fallback)
    setDraftSize(edit?.fontSize || '')
    setDraftFont(edit?.fontFamily || '')
    setErr(null)
  }, [open, edit, fallback])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function apply(patch: SiteInlineEdit | null) {
    setBusy(true)
    setErr(null)
    try {
      await saveInlineEdit(id, patch)
      setOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveStyleAndText() {
    const next: SiteInlineEdit = {
      ...(edit || {}),
      text: draftText.trim() === fallback.trim() ? undefined : draftText,
      fontSize: draftSize || undefined,
      fontFamily: draftFont || undefined,
      hidden: edit?.hidden,
      deleted: edit?.deleted,
    }
    if (next.text === undefined) delete next.text
    await apply(next)
  }

  const style: CSSProperties = {}
  if (edit?.fontSize) style.fontSize = edit.fontSize
  if (edit?.fontFamily) style.fontFamily = edit.fontFamily

  const Tag = as as ElementType
  const showPen = canEditUi && editUi
  const blockOuter = BLOCK_AS.has(as)

  if (isGone && !showPen) return null

  const pen = showPen ? (
    <button
      type="button"
      className="editable-text__pen"
      aria-label={`Edit ${id}`}
      title="Edit text"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOpen((v) => !v)
      }}
    >
      <Pencil size={12} />
    </button>
  ) : null

  const panel = open ? (
    <div className="editable-text__panel" ref={panelRef} role="dialog" aria-labelledby={uid}>
      <div className="editable-text__panel-head">
        <strong id={uid}>Edit label</strong>
        <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <div className="hint-inline" style={{ fontSize: 11, marginBottom: 6 }}>
        {id}
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor={`${uid}-text`}>Text</label>
        <textarea
          id={`${uid}-text`}
          rows={3}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
        />
      </div>
      <div className="filters" style={{ marginTop: 8 }}>
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label htmlFor={`${uid}-size`}>Size</label>
          <select
            id={`${uid}-size`}
            value={draftSize}
            onChange={(e) => setDraftSize(e.target.value)}
          >
            {SIZE_OPTIONS.map((o) => (
              <option key={o.value || 'default'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label htmlFor={`${uid}-font`}>Font</label>
          <select
            id={`${uid}-font`}
            value={draftFont}
            onChange={(e) => setDraftFont(e.target.value)}
          >
            {FONT_OPTIONS.map((o) => (
              <option key={o.value || 'default'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {err && (
        <div className="hint-inline" style={{ color: 'var(--danger)', marginTop: 6 }}>
          {err}
        </div>
      )}
      <div className="page-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn" disabled={busy} onClick={() => void saveStyleAndText()}>
          Save
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => void apply({ ...(edit || {}), hidden: true, deleted: false })}
        >
          <EyeOff size={14} /> Hide
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => {
            if (confirm('Delete this label for everyone? You can restore in Studio.')) {
              void apply({ deleted: true, hidden: true })
            }
          }}
        >
          <Trash2 size={14} /> Delete
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => void apply(null)}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  ) : null

  if (blockOuter) {
    if (isGone && showPen) {
      return (
        <Tag
          className={`editable-text editable-text--edit ${className || ''}`.trim()}
          style={style}
        >
          <span className="editable-text__ghost hint-inline">
            Hidden: {fallback.slice(0, 40) || id}
          </span>
          {pen}
          {panel}
        </Tag>
      )
    }
    return (
      <Tag
        className={`editable-text${showPen ? ' editable-text--edit' : ''} ${className || ''}`.trim()}
        style={Object.keys(style).length ? style : undefined}
      >
        {!isGone && (
          <>
            {icon}
            {displayText}
          </>
        )}
        {pen}
        {panel}
      </Tag>
    )
  }

  return (
    <span className={`editable-text${showPen ? ' editable-text--edit' : ''}`}>
      {!isGone && (
        <Tag className={className} style={Object.keys(style).length ? style : undefined}>
          {icon}
          {displayText}
        </Tag>
      )}
      {isGone && showPen && (
        <span className="editable-text__ghost hint-inline">
          Hidden: {fallback.slice(0, 48) || id}
        </span>
      )}
      {pen}
      {panel}
    </span>
  )
}
