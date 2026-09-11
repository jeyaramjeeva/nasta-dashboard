import type { DriveSettings } from './drive'
import type { InventoryItemDef, InventoryLine, WeatherTag } from './extrasStore'
import { getSupabase, isCloudConfigured } from './supabase'
import { germanyTodayYmd } from './germanyTime'
import type { StallOpsState } from './stallOps'
import {
  applyEventMenuRehome,
  emptyStallOps,
  loadStallOps,
  mergeEventMenuState,
  mergeEventPriceMaps,
  mergeMenuListsPreferLocal,
  mergeStallOrderBags,
  mergeStockItems,
  mergeTeamTodos,
  normalizeStallOps,
  preferPaypalQr,
  saveStallOpsLocal,
} from './stallOps'

export interface TeamExtrasPayload {
  weather: Record<string, WeatherTag>
  inventoryDefs: InventoryItemDef[]
  inventoryEvents: Record<string, InventoryLine[]>
  mission: string
  driveSettings?: DriveSettings | null
  stallOps?: StallOpsState | null
  updatedAt?: string
}

export interface PlateCountRow {
  eventId: string
  countedAt: string
  plates: number
  platePrice: number
  note?: string
}

/** Weather / inventory / mission — omit stall_ops (multi‑MB photos) unless asked. */
export async function fetchTeamExtras(opts?: {
  includeStallOps?: boolean
}): Promise<TeamExtrasPayload | null> {
  const sb = getSupabase()
  if (!sb || !isCloudConfigured()) return null
  const includeStallOps = Boolean(opts?.includeStallOps)
  // Fixed select string keeps Supabase generated types happy.
  const { data, error } = includeStallOps
    ? await sb
        .from('team_extras')
        .select(
          'weather, inventory_defs, inventory_events, mission, drive_settings, stall_ops, updated_at',
        )
        .eq('id', 'latest')
        .maybeSingle()
    : await sb
        .from('team_extras')
        .select(
          'weather, inventory_defs, inventory_events, mission, drive_settings, updated_at',
        )
        .eq('id', 'latest')
        .maybeSingle()
  if (error) {
    console.warn('team_extras:', error.message)
    return null
  }
  if (!data) return null
  const stallOps =
    includeStallOps && 'stall_ops' in data
      ? ((data.stall_ops as StallOpsState | null) ?? null)
      : null
  return {
    weather: (data.weather || {}) as Record<string, WeatherTag>,
    inventoryDefs: (data.inventory_defs || []) as InventoryItemDef[],
    inventoryEvents: (data.inventory_events || {}) as Record<string, InventoryLine[]>,
    mission: (data.mission as string | null) || '',
    driveSettings: (data.drive_settings as DriveSettings | null) ?? null,
    stallOps,
    updatedAt: data.updated_at as string,
  }
}

/**
 * Persist weather/inventory/mission without rewriting stall_ops (photos/orders).
 * Pass `stallOps` only when seeding a brand-new row.
 */
export async function saveTeamExtras(payload: TeamExtrasPayload): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase is not configured')
  const {
    data: { user },
  } = await sb.auth.getUser()
  const updated_at = new Date().toISOString()
  const updated_by = user?.id ?? null
  const base = {
    weather: payload.weather,
    inventory_defs: payload.inventoryDefs,
    inventory_events: payload.inventoryEvents,
    mission: payload.mission || null,
    drive_settings: payload.driveSettings ?? null,
    updated_at,
    updated_by,
  }
  const existing = await sb.from('team_extras').select('id').eq('id', 'latest').maybeSingle()
  if (existing.data) {
    const { error } = await sb.from('team_extras').update(base).eq('id', 'latest')
    if (error) throw new Error(error.message)
    return
  }
  const { error } = await sb.from('team_extras').insert({
    id: 'latest',
    ...base,
    stall_ops: payload.stallOps ?? loadStallOps(),
  })
  if (error) throw new Error(error.message)
}

