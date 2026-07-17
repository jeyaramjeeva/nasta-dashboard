import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { countCash, isDenomLabel, isLedgerEventId } from '../lib/cash'
import {
  fetchExcelFromUrl,
  loadDriveSettings,
  parseDriveLink,
  saveDriveSettings,
  type DriveSettings,
} from '../lib/drive'
import {
  getLocalVersion,
  loadLocalHistory,
  pushLocalHistory,
  type SnapshotVersion,
} from '../lib/history'
import { applyUploadMode, type UploadMode } from '../lib/merge'
import { computeMetrics } from '../lib/metrics'
import { parseWorkbook, parseWorkbookFile } from '../lib/parseWorkbook'
import { recomputePartners } from '../lib/partners'
import {
  checkUploadPassword,
  fetchLatestSnapshot,
  fetchSnapshotVersion,
  fetchSnapshotVersions,
  isCloudConfigured,
  saveSnapshot,
  saveSnapshotVersion,
  supabaseAnonKey,
  supabaseUrl,
} from '../lib/supabase'
import { validateSnapshot, type ValidationReport } from '../lib/validate'
import type { DashboardMetrics, EventCashCount, Snapshot, Transaction } from '../types'

function fillBeforeFromStartOfDay(entry: EventCashCount): EventCashCount {
  if (entry.before.length || entry.beforeCash > 0) return entry
  if (!entry.startOfDay?.length) return entry
  return {
    ...entry,
    before: entry.startOfDay,
    beforeCash: entry.beforeCash || countCash(entry.startOfDay),
  }
}

function normalizeEventCashCounts(counts: EventCashCount[] | undefined): EventCashCount[] {
  return (counts || []).map(fillBeforeFromStartOfDay)
}

/** Merge seed start-of-day / before into events that are still empty. */
function mergeEventCashCounts(
  current: EventCashCount[] | undefined,
  seed: EventCashCount[] | undefined,
): EventCashCount[] {
  const seedById = new Map((seed || []).map((e) => [e.eventId, e]))
  const cur = normalizeEventCashCounts(current)
  if (!cur.length) return normalizeEventCashCounts(seed)

  const seen = new Set<string>()
  const merged = cur.map((e) => {
    seen.add(e.eventId)
    const filled = fillBeforeFromStartOfDay(e)
    if (filled.before.length || filled.beforeCash > 0) return filled
    const fromSeed = seedById.get(e.eventId)
    if (!fromSeed) return filled
    const seedFilled = fillBeforeFromStartOfDay(fromSeed)
    if (!seedFilled.before.length && !seedFilled.beforeCash) return filled
    return {
      ...filled,
      before: seedFilled.before,
      beforeCash: seedFilled.beforeCash,
      beforePaypal: seedFilled.beforePaypal || filled.beforePaypal,
      startOfDay: filled.startOfDay?.length ? filled.startOfDay : seedFilled.startOfDay,
    }
  })

  for (const s of seed || []) {
    if (!seen.has(s.eventId)) merged.push(fillBeforeFromStartOfDay(s))
  }
  return merged.sort((a, b) => a.eventId.localeCompare(b.eventId))
}

function normalizeSnapshot(data: Snapshot): Snapshot {
  const coinReserve = (data.coinReserve || []).filter((d) => isDenomLabel(d.label))
  return {
    ...data,
    paypalBalance: data.paypalBalance ?? 0,
    cashBox: (data.cashBox || []).filter((r) => isLedgerEventId(r.eventId)),
    denominations: (data.denominations || []).filter((d) => isDenomLabel(d.label)),
    partners: data.partners?.length
      ? data.partners
      : recomputePartners(data.transactions || []),
    eventCashCounts: normalizeEventCashCounts(data.eventCashCounts),
    coinReserve,
    coinReserveTotal: data.coinReserveTotal ?? 0,
    mainBoxTotal: data.mainBoxTotal ?? 0,
    allBoxesTotal: data.allBoxesTotal ?? 0,
  }
}

/** Older uploads miss coin reserve / start-of-day before counts — fill from seed. */
async function healMissingCashExtras(snap: Snapshot): Promise<Snapshot> {
  const missingReserve =
    (!snap.coinReserve || snap.coinReserve.length === 0) &&
    !(Number(snap.coinReserveTotal) > 0)
  const needsBeforeHeal = (snap.eventCashCounts || []).some(
    (e) => !(e.beforeCash > 0 || e.before.length > 0),
  )

  if (!missingReserve && !needsBeforeHeal && snap.eventCashCounts?.length) {
    return snap
  }

  try {
    const res = await fetch(`/seed-data.json?v=${Date.now()}`)
    if (!res.ok) return snap
    const seed = normalizeSnapshot((await res.json()) as Snapshot)
    return {
      ...snap,
      coinReserve: missingReserve ? seed.coinReserve || [] : snap.coinReserve,
      coinReserveTotal: missingReserve
        ? seed.coinReserveTotal ?? 0
        : snap.coinReserveTotal,
      eventCashCounts: mergeEventCashCounts(snap.eventCashCounts, seed.eventCashCounts),
      mainBoxTotal: snap.mainBoxTotal || seed.mainBoxTotal || 0,
      allBoxesTotal:
        snap.allBoxesTotal ||
        seed.allBoxesTotal ||
        (snap.mainBoxTotal || 0) + (snap.coinReserveTotal || 0),
    }
  } catch {
    return snap
  }
}

