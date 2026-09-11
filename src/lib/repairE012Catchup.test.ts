import { describe, expect, it } from 'vitest'
import { repairE012Catchup, stampTakenPlus5 } from '../../api/_lib/repairE012Catchup'
import { stampCompletedAt } from './stallOps'

describe('repairE012Catchup', () => {
  it('completes pending E012 tickets only and leaves other stalls and catalogs alone', () => {
    const taken = '2026-08-16T10:20:00.000Z'
    const { next, summary } = repairE012Catchup(
      {
        orders: [
          {
            id: 'ord-16',
            eventId: 'E012',
            status: 'pending',
            createdAt: taken,
            lines: [
              { menuItemId: 'plain-dosa', name: 'Plain dosa', price: 7, qty: 1 },
              { menuItemId: 'mango-lassi', name: 'Mango lassi', price: 3.5, qty: 1 },
            ],
          },
          {
            id: 'ord-other',
            eventId: 'E013',
            status: 'pending',
            createdAt: taken,
            lines: [{ menuItemId: 'mango-lassi', price: 3.5, qty: 1 }],
          },
        ],
        eventMenus: {
          Flohmarkt: [
            { id: 'masala-dosa', price: 8 },
            { id: 'mango-lassi', price: 3.5 },
          ],
          Gourmet: [{ id: 'masala-dosa', price: 9 }],
        },
        eventPrices: {
          Flohmarkt: { 'masala-dosa': { price: 8 } },
          Gourmet: { 'masala-dosa': { price: 9 } },
        },
      },
      new Date('2026-08-18T13:00:00.000Z'),
    )
    const ticket = next.orders?.find((o) => o.id === 'ord-16')
    expect(ticket?.status).toBe('completed')
    expect(ticket?.completedAt).toBe(stampTakenPlus5(taken))
    expect(ticket?.lines?.find((l) => l.menuItemId === 'mango-lassi')?.price).toBe(3)
    expect(next.orders?.find((o) => o.id === 'ord-other')?.status).toBe('pending')
    expect(next.orders?.find((o) => o.id === 'ord-other')?.lines?.[0]?.price).toBe(3.5)
    expect(summary.completedNow).toBe(1)
    expect(summary.catalogTouched).toBe(false)
    expect(next.eventMenus?.Flohmarkt?.find((m) => m.id === 'masala-dosa')?.price).toBe(8)
    expect(next.eventMenus?.Gourmet?.find((m) => m.id === 'masala-dosa')?.price).toBe(9)
    expect(next.e012CatchupV1).toBeTruthy()
  })

  it('does not run again after the one-shot flag is stored', () => {
    const { next, summary } = repairE012Catchup({
      e012CatchupV1: '2026-08-18T14:00:00.000Z',
      orders: [
        {
          id: 'ord-new',
          eventId: 'E012',
          status: 'pending',
          createdAt: '2026-08-18T12:00:00.000Z',
          lines: [{ menuItemId: 'mango-lassi', price: 3.5, qty: 1 }],
        },
      ],
    })
    expect(summary.skipped).toBe(true)
    expect(summary.changed).toBe(false)
    expect(next.orders?.[0]?.status).toBe('pending')
  })

  it('rewrites a sold E012 ticket whose delivery day is not the taken day', () => {
    const taken = '2026-08-16T10:30:00.000Z'
    const { next, summary } = repairE012Catchup({
      orders: [
        {
          id: 'ord-17',
          eventId: 'E012',
          status: 'completed',
          createdAt: taken,
          completedAt: '2026-08-18T13:01:00.000Z',
          paid: 10.5,
          payMethod: 'cash',
          lines: [
            { menuItemId: 'plain-dosa', price: 7, qty: 1 },
            { menuItemId: 'mango-lassi', price: 3.5, qty: 1 },
          ],
        },
      ],
    })
    const ticket = next.orders?.[0]
    expect(ticket?.completedAt).toBe(stampTakenPlus5(taken))
    expect(ticket?.paid).toBe(10)
    expect(summary.stampsFixed).toBe(1)
  })
})

describe('stampCompletedAt for later stalls', () => {
  it('keeps the real tap time on the same Germany day even after 3 hours', () => {
    const taken = '2026-08-22T07:00:00.000Z'
    const now = new Date('2026-08-22T10:30:00.000Z')
    expect(stampCompletedAt(taken, now)).toBe(now.toISOString())
  })

  it('uses taken + 5 minutes only when closing a ticket on a later Germany day', () => {
    const taken = '2026-08-16T10:20:00.000Z'
    const now = new Date('2026-08-18T13:00:00.000Z')
    expect(stampCompletedAt(taken, now)).toBe('2026-08-16T10:25:00.000Z')
  })
})
