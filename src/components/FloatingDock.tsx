import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AiHelperFab } from './AiHelperFab'
import { TeamCommsFab } from './TeamCommsFab'
import { useAuth } from '../context/AuthContext'
import { useStallMode } from '../context/StallModeContext'
import { canUseAiHelper } from '../lib/authAllowlist'
import { isGuestUser } from '../lib/guestAuth'

/** Bottom-right dock: announcements, team chat, AI helper. */
export function FloatingDock() {
  const { user } = useAuth()
  const { isStall } = useStallMode()
  const { pathname } = useLocation()
  const showAi = !isStall && canUseAiHelper(user)
  const showTeam = !isStall && Boolean(user && !isGuestUser(user))
  const [posHidden, setPosHidden] = useState(
    () => typeof document !== 'undefined' && document.documentElement.dataset.hideFab === '1',
  )

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setPosHidden(root.dataset.hideFab === '1')
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['data-hide-fab'] })
    return () => obs.disconnect()
  }, [])

  // Never cover the customer /order storefront (or staff preview).
  const onCustomerOrder = pathname === '/order' || pathname.startsWith('/order/')
  // Stall / event POS: no chat or AI (both poll or add weight).
  if (isStall || (!showAi && !showTeam)) return null
  if (onCustomerOrder || posHidden) return null

  return (
    <div className="fab-dock">
      {showTeam && <TeamCommsFab />}
      {showAi && <AiHelperFab embedded />}
    </div>
  )
}
