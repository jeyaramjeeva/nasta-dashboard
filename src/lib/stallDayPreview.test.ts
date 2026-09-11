import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { armPreviewStallDay, isPreviewStallDayActive, previewStallDayLabel } from './stallDayPreview'
import { snapshotHasStallDayToday } from './loginOpenToday'

function memoryStore() {
  const mem = new Map<string, string>()
  return {
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
}

beforeEach(() => {
  const store = memoryStore()
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true })
  Object.defineProperty(globalThis, 'sessionStorage', { value: store, configurable: true })
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-20T10:50:00+02:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('dummy stall day preview', () => {
  it('makes today a stall day for 5 minutes', () => {
    expect(isPreviewStallDayActive()).toBe(false)
    armPreviewStallDay(5 * 60 * 1000)
    expect(isPreviewStallDayActive()).toBe(true)
    expect(snapshotHasStallDayToday({ events: [] })).toBe(true)
    expect(previewStallDayLabel()).toMatch(/Dummy stall day/)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(isPreviewStallDayActive()).toBe(false)
    expect(snapshotHasStallDayToday({ events: [] })).toBe(false)
  })
})