export interface PublishOptions {
  password: string
  mode: UploadMode
  note?: string
  /** Allow publish even when validation has errors. */
  force?: boolean
}

export interface QuickAddInput {
  password: string
  transaction: Omit<Transaction, 'month'> & { month?: string | null }
}

export type DataOrigin = 'cloud' | 'local' | 'seed' | null

interface DataContextValue {
  snapshot: Snapshot | null
  metrics: DashboardMetrics | null
  loading: boolean
  error: string | null
  cloudEnabled: boolean
  /** Where the current snapshot came from */
  dataOrigin: DataOrigin
  lastSynced: string | null
  versions: SnapshotVersion[]
  driveSettings: DriveSettings
  refresh: () => Promise<void>
  refreshVersions: () => Promise<void>
  /** Parse file and return candidate + validation (does not publish). */
  prepareUpload: (
    file: File,
    mode: UploadMode,
  ) => Promise<{ candidate: Snapshot; report: ValidationReport }>
  /** Parse buffer (e.g. from Drive) and validate. */
  prepareBuffer: (
    buffer: ArrayBuffer,
    sourceFile: string,
    mode: UploadMode,
  ) => Promise<{ candidate: Snapshot; report: ValidationReport }>
  publishSnapshot: (
    candidate: Snapshot,
    options: PublishOptions,
  ) => Promise<ValidationReport>
  restoreVersion: (id: string, password: string) => Promise<void>
  pullFromDrive: (
    mode: UploadMode,
  ) => Promise<{ candidate: Snapshot; report: ValidationReport }>
  saveDriveUrl: (url: string) => void
  quickAddTransaction: (input: QuickAddInput) => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

const LOCAL_KEY = 'nasta-snapshot-v3'

function loadLocal(): Snapshot | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Snapshot
  } catch {
    return null
  }
}

