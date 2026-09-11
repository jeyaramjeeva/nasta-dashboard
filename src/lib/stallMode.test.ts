import { beforeEach, describe, expect, it } from 'vitest'
import {
  enterStallMode,
  exitStallMode,
  isStallMode,
  isStallUnlockedSession,
  resetStallSession,
} from './stallMode'

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
  Object.defineProperty(globalThis, 'sessionStorage', { value: store, configurable: true })
})

describe('stall session flags', () => {
  it('marks unlock so stall-day auto-enter can skip this tab', () => {
    enterStallMode()
    expect(isStallMode()).toBe(true)
    expect(isStallUnlockedSession()).toBe(false)
    exitStallMode()
    expect(isStallMode()).toBe(false)
    expect(isStallUnlockedSession()).toBe(true)
    enterStallMode()
    expect(isStallUnlockedSession()).toBe(false)
  })

  it('clears both flags on sign-out reset', () => {
    enterStallMode()
    exitStallMode()
    resetStallSession()
    expect(isStallMode()).toBe(false)
    expect(isStallUnlockedSession()).toBe(false)
  })
})
