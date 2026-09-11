/** Stall focus — Calendar, Stock & Orders while someone runs POS. */

import { idleEnterMs, idleRelockMs, loadLocalSiteConfig } from './siteConfig'

export const STALL_MODE_KEY = 'nasta-stall-mode'
/** Set after Unlock so stall-day auto-enter does not immediately lock again this tab. */
export const STALL_UNLOCKED_KEY = 'nasta-stall-unlocked'
/** Short PIN to unlock money pages — overridable in Developer Studio. */
export const STALL_UNLOCK_PIN = '9987'
/** Idle on Orders → auto Stall mode (ms). Defaults; live values from site config. */
export const STALL_IDLE_ENTER_MS = 15 * 60 * 1000
/** After unlock, idle anywhere → auto re-lock Stall mode (ms). */
export const STALL_IDLE_RELOCK_MS = 15 * 60 * 1000

export function getStallUnlockPin(): string {
  try {
    return loadLocalSiteConfig().settings.unlockPin || STALL_UNLOCK_PIN
  } catch {
    return STALL_UNLOCK_PIN
  }
}

export function getStallIdleEnterMs(): number {
  try {
    return idleEnterMs(loadLocalSiteConfig().settings)
  } catch {
    return STALL_IDLE_ENTER_MS
  }
}

export function getStallIdleRelockMs(): number {
  try {
    return idleRelockMs(loadLocalSiteConfig().settings)
  } catch {
    return STALL_IDLE_RELOCK_MS
  }
}

const MONEY_PATHS = [
  '/',
  '/events',
  '/partners',
  '/cash',
  '/money',
  '/insights',
  '/goals',
  '/upload',
  '/quick-add',
  '/plates',
  '/account',
  '/ai-code',
  '/studio',
] as const

export function isStallMode(): boolean {
  try {
    return sessionStorage.getItem(STALL_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export function isStallUnlockedSession(): boolean {
  try {
    return sessionStorage.getItem(STALL_UNLOCKED_KEY) === '1'
  } catch {
    return false
  }
}

export function setStallMode(on: boolean) {
  try {
    if (on) sessionStorage.setItem(STALL_MODE_KEY, '1')
    else sessionStorage.removeItem(STALL_MODE_KEY)
  } catch {
    /* ignore */
  }
}

export function enterStallMode() {
  try {
    sessionStorage.removeItem(STALL_UNLOCKED_KEY)
  } catch {
    /* ignore */
  }
  setStallMode(true)
}

export function exitStallMode() {
  setStallMode(false)
  try {
    sessionStorage.setItem(STALL_UNLOCKED_KEY, '1')
  } catch {
    /* ignore */
  }
}

/** Sign-out: next login can auto-enter stall on a stall day. */
export function resetStallSession() {
  try {
    sessionStorage.removeItem(STALL_MODE_KEY)
    sessionStorage.removeItem(STALL_UNLOCKED_KEY)
  } catch {
    /* ignore */
  }
}

export function checkStallUnlockPin(pin: string): boolean {
  return pin.trim() === getStallUnlockPin()
}

/** @deprecated use checkStallUnlockPin */
export function checkStallUnlockPassword(password: string): boolean {
  return checkStallUnlockPin(password)
}

/** Paths that show sales / P&L / partner money — blocked in stall mode. */
export function isMoneyPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/') return true
  return MONEY_PATHS.some((m) => m !== '/' && (p === m || p.startsWith(`${m}/`)))
}

/** Sidebar routes still allowed while stall mode is on. */
export function isStallAllowedPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return (
    p === '/orders' ||
    p.startsWith('/orders/') ||
    p === '/kitchen' ||
    p.startsWith('/kitchen/') ||
    p === '/plan' ||
    p.startsWith('/plan/') ||
    p === '/learn' ||
    p.startsWith('/learn/') ||
    p === '/stock' ||
    p.startsWith('/stock/') ||
    p === '/food' ||
    p.startsWith('/food/') ||
    p === '/cards' ||
    p.startsWith('/cards/') ||
    p === '/todos' ||
    p.startsWith('/todos/') ||
    p === '/feature' ||
    p.startsWith('/feature/') ||
    p === '/calendar' ||
    p.startsWith('/calendar/') ||
    p === '/display' ||
    p.startsWith('/display/') ||
    p === '/playground' ||
    p.startsWith('/playground/') ||
    p === '/ai-helper' ||
    p.startsWith('/ai-helper/')
  )
}
