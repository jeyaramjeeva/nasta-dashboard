import { beforeEach, describe, expect, it } from 'vitest'
import { snapshotHasStallDayToday } from './loginOpenToday'

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
  Object.defineProperty(globalThis, 'sessionStorage', { value: store, configurable: true })
})

function event(partial: {
  id: string
  status: string
  startDate: string
  endDate?: string | null
  days?: number
}) {
  return {
    id: partial.id,
    name: partial.id,
    location: 'Köln',
    status: partial.status,
    startDate: partial.startDate,
    endDate: partial.endDate ?? null,
    days: partial.days ?? 1,
  }
}

describe('snapshotHasStallDayToday', () => {
  it('is true for a confirmed stall that includes today', () => {
    expect(
      snapshotHasStallDayToday(
        {
          events: [event({ id: 'E014', status: 'Confirmed', startDate: '2026-08-20', days: 2 })],
        },
        '2026-08-20',
      ),
    ).toBe(true)
    expect(
      snapshotHasStallDayToday(
        {
          events: [event({ id: 'E014', status: 'Confirmed', startDate: '2026-08-20', days: 2 })],
        },
        '2026-08-21',
      ),
    ).toBe(true)
  })

  it('is false for applied or other days', () => {
    expect(
      snapshotHasStallDayToday(
        {
          events: [event({ id: 'E014', status: 'Applied', startDate: '2026-08-20' })],
        },
        '2026-08-20',
      ),
    ).toBe(false)
    expect(
      snapshotHasStallDayToday(
        {
          events: [event({ id: 'E014', status: 'Confirmed', startDate: '2026-08-22' })],
        },
        '2026-08-20',
      ),
    ).toBe(false)
  })
})
