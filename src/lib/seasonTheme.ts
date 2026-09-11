/** Cinematic season skins for the team app shell. */

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter' | 'diwali'

/** Approximate Diwali window (mid–late Oct / early Nov) — Berlin calendar. */
function isDiwaliWindow(month: number, day: number): boolean {
  if (month === 10 && day >= 15) return true
  if (month === 11 && day <= 10) return true
  return false
}

export function currentSeason(now = new Date()): SeasonId {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const month = Number(parts.find((p) => p.type === 'month')?.value || 1)
  const day = Number(parts.find((p) => p.type === 'day')?.value || 1)
  if (isDiwaliWindow(month, day)) return 'diwali'
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

export function seasonLabel(id: SeasonId): string {
  switch (id) {
    case 'spring':
      return 'Spring'
    case 'summer':
      return 'Summer'
    case 'autumn':
      return 'Autumn'
    case 'winter':
      return 'Winter'
    case 'diwali':
      return 'Diwali'
  }
}

/** Apply `data-season` on <html> for CSS themes. */
export function applySeasonTheme(id?: SeasonId) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.season = id || currentSeason()
}
