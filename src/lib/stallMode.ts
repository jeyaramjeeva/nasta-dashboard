/** Stall focus — hide money screens while a helper runs POS on a shared login. */

export const STALL_MODE_KEY = 'nasta-stall-mode'
/** Short 4-digit PIN to unlock money pages (not the Excel publish password). */
export const STALL_UNLOCK_PIN = '9987'
/** Idle on Orders → auto Stall mode (ms). */
export const STALL_IDLE_ENTER_MS = 2 * 60 * 1000
/** After unlock, idle anywhere → auto re-lock Stall mode (ms). */
export const STALL_IDLE_RELOCK_MS = 2 * 60 * 1000

const MONEY_PATHS = [
  '/',
  '/events',
  '/partners',
  '/cash',
  '/insights',
  '/upload',
  '/quick-add',
  '/playground',
  '/plates',
  '/account',
] as const

export function isStallMode(): boolean {
  try {
    return sessionStorage.getItem(STALL_MODE_KEY) === '1'
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
  setStallMode(true)
}

export function exitStallMode() {
  setStallMode(false)
}

export function checkStallUnlockPin(pin: string): boolean {
  return pin.trim() === STALL_UNLOCK_PIN
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
    p === '/stock' ||
    p.startsWith('/stock/') ||
    p === '/calendar' ||
    p.startsWith('/calendar/')
  )
}
