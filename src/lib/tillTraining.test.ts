import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildTillTrainingSandbox,
  lastSaturdayYmd,
  pickTillTrainingTarget,
} from './tillTraining'
import { emptyStallOps, type StallOpsState } from './stallOps'

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
})

function liveWithSaturdaySale(): StallOpsState {
  const base = emptyStallOps()
  const sat = '2026-08-15T12:00:00.000Z'
  return {
    ...base,
    eventMenus: {
      Flohmarkt: [
        { id: 'masala-chai', name: 'Masala chai', kind: 'single', price: 2 },
        { id: 'mango-lassi', name: 'Mango lassi', kind: 'single', price: 3.5 },
      ],
    },
    eventBook: {
      extras: [
        {
          id: 'E014',
          name: 'Wuppertal Flohmarkt',
          location: 'Wuppertal',
          startDate: '2026-08-15',
          endDate: '2026-08-15',
          month: '2026-08',
          days: 1,
          fee: 0,
          status: 'Confirmed',
        },
      ],
      patches: {},
    },
    orders: [
      {
        id: 'real-1',
        label: 'Customer 9',
        status: 'completed',
        lines: [{ menuItemId: 'masala-chai', name: 'Masala chai', price: 2, qty: 7 }],
        createdAt: sat,
        completedAt: sat,
        eventId: 'E014',
        payMethod: 'cash',
        paid: 14,
      },
    ],
  }
}

describe('till training sandbox', () => {
  it('uses last Saturday, not today, when today is a Saturday', () => {
    expect(lastSaturdayYmd(new Date('2026-08-22T10:00:00+02:00'))).toBe('2026-08-15')
    expect(lastSaturdayYmd(new Date('2026-08-20T10:00:00+02:00'))).toBe('2026-08-15')
  })

  it('picks last Saturday’s busiest stall and clones its menu into fake tickets', () => {
    const live = liveWithSaturdaySale()
    const now = new Date('2026-08-20T11:00:00+02:00')
    const target = pickTillTrainingTarget(live, now)
    expect(target).toEqual({ eventId: 'E014', dayYmd: '2026-08-15', usedLastSaturday: true })
    const { state, meta } = buildTillTrainingSandbox(live, now)
    expect(meta.eventId).toBe('E014')
    expect(state.activeEventId).toBe('E014')
    expect(state.orders.every((o) => o.id.startsWith('train-'))).toBe(true)
    expect(state.orders.some((o) => o.id === 'real-1')).toBe(false)
    expect(state.orders.length).toBeGreaterThanOrEqual(1)
    expect(state.orders[0]?.lines[0]?.menuItemId).toBe('masala-chai')
    expect(state.eventMenus?.Flohmarkt?.some((m) => m.id === 'masala-chai')).toBe(true)
  })
})
