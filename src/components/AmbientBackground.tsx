import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState, type CSSProperties } from 'react'

export function AmbientBackground() {
  const reduce = useReducedMotion()
  const [pos, setPos] = useState({ x: 50, y: 30 })

  useEffect(() => {
    if (reduce) return
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 100
      const y = (e.clientY / window.innerHeight) * 100
      setPos({ x, y })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reduce])

  return (
    <div className="ambient" aria-hidden>
      <div className="ambient__noise" />
      <motion.div
        className="ambient__spot"
        animate={
          reduce
            ? undefined
            : { backgroundPosition: ['0% 0%', '100% 50%', '0% 100%', '0% 0%'] }
        }
        transition={
          reduce ? undefined : { duration: 28, repeat: Infinity, ease: 'linear' }
        }
        style={
          {
            '--mx': `${pos.x}%`,
            '--my': `${pos.y}%`,
          } as CSSProperties
        }
      />
      <div className="ambient__blob ambient__blob--a" />
      <div className="ambient__blob ambient__blob--b" />
    </div>
  )
}
