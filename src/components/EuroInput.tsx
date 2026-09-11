import { useEffect, useRef, useState } from 'react'
import { formatEuroField, isEuroFieldTyping, parseEuroField } from '../lib/euroAmount'

/** Decimal-safe € input — does not snap "3." back to "3" while typing. */
export function EuroInput({
  id,
  value,
  onChange,
  min = 0,
  step = 0.5,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  id?: string
  value: number
  onChange: (next: number) => void
  min?: number
  step?: number
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  const [text, setText] = useState(() => formatEuroField(value))
  const focused = useRef(false)

  useEffect(() => {
    if (focused.current) return
    setText(formatEuroField(value))
  }, [value])

  return (
    <input
      id={id}
      className={className}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      aria-label={ariaLabel}
      value={text}
      onFocus={() => {
        focused.current = true
      }}
      onBlur={() => {
        focused.current = false
        const n = Math.max(min, parseEuroField(text))
        setText(formatEuroField(n))
        onChange(n)
      }}
      onChange={(e) => {
        const raw = e.target.value
        if (!isEuroFieldTyping(raw)) return
        setText(raw)
        if (raw === '' || raw.endsWith('.') || raw.endsWith(',')) return
        onChange(Math.max(min, parseEuroField(raw)))
      }}
      data-step={step}
    />
  )
}
