import { motion, useReducedMotion } from 'framer-motion'
import { springSnappy } from '../lib/motion'

export function QtyPop({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      key={value}
      className={className}
      aria-live="polite"
      initial={reduce ? false : { scale: 1.32 }}
      animate={{ scale: 1 }}
      transition={springSnappy}
    >
      {value}
    </motion.span>
  )
}
