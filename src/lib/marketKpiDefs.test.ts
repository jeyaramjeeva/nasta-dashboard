import { describe, expect, it } from 'vitest'
import { VENUES } from './marketAnalysis'
import { KPI_DEFS, closedWhen, kpiVenues, type KpiId } from './marketKpiDefs'
import { buildKpis, type CityMode } from './marketKpis'

const COUNT_MAP: [KpiId, keyof ReturnType<typeof buildKpis>][] = [
  ['total', 'total'],
  ['koeln', 'koeln'],
  ['bonn', 'bonn'],
  ['open', 'open'],
  ['closed', 'closed'],
  ['unknown', 'unknown'],
  ['veg-focus', 'vegFocused'],
  ['vegan-focus', 'veganFocused'],
  ['veg-friendly', 'vegFriendly'],
  ['south', 'south'],
  ['street', 'street'],
  ['thali', 'thali'],
  ['buffet', 'buffet'],
  ['delivery', 'delivery'],
  ['rated', 'ratedCount'],
  ['reviewed', 'reviewedCount'],
]

const CITIES: CityMode[] = ['All', 'Köln', 'Bonn', 'Compare']

describe('kpiVenues', () => {
  it('keeps every count KPI on the same filter as buildKpis', () => {
    for (const city of CITIES) {
      const k = buildKpis(city)
      for (const [id, key] of COUNT_MAP) {
        expect(kpiVenues(city, id).length, `${id} @ ${city}`).toBe(k[key])
      }
    }
  })

  it('does not invent closure dates', () => {
    const closed = VENUES.filter((v) => v.status === 'Permanently closed')
    for (const v of closed) {
      const label = closedWhen(v)
      if (label === 'Date unknown') continue
      expect(v.statusEvidence).toMatch(new RegExp(label.replace(/\s+/g, '\\s+')))
    }
  })

  it('keeps vegan-focused separate from vegan-friendly', () => {
    const focused = kpiVenues('All', 'vegan-focus')
    expect(focused.every((v) => /100% vegan|Vegan-focused/.test(v.vegan))).toBe(true)
    expect(focused.some((v) => v.vegan === 'Vegan-friendly')).toBe(false)
  })

  it('defines a chip and matcher for every KPI', () => {
    for (const id of Object.keys(KPI_DEFS) as KpiId[]) {
      expect(KPI_DEFS[id].chip.length).toBeGreaterThan(0)
      expect(typeof KPI_DEFS[id].match).toBe('function')
    }
  })
})
