import { beforeEach, describe, expect, it } from 'vitest'
import { euroAmountDe } from './euroDeWords'
import { sameDayPeerEvents } from './sameDayPeerEvents'
import type { StallOrder } from './stallOps'

describe('euroAmountDe', () => {
  it('reads typical stall totals the way staff would say them', () => {
    expect(euroAmountDe(12.5)).toBe('Zwölf Euro fünfzig')
    expect(euroAmountDe(1)).toBe('Ein Euro')
    expect(euroAmountDe(2)).toBe('Zwei Euro')
    expect(euroAmountDe(3.5)).toBe('Drei Euro fünfzig')
    expect(euroAmountDe(0.8)).toBe('Achtzig Cent')
    expect(euroAmountDe(21)).toBe('Einundzwanzig Euro')
    expect(euroAmountDe(0)).toBe('Null Euro')
  })
})

describe('sameDayPeerEvents', () => {
  beforeEach(() => {
    /* no storage */
  })

  it('summarizes the other stall on the same Germany day', () => {
    const orders: StallOrder[] = [
      {
        id: 'a',
        label: 'Customer 1',
        status: 'completed',
        lines: [{ menuItemId: 'chai', name: 'Masala chai', price: 2, qty: 2 }],
        createdAt: '2026-08-20T10:00:00.000Z',
        completedAt: '2026-08-20T10:05:00.000Z',
        eventId: 'E014',
      },
      {
        id: 'b',
        label: 'Customer 1',
        status: 'completed',
        lines: [{ menuItemId: 'lassi', name: 'Mango lassi', price: 3.5, qty: 2 }],
        createdAt: '2026-08-20T10:01:00.000Z',
        completedAt: '2026-08-20T10:06:00.000Z',
        eventId: 'E013',
      },
    ]
    const peers = sameDayPeerEvents({
      events: [
        { id: 'E014', name: 'Flohmarkt', location: 'Wuppertal', startDate: '2026-08-20', days: 1 },
        { id: 'E013', name: 'Gourmet', location: 'Düsseldorf', startDate: '2026-08-20', days: 1 },
      ],
      orders,
      activeEventId: 'E014',
      todayYmd: '2026-08-20',
    })
    expect(peers).toHaveLength(1)
    expect(peers[0]?.eventId).toBe('E013')
    expect(peers[0]?.paidCount).toBe(1)
    expect(peers[0]?.revenue).toBe(7)
  })
})
