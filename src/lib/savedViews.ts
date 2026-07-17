import type { MetricsFilter, SavedView } from '../types'

const KEY = 'nasta-saved-views-v1'

export function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as SavedView[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveSavedViews(views: SavedView[]) {
  localStorage.setItem(KEY, JSON.stringify(views.slice(0, 30)))
}

export function addSavedView(name: string, filter: MetricsFilter): SavedView {
  const view: SavedView = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || 'Untitled view',
    filter: {
      months: filter.months?.length ? [...filter.months] : undefined,
      eventTypes: filter.eventTypes?.length ? [...filter.eventTypes] : undefined,
      category: filter.category || null,
      status: filter.status && filter.status !== 'all' ? filter.status : undefined,
    },
    createdAt: new Date().toISOString(),
  }
  const next = [view, ...loadSavedViews()]
  saveSavedViews(next)
  return view
}

export function removeSavedView(id: string) {
  saveSavedViews(loadSavedViews().filter((v) => v.id !== id))
}
