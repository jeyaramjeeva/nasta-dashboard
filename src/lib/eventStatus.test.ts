import { describe, expect, it } from 'vitest'
import {
  displayStallStatus,
  impactsMetrics,
  isFinishedStall,
  isNextStallCandidate,
  isOpenUpcomingStall,
  isUpcomingStatus,
  normalizeEventStatus,
  usesActuals,
} from './eventStatus'

describe('eventStatus dashboard buckets', () => {
  it('treats Confirmed like Completed for actuals / KPI completed', () => {
    expect(usesActuals('Confirmed')).toBe(true)
    expect(usesActuals('Completed')).toBe(true)
    expect(usesActuals('confirm')).toBe(true)
    expect(impactsMetrics('Confirmed')).toBe(true)
    expect(usesActuals('Applied')).toBe(false)
    expect(usesActuals('Upcoming')).toBe(false)
    expect(usesActuals('Rejected')).toBe(false)
  })

  it('keeps Applied and Upcoming in the upcoming list', () => {
    expect(isUpcomingStatus('Applied')).toBe(true)
    expect(isUpcomingStatus('Upcoming')).toBe(true)
    expect(isUpcomingStatus('planned')).toBe(true)
    expect(isUpcomingStatus('Confirmed')).toBe(false)
    expect(isUpcomingStatus('Completed')).toBe(false)
    expect(isUpcomingStatus('Rejected')).toBe(false)
  })

  it('lets Confirmed stay a next-stall candidate', () => {
    expect(isNextStallCandidate('Confirmed')).toBe(true)
    expect(isNextStallCandidate('Applied')).toBe(true)
    expect(isNextStallCandidate('Upcoming')).toBe(true)
    expect(isNextStallCandidate('Completed')).toBe(false)
    expect(isNextStallCandidate('Rejected')).toBe(false)
  })

  it('normalizes legacy Excel labels', () => {
    expect(normalizeEventStatus('done')).toBe('Completed')
    expect(normalizeEventStatus('open')).toBe('Upcoming')
  })

  it('treats past-dated stalls as finished even if Excel says Upcoming', () => {
    const today = '2026-09-01'
    const past = { status: 'Upcoming', startDate: '2026-08-16', endDate: '2026-08-16' }
    expect(isFinishedStall(past, today)).toBe(true)
    expect(isOpenUpcomingStall(past, today)).toBe(false)
    expect(displayStallStatus(past, today)).toBe('Completed')
    expect(
      displayStallStatus(
        { status: 'Confirmed', startDate: '2026-09-12', endDate: '2026-09-12' },
        today,
      ),
    ).toBe('Confirmed')
  })
})
