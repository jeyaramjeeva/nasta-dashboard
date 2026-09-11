import { useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'

/** Soft background wash; glow follows the pointer without React re-renders. */
export function AmbientBackground() {
  const reduce = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduce) return
    const el = rootRef.current
    if (!el) return
    let raf = 0
    let x = 50
    let y = 30
    const onMove = (e: PointerEvent) => {
      if (document.documentElement.classList.contains('is-scrolling')) return
      x = (e.clientX / window.innerWidth) * 100
      y = (e.clientY / window.innerHeight) * 100
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        el.style.setProperty('--mx', `${x}%`)
        el.style.setProperty('--my', `${y}%`)
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [reduce])

  return (
    <div ref={rootRef} className={`ambient${reduce ? ' is-static' : ''}`} aria-hidden>
      <div className="ambient__noise" />
      <div className="ambient__spot" />
      {!reduce && (
        <>
          <div className="ambient__blob ambient__blob--a" />
          <div className="ambient__blob ambient__blob--b" />
        </>
      )}
    </div>
  )
}
