import { describe, expect, it } from 'vitest'
import { openingStatus, parseOpeningHours } from './osmHours'

describe('osmHours', () => {
  it('reads 24/7', () => {
    expect(openingStatus('24/7', new Date('2026-09-08T15:00:00'))).toBe('open')
  })

  it('reads weekday lunch + dinner', () => {
    const tag = 'Mo-Fr 11:00-15:00,17:00-22:00; Sa-Su 12:00-22:00'
    expect(parseOpeningHours(tag)).toHaveLength(2)
    expect(openingStatus(tag, new Date(2026, 8, 8, 12, 30))).toBe('open')
    expect(openingStatus(tag, new Date(2026, 8, 8, 16, 0))).toBe('closed')
    expect(openingStatus(tag, new Date(2026, 8, 8, 18, 0))).toBe('open')
    expect(openingStatus(tag, new Date(2026, 8, 6, 11, 30))).toBe('closed')
  })

  it('honours Mo off', () => {
    const tag = 'Tu-Su 17:00-23:00; Mo off'
    expect(openingStatus(tag, new Date(2026, 8, 7, 18, 0))).toBe('closed')
    expect(openingStatus(tag, new Date(2026, 8, 8, 18, 0))).toBe('open')
  })

  it('is unknown when empty', () => {
    expect(openingStatus('')).toBe('unknown')
  })
})