function stallOpsLooksPopulated(ops: StallOpsState | null): boolean {
  if (!ops) return false
  return Boolean(
    ops.stock?.length ||
      ops.menu?.length ||
      ops.orders?.length ||
      ops.teamTodos?.length ||
      (ops.eventMenus && Object.keys(ops.eventMenus).length),
  )
}

export async function fetchStallOps(): Promise<StallOpsState | null> {
  try {
    const row = await fetchStallOpsRow()
    return stallOpsLooksPopulated(row.ops) ? row.ops : null
  } catch (e) {
    console.warn('stall_ops:', e instanceof Error ? e.message : e)
    return null
  }
}

async function fetchStallOpsRow(): Promise<{
  exists: boolean
  updatedAt: string | null
  ops: StallOpsState | null
}> {
  const sb = getSupabase()
  if (!sb || !isCloudConfigured()) return { exists: false, updatedAt: null, ops: null }
  const { data, error } = await sb
    .from('team_extras')
    .select('stall_ops, updated_at')
    .eq('id', 'latest')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return { exists: false, updatedAt: null, ops: null }
  const stallOps = (data.stall_ops as StallOpsState | null) ?? null
  const updatedAt = typeof data.updated_at === 'string' ? data.updated_at : null
  if (!stallOps) return { exists: true, updatedAt, ops: null }
  const ops = normalizeStallOps({
    ...emptyStallOps(),
    ...stallOps,
    stock: stallOps.stock?.length ? stallOps.stock : emptyStallOps().stock,
  })
  return { exists: true, updatedAt, ops }
}

function mergeForCloudSave(remote: StallOpsState, local: StallOpsState): StallOpsState {
  const bag = mergeStallOrderBags(
    {
      orders: remote.orders || [],
      deletedOrderIds: remote.deletedOrderIds || [],
    },
    {
      orders: local.orders || [],
      deletedOrderIds: local.deletedOrderIds || [],
    },
  )
  const paypalQr = preferPaypalQr(local, remote)
  const catalog = mergeEventMenuState(remote, local)
  const localStall = String(local.activeEventId || '').trim()
  return applyEventMenuRehome({
    ...remote,
    ...local,
    menu: mergeMenuListsPreferLocal(remote.menu, local.menu, {
      appendMissingFromRemote: true,
    }),
    eventPrices: mergeEventPriceMaps(remote.eventPrices, local.eventPrices),
    orders: bag.orders,
    deletedOrderIds: bag.deletedOrderIds,
    teamTodos: mergeTeamTodos(remote.teamTodos, local.teamTodos),
    stock: mergeStockItems(remote.stock, local.stock),
    stockAutoUseApplied: [
      ...new Set([
        ...(remote.stockAutoUseApplied || []),
        ...(local.stockAutoUseApplied || []),
      ]),
    ].slice(0, 2000),
    activeEventId: localStall || remote.activeEventId || '',
    publicMenuKey: localStall
      ? local.publicMenuKey || remote.publicMenuKey || ''
      : remote.publicMenuKey || local.publicMenuKey || '',
    publicMenuLabel: localStall
      ? local.publicMenuLabel || remote.publicMenuLabel || ''
      : remote.publicMenuLabel || local.publicMenuLabel || '',
    eventOrderLinks: {
      ...(remote.eventOrderLinks || {}),
      ...(local.eventOrderLinks || {}),
    },
    eventMenus: catalog.eventMenus,
    eventMenusRev: catalog.eventMenusRev,
    eventMenuRemovedIds: catalog.eventMenuRemovedIds,
    paypalQrDataUrl: paypalQr.paypalQrDataUrl,
    paypalQrUpdatedAt: paypalQr.paypalQrUpdatedAt,
  })
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/** Drop duplicated base64 photos from event catalogs — base `menu` is the source of truth. */
function stripEventMenuImages(ops: StallOpsState): StallOpsState {
  const src = ops.eventMenus
  if (!src || typeof src !== 'object') return ops
  const eventMenus: StallOpsState['eventMenus'] = {}
  for (const [key, list] of Object.entries(src)) {
    if (!Array.isArray(list)) continue
    eventMenus[key] = list.map((m) => {
      if (!m?.imageUrl) return m
      const { imageUrl: _drop, ...rest } = m
      return rest
    })
  }
  return { ...ops, eventMenus }
}

export async function saveStallOpsCloud(ops: StallOpsState): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase is not configured')
  const {
    data: { user },
  } = await sb.auth.getUser()
  const updatedBy = user?.id ?? null

  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await fetchStallOpsRow()
    const latest = stripEventMenuImages(loadStallOps())
    const remote = row.ops
    let toSave = stripEventMenuImages(latest)
    if (remote) toSave = stripEventMenuImages(mergeForCloudSave(remote, latest))
    else if (ops && !latest.orders.length && ops.orders.length) {
      toSave = stripEventMenuImages(ops)
    }
    toSave = applyEventMenuRehome(toSave)
    saveStallOpsLocal(toSave)

    const stamp = new Date().toISOString()
    if (!row.exists) {
      const { error } = await sb.from('team_extras').insert({
        id: 'latest',
        stall_ops: toSave,
        updated_at: stamp,
        updated_by: updatedBy,
      })
      if (error) {
        if (error.code === '23505') {
          await sleep(40 * (attempt + 1))
          continue
        }
        throw new Error(error.message)
      }
      return
    }

    let query = sb
      .from('team_extras')
      .update({
        stall_ops: toSave,
        updated_at: stamp,
        updated_by: updatedBy,
      })
      .eq('id', 'latest')
    if (row.updatedAt) query = query.eq('updated_at', row.updatedAt)
    const { data, error } = await query.select('id')
    if (error) throw new Error(error.message)
    if (Array.isArray(data) && data.length > 0) return
    await sleep(40 * (attempt + 1))
  }
  throw new Error('Stall sync is busy — will retry.')
}

