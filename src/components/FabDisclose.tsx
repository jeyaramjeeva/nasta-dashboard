import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { springSoft } from '../lib/motion'

export function FabDisclose({
  open,
  className,
  children,
  labelledBy,
}: {
  open: boolean
  className?: string
  children: ReactNode
  labelledBy?: string
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={className}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          initial={{ opacity: 0, scale: 0.84, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 10 }}
          transition={springSoft}
          style={{ transformOrigin: 'bottom right' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
