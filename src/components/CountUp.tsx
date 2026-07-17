import { useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

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
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    if (reduce) {
      setDisplay(value)
      return
    }

    let raf = 0
    const from = 0
    const to = value
    const start = performance.now()
    const ms = duration * 1000

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      // easeOut cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
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