export async function fetchUserTheme(): Promise<'light' | 'dark' | 'system' | null> {
  const sb = getSupabase()
  if (!sb) return null
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null
  const { data, error } = await sb
    .from('user_prefs')
    .select('theme')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) {
    console.warn('user_prefs:', error.message)
    return null
  }
  const theme = data?.theme as string | undefined
  if (theme === 'light' || theme === 'dark' || theme === 'system') return theme
  return null
}

export async function saveUserTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return
  const { error } = await sb.from('user_prefs').upsert({
    user_id: user.id,
    theme,
    updated_at: new Date().toISOString(),
  })
  if (error) console.warn('user_prefs save:', error.message)
}

export async function fetchPlateCount(
  eventId: string,
  countedAt = germanyTodayYmd(),
): Promise<PlateCountRow | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb
    .from('plate_counts')
    .select('event_id, counted_at, plates, plate_price, note')
    .eq('event_id', eventId)
    .eq('counted_at', countedAt)
    .maybeSingle()
  if (error) {
    console.warn('plate_counts:', error.message)
    return null
  }
  if (!data) return null
  return {
    eventId: data.event_id as string,
    countedAt: data.counted_at as string,
    plates: Number(data.plates) || 0,
    platePrice: Number(data.plate_price) || 8,
    note: (data.note as string | null) || undefined,
  }
}

export async function upsertPlateCount(row: PlateCountRow): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase is not configured')
  const {
    data: { user },
  } = await sb.auth.getUser()
  const { error } = await sb.from('plate_counts').upsert(
    {
      event_id: row.eventId,
      counted_at: row.countedAt,
      plates: row.plates,
      plate_price: row.platePrice,
      note: row.note ?? null,
      created_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id,counted_at' },
  )
  if (error) throw new Error(error.message)
}
