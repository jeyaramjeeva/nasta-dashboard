import { beforeEach, describe, expect, it } from 'vitest'
import {
  eventTypeKey,
  extractEventType,
  isEventIdKey,
  listEventTypes,
  mergeEventMenuState,
  mergeEventPriceMaps,
  priceKeyForEvent,
  rehomeEventIdMenuState,
  stampCompletedAt,
  type MenuItem,
} from './stallOps'

function dish(id: string, price: number): MenuItem {
  return { id, name: id, kind: 'single', price }
}

const EVENTS = [
  { id: 'E012', name: 'Wilhelmplatz Flohmarkt', location: 'Köln' },
  { id: 'E013', name: 'Düsseldorf Gourmet', location: 'Düsseldorf' },
  { id: 'E014', name: 'Wuppertal Flohmarkt', location: 'Wuppertal' },
  { id: 'E015', name: 'Bad Godesberg Streetfood Festival', location: 'Bonn' },
]

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

describe('event type keys', () => {
  it('treats E012-style stall ids as event ids, not types', () => {
    expect(isEventIdKey('E012')).toBe(true)
    expect(isEventIdKey('e014')).toBe(true)
    expect(isEventIdKey('Flohmarkt')).toBe(false)
    expect(isEventIdKey('Gourmet Festival')).toBe(false)
    expect(isEventIdKey('')).toBe(false)
  })

  it('collapses Gourmet / Streetfood aliases', () => {
    expect(eventTypeKey('Gourmet Festival')).toBe('Gourmet')
    expect(eventTypeKey('gourmet')).toBe('Gourmet')
    expect(eventTypeKey('Street Festival')).toBe('Streetfood Festival')
    expect(eventTypeKey('Flohmarkt')).toBe('Flohmarkt')
    expect(eventTypeKey('')).toBe('')
  })

  it('never uses a stall id as the price key once Excel events exist', () => {
    expect(priceKeyForEvent('E012', EVENTS)).toBe('Flohmarkt')
    expect(priceKeyForEvent('E013', EVENTS)).toBe('Gourmet')
    expect(priceKeyForEvent('E015', EVENTS)).toBe('Streetfood Festival')
  })

  it('does not fall back to E012 while events are still loading', () => {
    expect(priceKeyForEvent('E012', [])).toBe('')
    expect(priceKeyForEvent('', EVENTS)).toBe('')
  })

  it('lists canonical types without stall ids', () => {
    const types = listEventTypes(EVENTS)
    expect(types).toContain('Flohmarkt')
    expect(types).toContain('Gourmet')
    expect(types).toContain('Streetfood Festival')
    expect(types.some((t) => isEventIdKey(t))).toBe(false)
  })

  it('does not treat a raw stall id as an extracted type', () => {
    expect(extractEventType('E012', '', ['Flohmarkt'])).toBe('')
  })
})

describe('rehomeEventIdMenuState', () => {
  it('copies E012 onto Flohmarkt only when Flohmarkt has no catalog yet', () => {
    const next = rehomeEventIdMenuState(
      {
        eventMenus: { E012: [dish('masala-dosa', 8)] },
        eventMenusRev: { E012: 1 },
      },
      EVENTS,
    )
    expect(next.changed).toBe(true)
    expect(next.eventMenus.E012).toBeUndefined()
    expect(next.eventMenus.Flohmarkt?.map((m) => m.price)).toEqual([8])
  })

  it('does not overlay a stale E012 catalog onto an existing Flohmarkt edit', () => {
    const next = rehomeEventIdMenuState(
      {
        eventMenus: {
          E012: [dish('masala-dosa', 8), dish('cheese-masala-dosa', 9)],
          Flohmarkt: [dish('masala-dosa', 7), dish('cheese-masala-dosa', 8)],
        },
        eventMenusRev: { E012: 99, Flohmarkt: 10 },
      },
      EVENTS,
    )
    expect(next.eventMenus.E012).toBeUndefined()
    expect(next.eventMenus.Flohmarkt?.find((m) => m.id === 'masala-dosa')?.price).toBe(7)
    expect(next.eventMenus.Flohmarkt?.find((m) => m.id === 'cheese-masala-dosa')?.price).toBe(8)
    expect(next.eventMenusRev.Flohmarkt).toBe(10)
  })
})

describe('mergeEventMenuState', () => {
  it('keeps the higher-rev catalog so a stale cloud save cannot undo a price', () => {
    const remote = {
      eventMenus: { Flohmarkt: [dish('masala-dosa', 8)] },
      eventMenusRev: { Flohmarkt: 100 },
    }
    const local = {
      eventMenus: { Flohmarkt: [dish('masala-dosa', 7)] },
      eventMenusRev: { Flohmarkt: 200 },
    }
    const merged = mergeEventMenuState(remote, local)
    expect(merged.eventMenus?.Flohmarkt?.[0]?.price).toBe(7)
  })

  it('does not resurrect a locally deleted dish when remote still has it', () => {
    const remote = {
      eventMenus: { Flohmarkt: [dish('plain-dosa', 7), dish('masala-dosa', 8)] },
      eventMenusRev: { Flohmarkt: 1 },
      eventMenuRemovedIds: {},
    }
    const local = {
      eventMenus: { Flohmarkt: [dish('masala-dosa', 8)] },
      eventMenusRev: { Flohmarkt: 2 },
      eventMenuRemovedIds: { Flohmarkt: ['plain-dosa'] },
    }
    const merged = mergeEventMenuState(remote, local)
    expect(merged.eventMenus?.Flohmarkt?.map((m) => m.id)).toEqual(['masala-dosa'])
  })
})

describe('mergeEventPriceMaps', () => {
  it('lets local overrides win on the same field (current sync rule)', () => {
    const merged = mergeEventPriceMaps(
      { Flohmarkt: { 'masala-dosa': { price: 8 } } },
      { Flohmarkt: { 'masala-dosa': { price: 7 } } },
    )
    expect(merged.Flohmarkt?.['masala-dosa']?.price).toBe(7)
  })
})

describe('stampCompletedAt', () => {
  it('keeps the tap time when delivering in the same stall session', () => {
    const taken = '2026-08-18T10:00:00.000Z'
    const now = new Date('2026-08-18T10:08:00.000Z')
    expect(stampCompletedAt(taken, now)).toBe(now.toISOString())
  })

  it('keeps the tap time for a slow same-day stall (over 2 hours)', () => {
    const taken = '2026-08-22T07:00:00.000Z'
    const now = new Date('2026-08-22T10:05:00.000Z')
    expect(stampCompletedAt(taken, now)).toBe(now.toISOString())
  })

  it('uses taken + 5 minutes when closing a ticket on a later Germany day', () => {
    const taken = '2026-08-16T10:20:00.000Z'
    const now = new Date('2026-08-18T13:00:00.000Z')
    expect(stampCompletedAt(taken, now)).toBe('2026-08-16T10:25:00.000Z')
  })
})
