import type { EventMetrics } from '../types'
import type { WeatherTag } from './extrasStore'

export type WeatherCall = 'go' | 'caution' | 'skip'

export interface WeatherAdvice {
  call: WeatherCall
  title: string
  line: string
}

/** Rule-of-thumb tip from forecast tag + past rainy vs sunny margins. */
export function weatherGoCautionSkip(
  tag: WeatherTag | undefined | null,
  history: EventMetrics[],
  weatherByEvent: Record<string, WeatherTag>,
): WeatherAdvice {
  const rainy = history.filter((e) => weatherByEvent[e.id] === 'rainy' && e.status === 'Completed')
  const sunny = history.filter(
    (e) =>
      (weatherByEvent[e.id] === 'sunny' || weatherByEvent[e.id] === 'good') &&
      e.status === 'Completed',
  )
  const rainyAvg =
    rainy.length > 0 ? rainy.reduce((s, e) => s + e.margin, 0) / rainy.length : null
  const sunnyAvg =
    sunny.length > 0 ? sunny.reduce((s, e) => s + e.margin, 0) / sunny.length : null

  const t = tag || ''
  if (t === 'rainy') {
    if (rainyAvg != null && rainyAvg < -5) {
      return {
        call: 'skip',
        title: 'Skip — rain hurts hard',
        line: `Past rainy stalls averaged ${rainyAvg.toFixed(0)}% margin. Consider sitting this one out or a short pop-up only.`,
      }
    }
    return {
      call: 'caution',
      title: 'Caution — wet stall day',
      line: 'Bring canopy, hot chai focus, and a smaller grocery pull. Rain usually slows foot traffic.',
    }
  }
  if (t === 'windy' || t === 'mixed') {
    return {
      call: 'caution',
      title: 'Caution — tricky weather',
      line: 'Secure the gazebo, keep batter covered, and expect uneven traffic. Pack a Plan B menu.',
    }
  }
  if (t === 'sunny' || t === 'good') {
    if (sunnyAvg != null && sunnyAvg > 15) {
      return {
        call: 'go',
        title: 'Go — weather is your friend',
        line: `Sunny/good days have averaged ${sunnyAvg.toFixed(0)}% margin. Load plates and chase the lunch rush.`,
      }
    }
    return {
      call: 'go',
      title: 'Go — clear skies',
      line: 'Good selling weather. Full prep, strong float, and push high-margin plates.',
    }
  }
  return {
    call: 'go',
    title: 'No weather tag yet',
    line: 'Optional: mark sunny / rainy on Calendar so tips can learn from past stalls.',
  }
}

/**
 * Go / Caution / Skip for a location+event: weather + fee pressure + historical profit.
 */
export function locationGoCautionSkip(opts: {
  tag: WeatherTag | undefined | null
  history: EventMetrics[]
  weatherByEvent: Record<string, WeatherTag>
  /** Upcoming / selected event (fee, location). */
  event?: Pick<EventMetrics, 'fee' | 'location' | 'name' | 'income' | 'margin' | 'status'> | null
  /** Location scorecard rows (incomePerDay, margin). */
  locationScores?: { location: string; incomePerDay: number; margin: number }[]
}): WeatherAdvice {
  const base = weatherGoCautionSkip(opts.tag, opts.history, opts.weatherByEvent)
  const loc = String(opts.event?.location || '').trim()
  const score = loc
    ? opts.locationScores?.find(
        (r) => r.location.toLowerCase() === loc.toLowerCase(),
      )
    : undefined
  const fee = Number(opts.event?.fee) || 0
  const histAtLoc = loc
    ? opts.history.filter(
        (e) =>
          e.status === 'Completed' &&
          String(e.location || '').toLowerCase() === loc.toLowerCase(),
      )
    : []
  const histMargin =
    histAtLoc.length > 0
      ? histAtLoc.reduce((s, e) => s + e.margin, 0) / histAtLoc.length
      : score?.margin ?? null
  const histIncome =
    histAtLoc.length > 0
      ? histAtLoc.reduce((s, e) => s + e.income, 0) / histAtLoc.length
      : score?.incomePerDay ?? null

  let call = base.call
  const bits: string[] = [base.line]

  if (fee > 0 && histIncome != null && fee > histIncome * 0.35) {
    if (call === 'go') call = 'caution'
    else if (call === 'caution' && fee > histIncome * 0.55) call = 'skip'
    bits.push(
      `Fee €${fee.toFixed(0)} is heavy vs typical income ~€${histIncome.toFixed(0)} at ${loc || 'this site'}.`,
    )
  } else if (histMargin != null && histMargin < 0) {
    if (call === 'go') call = 'caution'
    bits.push(
      `${loc || 'This location'} historically loses money (${(histMargin * 100).toFixed(0)}% margin).`,
    )
  } else if (histMargin != null && histMargin > 0.2 && call !== 'skip') {
    call = call === 'caution' && opts.tag !== 'rainy' ? 'go' : call
    bits.push(
      `${loc || 'Site'} usually profits (~${(histMargin * 100).toFixed(0)}% margin).`,
    )
  }

  const title =
    call === 'go'
      ? `Go — ${loc || 'stall day'}`
      : call === 'skip'
        ? `Skip — ${loc || 'this stall'}`
        : `Caution — ${loc || 'check the numbers'}`

  return { call, title, line: bits.join(' ') }
}

export function weatherCallBadge(call: WeatherCall): string {
  if (call === 'go') return 'ok'
  if (call === 'skip') return 'warn'
  return 'warn'
}
