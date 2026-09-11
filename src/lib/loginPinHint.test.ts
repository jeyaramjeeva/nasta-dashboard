import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { accountPinHint, rememberAccountPinHint } from './loginPin'

const HINT_KEY = 'nasta-login-pin-hint-v1'
const STORE_KEY = 'nasta-login-pins-v1'

beforeEach(() => {
  const mem = new Map<string, string>()
  const store = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      mem.set(k, String(v))
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true })
})

afterEach(() => {
  localStorage.removeItem(HINT_KEY)
  localStorage.removeItem(STORE_KEY)
})

describe('accountPinHint', () => {
  it('is unknown until this device has seen the account', () => {
    expect(accountPinHint('jeeva@nastazentrum.de')).toBeNull()
  })

  it('remembers PIN vs password so login can paint the right field first', () => {
    rememberAccountPinHint('jeeva@nastazentrum.de', true)
    rememberAccountPinHint('guest@nastazentrum.de', false)
    expect(accountPinHint('jeeva@nastazentrum.de')).toBe(true)
    expect(accountPinHint('guest@nastazentrum.de')).toBe(false)
  })

  it('treats a local PIN vault as a positive hint', () => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        'sriram@nastazentrum.de': { encPassword: 'x', salt: 's', pinHash: 'h', iv: 'i', updatedAt: '' },
      }),
    )
    expect(accountPinHint('sriram@nastazentrum.de')).toBe(true)
  })
})
