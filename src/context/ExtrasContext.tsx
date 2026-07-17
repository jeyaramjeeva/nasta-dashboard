import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchTeamExtras,
  saveTeamExtras,
  upsertPlateCount,
  type TeamExtrasPayload,
} from '../lib/cloudExtras'
import {
  loadEventInventory,
  loadInventoryDefs,
  loadWeather,
  saveInventoryDefs,
  setEventInventory as localSetEventInventory,
  setEventWeather as localSetEventWeather,
  type InventoryItemDef,
  type InventoryLine,
  type WeatherTag,
  addInventoryDish as localAddDish,
  updateInventoryUnitCost as localUpdateCost,
} from '../lib/extrasStore'
import {
  enqueueOffline,
  offlineQueueCount,
  peekOfflineQueue,
  replaceOfflineQueue,
} from '../lib/offlineQueue'
import { demoStorageKey, isDemoMode } from '../lib/demoMode'
import { isCloudConfigured } from '../lib/supabase'
import { useAuth } from './AuthContext'

const MISSION_KEY = 'nasta-mission-v1'

function loadLocalMission(): string {
  try {
    return localStorage.getItem(demoStorageKey(MISSION_KEY)) || ''
  } catch {
    return ''
  }
}

function saveLocalMission(mission: string) {
  localStorage.setItem(demoStorageKey(MISSION_KEY), mission)
}

interface ExtrasContextValue {
  weather: Record<string, WeatherTag>
  inventoryDefs: InventoryItemDef[]
  inventoryEvents: Record<string, InventoryLine[]>
  mission: string
  syncing: boolean
  pendingOps: number
  cloudExtras: boolean
  setEventWeather: (eventId: string, tag: WeatherTag) => void
  setEventInventory: (eventId: string, lines: InventoryLine[]) => void
  setMission: (mission: string) => void
  updateUnitCost: (itemId: string, unitCost: number) => void
  addDish: (name: string, unit?: string, unitCost?: number) => void
  flushOfflineQueue: () => Promise<void>
  refreshExtras: () => Promise<void>
}

const ExtrasContext = createContext<ExtrasContextValue | null>(null)

function applyPayloadLocally(p: TeamExtrasPayload) {
  localStorage.setItem(demoStorageKey('nasta-weather-v2'), JSON.stringify(p.weather || {}))
  if (p.inventoryDefs?.length) saveInventoryDefs(p.inventoryDefs)
  localStorage.setItem(
    demoStorageKey('nasta-inventory-events-v1'),
    JSON.stringify(p.inventoryEvents || {}),
  )
  saveLocalMission(p.mission || '')
  if (p.stallOps) {
    localStorage.setItem(demoStorageKey('nasta-stall-ops-v1'), JSON.stringify(p.stallOps))
  }
}