function saveLocal(snapshot: Snapshot) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot))
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataOrigin, setDataOrigin] = useState<DataOrigin>(null)
  const [versions, setVersions] = useState<SnapshotVersion[]>([])
  const [driveSettings, setDriveSettings] = useState<DriveSettings>(() =>
    loadDriveSettings(),
  )
  const cloudEnabled = isCloudConfigured()

  const apply = useCallback((data: Snapshot | null, origin?: DataOrigin) => {
    const next = data ? normalizeSnapshot(data) : null
    setSnapshot(next)
    if (origin !== undefined) setDataOrigin(origin)
    if (next) saveLocal(next)
  }, [])

  const refreshVersions = useCallback(async () => {
    if (cloudEnabled) {
      const remote = await fetchSnapshotVersions(20)
      if (remote.length) {
        setVersions(remote)
        return
      }
    }
    setVersions(loadLocalHistory())
  }, [cloudEnabled])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (cloudEnabled) {
        const remote = await fetchLatestSnapshot()
        if (remote) {
          apply(await healMissingCashExtras(remote), 'cloud')
          await refreshVersions()
          return
        }
      }
      const local = loadLocal()
      if (local) {
        apply(await healMissingCashExtras(local), 'local')
        await refreshVersions()
        return
      }
      const seed = await fetch('/seed-data.json')
      if (seed.ok) {
        const data = (await seed.json()) as Snapshot
        apply(
          {
            ...data,
            paypalBalance: data.paypalBalance ?? 0,
          },
          'seed',
        )
        await refreshVersions()
        return
      }
      apply(null, null)
      await refreshVersions()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
      const local = loadLocal()
      if (local) apply(await healMissingCashExtras(local), 'local')
      await refreshVersions()
    } finally {
      setLoading(false)
    }
  }, [apply, cloudEnabled, refreshVersions])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const prepareFromIncoming = useCallback(
    (incoming: Snapshot, mode: UploadMode) => {
      const mergeResult = applyUploadMode(snapshot, incoming, mode)
      const report = validateSnapshot(mergeResult.snapshot, {
        mode,
        merge: mergeResult,
      })
      return { candidate: mergeResult.snapshot, report }
    },
    [snapshot],
  )

  const prepareUpload = useCallback(
    async (file: File, mode: UploadMode) => {
      const incoming = await parseWorkbookFile(file)
      return prepareFromIncoming(incoming, mode)
    },
    [prepareFromIncoming],
  )

  const prepareBuffer = useCallback(
    async (buffer: ArrayBuffer, sourceFile: string, mode: UploadMode) => {
      const incoming = parseWorkbook(buffer, sourceFile)
      return prepareFromIncoming(incoming, mode)
    },
    [prepareFromIncoming],
  )

  const persistVersion = useCallback(
    async (
      next: Snapshot,
      mode: SnapshotVersion['mode'],
      note?: string,
    ) => {
      // Archive current latest before overwrite (restore safety)
      if (snapshot) {
        const archive = pushLocalHistory(snapshot, 'restore', 'Auto-archive before publish')
        if (cloudEnabled) {
          try {
            await saveSnapshotVersion(archive)
          } catch {
            /* versions table may be missing */
          }
        }
      }

      const version = pushLocalHistory(next, mode, note)
      if (cloudEnabled) {
        await saveSnapshot(next)
        try {
          await saveSnapshotVersion(version)
        } catch {
          /* ignore if versions table missing */
        }
      }
      apply(next, cloudEnabled ? 'cloud' : 'local')
      await refreshVersions()
    },
    [apply, cloudEnabled, refreshVersions, snapshot],
  )

  const publishSnapshot = useCallback(
    async (candidate: Snapshot, options: PublishOptions) => {
      if (!checkUploadPassword(options.password)) {
        throw new Error('Wrong upload password')
      }
      const report = validateSnapshot(candidate, { mode: options.mode })
      if (!report.ok && !options.force) {
        throw new Error(
          report.issues.find((i) => i.level === 'error')?.message ||
            'Validation failed — fix errors or publish with force',
        )
      }
      const stamped = {
        ...candidate,
        uploadedAt: new Date().toISOString(),
        partners: recomputePartners(candidate.transactions),
      }
      await persistVersion(stamped, options.mode, options.note)
      return validateSnapshot(stamped, { mode: options.mode })
    },
    [persistVersion],
  )

  const restoreVersion = useCallback(
    async (id: string, password: string) => {
      if (!checkUploadPassword(password)) {
        throw new Error('Wrong upload password')
      }
      let version =
        getLocalVersion(id) ||
        (cloudEnabled ? await fetchSnapshotVersion(id) : null)
      if (!version) throw new Error('Version not found')
      const restored: Snapshot = {
        ...normalizeSnapshot(version.payload),
        uploadedAt: new Date().toISOString(),
        sourceFile: `${version.sourceFile} (restored)`,
      }
      await persistVersion(restored, 'restore', `Restored from ${version.createdAt}`)
    },
    [cloudEnabled, persistVersion],
  )

  const saveDriveUrl = useCallback((url: string) => {
    const next = { ...loadDriveSettings(), url }
    saveDriveSettings(next)
    setDriveSettings(next)
  }, [])

  const pullFromDrive = useCallback(
    async (mode: UploadMode) => {
      const settings = loadDriveSettings()
      if (!settings.url) throw new Error('Save a Drive / OneDrive link first')
      const info = parseDriveLink(settings.url)
      if (!info.downloadUrl) throw new Error(info.hint)

      // Pass original share URL — helper resolves OneDrive/Google download URLs
      const buffer = await fetchExcelFromUrl(info.inputUrl || info.downloadUrl, {
        supabaseUrl,
        anonKey: supabaseAnonKey,
      })
      const name =
        info.provider === 'google'
          ? 'GoogleDrive.xlsx'
          : info.provider === 'onedrive'
            ? 'OneDrive.xlsx'
            : 'Remote.xlsx'
      const prepared = await prepareBuffer(buffer, name, mode)
      const nextSettings = {
        ...settings,
        lastPulledAt: new Date().toISOString(),
      }
      saveDriveSettings(nextSettings)
      setDriveSettings(nextSettings)
      return prepared
    },
    [prepareBuffer],
  )

  const quickAddTransaction = useCallback(
    async (input: QuickAddInput) => {
      if (!checkUploadPassword(input.password)) {
        throw new Error('Wrong upload password')
      }
      if (!snapshot) throw new Error('No snapshot loaded yet — upload Excel first')

      const t = input.transaction
      const month =
        t.month || (t.date && t.date.length >= 7 ? t.date.slice(0, 7) : null)
      const row: Transaction = { ...t, month }
      const transactions = [...snapshot.transactions, row]
      const next: Snapshot = {
        ...snapshot,
        uploadedAt: new Date().toISOString(),
        sourceFile: snapshot.sourceFile || 'quick-add',
        transactions,
        partners: recomputePartners(transactions),
      }
      await persistVersion(next, 'quick-add', `Quick add: ${row.description || row.category}`)
    },
    [persistVersion, snapshot],
  )

  const metrics = useMemo(
    () => (snapshot ? computeMetrics(snapshot) : null),
    [snapshot],
  )

  const value: DataContextValue = {
    snapshot,
    metrics,
    loading,
    error,
    cloudEnabled,
    dataOrigin,
    lastSynced: snapshot?.uploadedAt ?? null,
    versions,
    driveSettings,
    refresh,
    refreshVersions,
    prepareUpload,
    prepareBuffer,
    publishSnapshot,
    restoreVersion,
    pullFromDrive,
    saveDriveUrl,
    quickAddTransaction,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
