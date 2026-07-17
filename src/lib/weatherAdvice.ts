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

export function weatherCallBadge(call: WeatherCall): string {
  if (call === 'go') return 'ok'
  if (call === 'skip') return 'warn'
  return 'warn'
}
