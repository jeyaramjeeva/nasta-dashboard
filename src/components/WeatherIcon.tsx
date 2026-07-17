import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from 'lucide-react'
import type { WeatherIconKind } from '../lib/liveWeather'

const SIZE = {
  sm: 12,
  md: 16,
} as const

export function WeatherIcon({
  kind,
  size = 'sm',
  title,
  className = '',
}: {
  kind: WeatherIconKind
  size?: 'sm' | 'md'
  title?: string
  className?: string
}) {
  const px = SIZE[size]
  const props = { size: px, strokeWidth: 2, className: `wx-icon wx-icon--${kind} ${className}` }
  const node =
    kind === 'sun' ? (
      <Sun {...props} />
    ) : kind === 'partly' ? (
      <CloudSun {...props} />
    ) : kind === 'cloud' ? (
      <Cloud {...props} />
    ) : kind === 'rain' ? (
      <CloudRain {...props} />
    ) : kind === 'storm' ? (
      <CloudLightning {...props} />
    ) : kind === 'snow' ? (
      <CloudSnow {...props} />
    ) : (
      <CloudFog {...props} />
    )
  return (
    <span className="wx-icon-wrap" title={title} aria-label={title || kind}>
      {node}
    </span>
  )
}
