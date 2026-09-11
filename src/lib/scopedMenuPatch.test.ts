import { describe, expect, it } from 'vitest'
import {
  eventKeysForMenuPatch,
  requirePlaceEventId,
} from '../../api/_lib/scopedMenuPatch'

describe('eventKeysForMenuPatch', () => {
  it('touches only the named event type', () => {
    expect(eventKeysForMenuPatch('Flohmarkt')).toEqual(['Flohmarkt'])
    expect(eventKeysForMenuPatch('Gourmet')).toEqual(['Gourmet'])
  })

  it('does not fan out to every type when scope is missing', () => {
    expect(eventKeysForMenuPatch(undefined, ['Flohmarkt', 'Gourmet'])).toEqual([])
    expect(eventKeysForMenuPatch('')).toEqual([])
  })
})

describe('requirePlaceEventId', () => {
  it('accepts a stall id from the guest QR', () => {
    expect(requirePlaceEventId('E012')).toBe('E012')
  })

  it('refuses a place with no event so staff activeEventId cannot be used', () => {
    expect(requirePlaceEventId(undefined)).toBeNull()
    expect(requirePlaceEventId('')).toBeNull()
    expect(requirePlaceEventId('   ')).toBeNull()
  })
})
