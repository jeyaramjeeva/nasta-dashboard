import { describe, expect, it } from 'vitest'
import { DISTRICTS, PEOPLE_STATS } from './marketPeople'

describe('marketPeople', () => {
  it('Köln Stadtbezirk residents sum to the register total', () => {
    const sum = DISTRICTS.filter((d) => d.city === 'Köln').reduce((n, d) => n + (d.residents ?? 0), 0)
    expect(sum).toBe(1_100_076)
  })

  it('Bonn Stadtbezirk residents sum to the 31.12.2025 register', () => {
    const sum = DISTRICTS.filter((d) => d.city === 'Bonn').reduce((n, d) => n + (d.residents ?? 0), 0)
    expect(sum).toBe(342_152)
  })

  it('does not invent a 2026 Bonn Indian count', () => {
    const indian = PEOPLE_STATS.filter((s) => s.filters.includes('indian') && s.city === 'Bonn')
    expect(indian.every((s) => s.asOf.includes('2022'))).toBe(true)
  })
})