export function ExtrasProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const cloudExtras = isCloudConfigured() && !isDemoMode()
  const [weather, setWeather] = useState<Record<string, WeatherTag>>(loadWeather)
  const [inventoryDefs, setDefs] = useState<InventoryItemDef[]>(() => loadInventoryDefs())
  const [inventoryEvents, setInvEvents] = useState(() => loadEventInventory())
  const [mission, setMissionState] = useState(loadLocalMission)
  const [syncing, setSyncing] = useState(false)
  const [pendingOps, setPendingOps] = useState(() => offlineQueueCount())

  const snapshotPayload = useCallback((): TeamExtrasPayload => {
    let stallOps = null
    try {
      const raw = localStorage.getItem(demoStorageKey('nasta-stall-ops-v1'))
      if (raw) stallOps = JSON.parse(raw)
    } catch {
      /* ignore */
    }
    return {
      weather: loadWeather(),
      inventoryDefs: loadInventoryDefs(),
      inventoryEvents: loadEventInventory(),
      mission: loadLocalMission(),
      stallOps,
    }
  }, [])

  const pushCloud = useCallback(
    async (payload: TeamExtrasPayload) => {
      if (!cloudExtras || !user) return
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueOffline({ kind: 'team_extras', payload })
        setPendingOps(offlineQueueCount())
        return
      }
      try {
        await saveTeamExtras(payload)
      } catch {
        enqueueOffline({ kind: 'team_extras', payload })
        setPendingOps(offlineQueueCount())
      }
    },
    [cloudExtras, user],
  )

  const refreshExtras = useCallback(async () => {
    if (!cloudExtras || !user) {
      setWeather(loadWeather())
      setDefs(loadInventoryDefs())
      setInvEvents(loadEventInventory())
      setMissionState(loadLocalMission())
      return
    }
    setSyncing(true)
    try {
      const remote = await fetchTeamExtras()
      if (remote) {
        applyPayloadLocally(remote)
        setWeather(remote.weather || {})
        setDefs(remote.inventoryDefs?.length ? remote.inventoryDefs : loadInventoryDefs())
        setInvEvents(remote.inventoryEvents || {})
        setMissionState(remote.mission || '')
      } else {
        // Seed cloud from local once
        await saveTeamExtras(snapshotPayload()).catch(() => undefined)
      }
    } finally {
      setSyncing(false)
    }
  }, [cloudExtras, snapshotPayload, user])

  const flushOfflineQueue = useCallback(async () => {
    if (!cloudExtras || !user || !navigator.onLine) return
    const ops = peekOfflineQueue()
    if (!ops.length) return
    const still = []
    for (const op of ops) {
      try {
        if (op.kind === 'team_extras') {
          await saveTeamExtras(op.payload as unknown as TeamExtrasPayload)
        } else if (op.kind === 'plate_count') {
          await upsertPlateCount(op.payload)
        } else if (op.kind === 'stall_ops') {
          const { saveStallOpsCloud } = await import('../lib/cloudExtras')
          await saveStallOpsCloud(op.payload as import('../lib/stallOps').StallOpsState)
        } else {
          still.push(op) // quick_add → DataContext
        }
      } catch {
        still.push(op)
      }
    }
    replaceOfflineQueue(still)
    setPendingOps(offlineQueueCount())
    await refreshExtras()
  }, [cloudExtras, refreshExtras, user])

  useEffect(() => {
    void refreshExtras()
  }, [refreshExtras])

  useEffect(() => {
    const on = () => void flushOfflineQueue()
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [flushOfflineQueue])

  const setEventWeather = useCallback(
    (eventId: string, tag: WeatherTag) => {
      localSetEventWeather(eventId, tag)
      const next = loadWeather()
      setWeather(next)
      void pushCloud(snapshotPayload())
    },
    [pushCloud, snapshotPayload],
  )

  const setEventInventory = useCallback(
    (eventId: string, lines: InventoryLine[]) => {
      localSetEventInventory(eventId, lines)
      setInvEvents(loadEventInventory())
      void pushCloud(snapshotPayload())
    },
    [pushCloud, snapshotPayload],
  )

  const setMission = useCallback(
    (next: string) => {
      saveLocalMission(next)
      setMissionState(next)
      void pushCloud(snapshotPayload())
    },
    [pushCloud, snapshotPayload],
  )

  const updateUnitCost = useCallback(
    (itemId: string, unitCost: number) => {
      const next = localUpdateCost(itemId, unitCost)
      setDefs(next)
      void pushCloud(snapshotPayload())
    },
    [pushCloud, snapshotPayload],
  )

  const addDish = useCallback(
    (name: string, unit = 'portion', unitCost = 0) => {
      const next = localAddDish(name, unit, unitCost)
      setDefs(next)
      void pushCloud(snapshotPayload())
    },
    [pushCloud, snapshotPayload],
  )

  const value = useMemo(
    () => ({
      weather,
      inventoryDefs,
      inventoryEvents,
      mission,
      syncing,
      pendingOps,
      cloudExtras,
      setEventWeather,
      setEventInventory,
      setMission,
      updateUnitCost,
      addDish,
      flushOfflineQueue,
      refreshExtras,
    }),
    [
      weather,
      inventoryDefs,
      inventoryEvents,
      mission,
      syncing,
      pendingOps,
      cloudExtras,
      setEventWeather,
      setEventInventory,
      setMission,
      updateUnitCost,
      addDish,
      flushOfflineQueue,
      refreshExtras,
    ],
  )

  return <ExtrasContext.Provider value={value}>{children}</ExtrasContext.Provider>
}

export function useExtras() {
  const ctx = useContext(ExtrasContext)
  if (!ctx) throw new Error('useExtras must be used within ExtrasProvider')
  return ctx
}
