import { describe, expect, it } from 'vitest'
import { CONCEPTS } from './marketAnalysis'
import {
  conceptScore100,
  generateVerdict,
  marketScoreParts,
  overallOpportunity,
  scoredConcepts,
} from './marketDecision'

describe('marketDecision', () => {
  it('scales concept scores from the nine stored components', () => {
    const c = CONCEPTS[0]
    const parts = [c.demand, c.competition, c.gap, c.priceOpp, c.locationOpp, c.sentiment, c.differentiation, c.ops, c.finance]
    const mean = parts.reduce((s, n) => s + n, 0) / parts.length
    expect(conceptScore100(c)).toBe(Math.round(mean * 10))
  })

  it('ranks South Indian vegetarian fast-casual first', () => {
    expect(scoredConcepts()[0].id).toBe('south-veg-fast')
    expect(scoredConcepts().at(-1)?.id).toBe('vegan-indian')
  })

  it('does not invent a score when a part is missing prices in an empty sense', () => {
    const parts = marketScoreParts('All')
    expect(parts.every((p) => p.score == null || (p.score >= 0 && p.score <= 100))).toBe(true)
    const o = overallOpportunity('All')
    expect(o.score == null || (o.score >= 0 && o.score <= 100)).toBe(true)
    expect(o.confidence).not.toBe('High')
    expect(o.missing.some((m) => /growth/i.test(m))).toBe(true)
  })

  it('builds the verdict from counts instead of a fixed sentence', () => {
    const all = generateVerdict('All')
    const köln = generateVerdict('Köln')
    expect(all.best.id).toBe('south-veg-fast')
    expect(all.why.join(' ')).toMatch(/South Indian/)
    expect(köln.cityLine).toMatch(/Köln/)
  })
})
