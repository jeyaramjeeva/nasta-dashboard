import { useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

export function CountUp({
  value,
  duration = 0.85,
  format,
  className,
}: {
  value: number
  duration?: number
  format?: (n: number) => string
  className?: string
}) {
  const reduce = useReducedMotion()
  const fromRef = useRef(reduce ? value : 0)
  const displayRef = useRef(reduce ? value : 0)
  const [display, setDisplay] = useState(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      fromRef.current = value
      displayRef.current = value
      setDisplay(value)
      return
    }

    const from = fromRef.current
    const to = value
    if (from === to) {
      setDisplay(to)
      displayRef.current = to
      return
    }

    let raf = 0
    const start = performance.now()
    const ms = duration * 1000

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = from + (to - from) * eased
      displayRef.current = next
      setDisplay(next)
      if (t < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = to
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      fromRef.current = displayRef.current
    }
  }, [value, duration, reduce])

  const text = format
    ? format(display)
    : new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 2,
      }).format(display)

  return <span className={className}>{text}</span>
}
