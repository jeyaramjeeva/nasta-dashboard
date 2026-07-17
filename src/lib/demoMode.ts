/** Demo / playground mode — isolated storage, no live cloud writes. */

export const DEMO_MODE_KEY = 'nasta-demo-mode'

export function isDemoMode(): boolean {
  try {
    return sessionStorage.getItem(DEMO_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export function setDemoMode(on: boolean) {
  try {
    if (on) sessionStorage.setItem(DEMO_MODE_KEY, '1')
    else sessionStorage.removeItem(DEMO_MODE_KEY)
  } catch {
    /* ignore */
  }
}

/** Prefix localStorage keys so demo never touches live keys. */
export function demoStorageKey(liveKey: string): string {
  return isDemoMode() ? `nasta-demo:${liveKey}` : liveKey
}

const DEMO_PREFIX = 'nasta-demo:'

/** Wipe all demo-only localStorage keys and leave live data alone. */
export function clearDemoStorage() {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(DEMO_PREFIX)) keys.push(k)
  }
  for (const k of keys) localStorage.removeItem(k)
}

export function enterDemoMode() {
  clearDemoStorage()
  setDemoMode(true)
  window.location.assign('/playground')
}

export function exitDemoMode() {
  clearDemoStorage()
  setDemoMode(false)
  window.location.assign('/')
}

export function resetDemoSandbox() {
  clearDemoStorage()
  window.location.reload()
}
