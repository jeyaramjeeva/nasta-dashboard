import { describe, expect, it } from 'vitest'
import { isCoreIndian, VENUES } from './marketAnalysis'
import { buildKpis } from './marketKpis'

describe('buildKpis', () => {
  it('uses the real venue file and does not invent a census', () => {
    const all = buildKpis('All')
    expect(all.total).toBe(VENUES.filter(isCoreIndian).length)
    expect(all.koeln + all.bonn).toBe(all.total)
    expect(all.closed).toBeGreaterThanOrEqual(2)
    expect(all.avgRating).not.toBeNull()
    expect(all.totalReviews).toBeGreaterThan(1000)
  })
})
