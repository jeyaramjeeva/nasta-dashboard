import type { Snapshot } from '../types'
import type { UploadMode } from './merge'

export interface SnapshotVersion {
  id: string
  createdAt: string
  sourceFile: string
  mode: UploadMode | 'restore' | 'quick-add' | 'drive-pull'
  note?: string
  summary: {
    events: number
    transactions: number
  }
  payload: Snapshot
}

const HISTORY_KEY = 'nasta-history-v1'
const MAX_LOCAL = 20

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadLocalHistory(): SnapshotVersion[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as SnapshotVersion[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveLocalHistory(list: SnapshotVersion[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_LOCAL)))
}

export function pushLocalHistory(
  snapshot: Snapshot,
  mode: SnapshotVersion['mode'],
  note?: string,
): SnapshotVersion {
  const version: SnapshotVersion = {
    id: uid(),
    createdAt: new Date().toISOString(),
    sourceFile: snapshot.sourceFile,
    mode,
    note,
    summary: {
      events: snapshot.events.length,
      transactions: snapshot.transactions.length,
    },
    payload: snapshot,
  }
  const next = [version, ...loadLocalHistory()].slice(0, MAX_LOCAL)
  saveLocalHistory(next)
  return version
}

export function getLocalVersion(id: string): SnapshotVersion | null {
  return loadLocalHistory().find((v) => v.id === id) ?? null
}
