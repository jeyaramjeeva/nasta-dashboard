/** Event-day / data-saver: fewer cloud downloads of the large stall_ops blob. */

import { isStallMode } from './stallMode'

const KEY = 'nasta-data-saver-v1'
export const DATA_SAVER_EVENT = 'nasta-data-saver'

export function isDataSaverOn(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Manual toggle OR Stall mode (event POS) — both use slow sync. */
export function isEffectiveDataSaver(): boolean {
  return isDataSaverOn() || isStallMode()
}

export function setDataSaver(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(DATA_SAVER_EVENT))
}

/** Poll intervals for full stall_ops sync (includes base64 menu photos). */
export function stallOpsPollMs(kind: 'orders' | 'chat-open' | 'chat-closed'): number {
  const saver = isEffectiveDataSaver()
  if (kind === 'orders') return saver ? 45_000 : 25_000
  if (kind === 'chat-open') return saver ? 40_000 : 20_000
  return saver ? 120_000 : 60_000
}

export function isTabVisible(): boolean {
  return typeof document === 'undefined' || !document.hidden
}
