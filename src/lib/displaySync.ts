/** Sync POS state to the customer-facing second screen. */

export type DisplayPhase = 'idle' | 'ordering' | 'waiting' | 'ready'

export interface PosDisplayState {
  phase: DisplayPhase
  total: number
  ticketLabel: string
  ticketNumber: number | null
  lineSummary: string
  updatedAt: number
}

const CHANNEL = 'nasta-pos-display'
const STORAGE_KEY = 'nasta-pos-display-v1'

export const EMPTY_DISPLAY: PosDisplayState = {
  phase: 'idle',
  total: 0,
  ticketLabel: '',
  ticketNumber: null,
  lineSummary: '',
  updatedAt: 0,
}

export function publishDisplay(state: Omit<PosDisplayState, 'updatedAt'>): void {
  const full: PosDisplayState = { ...state, updatedAt: Date.now() }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(full))
  } catch {
    /* ignore */
  }
  try {
    const bc = new BroadcastChannel(CHANNEL)
    bc.postMessage(full)
    bc.close()
  } catch {
    /* ignore */
  }
}

export function readDisplay(): PosDisplayState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_DISPLAY
    return { ...EMPTY_DISPLAY, ...(JSON.parse(raw) as PosDisplayState) }
  } catch {
    return EMPTY_DISPLAY
  }
}

export function subscribeDisplay(onChange: (s: PosDisplayState) => void): () => void {
  onChange(readDisplay())
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange(readDisplay())
  }
  window.addEventListener('storage', onStorage)
  let bc: BroadcastChannel | null = null
  try {
    bc = new BroadcastChannel(CHANNEL)
    bc.onmessage = (ev) => {
      if (ev.data && typeof ev.data === 'object') onChange(ev.data as PosDisplayState)
    }
  } catch {
    /* ignore */
  }
  return () => {
    window.removeEventListener('storage', onStorage)
    bc?.close()
  }
}

export function openCustomerDisplay(): Window | null {
  const url = `${window.location.origin}/display`
  return window.open(url, 'nasta-customer-display', 'noopener,noreferrer')
}
