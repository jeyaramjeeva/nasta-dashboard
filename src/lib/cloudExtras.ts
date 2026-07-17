import type { DriveSettings } from './drive'
import type { InventoryItemDef, InventoryLine, WeatherTag } from './extrasStore'
import { getSupabase, isCloudConfigured } from './supabase'
import { germanyTodayYmd } from './germanyTime'
import type { StallOpsState } from './stallOps'
import { emptyStallOps, loadStallOps, normalizeStallOps, saveStallOpsLocal } from './stallOps'

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

export async function fetchTeamExtras(): Promise<TeamExtrasPayload | null> {
  const sb = getSupabase()
  if (!sb || !isCloudConfigured()) return null
  const { data, error } = await sb
    .from('team_extras')
    .select(
      'weather, inventory_defs, inventory_events, mission, drive_settings, stall_ops, updated_at',
    )
    .eq('id', 'latest')
    .maybeSingle()
  if (error) {
    console.warn('team_extras:', error.message)
    return null
  }
  if (!data) return null
  return {
    weather: (data.weather || {}) as Record<string, WeatherTag>,
    inventoryDefs: (data.inventory_defs || []) as InventoryItemDef[],
    inventoryEvents: (data.inventory_events || {}) as Record<string, InventoryLine[]>,
    mission: (data.mission as string | null) || '',
    driveSettings: (data.drive_settings as DriveSettings | null) ?? null,
    stallOps: (data.stall_ops as StallOpsState | null) ?? null,
    updatedAt: data.updated_at as string,
  }
}

export async function saveTeamExtras(payload: TeamExtrasPayload): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase is not configured')
  const {
    data: { user },
  } = await sb.auth.getUser()
  const stallOps = payload.stallOps ?? loadStallOps()
  const { error } = await sb.from('team_extras').upsert({
    id: 'latest',
    weather: payload.weather,
    inventory_defs: payload.inventoryDefs,
    inventory_events: payload.inventoryEvents,
    mission: payload.mission || null,
    drive_settings: payload.driveSettings ?? null,
    stall_ops: stallOps,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function fetchStallOps(): Promise<StallOpsState | null> {
  const extras = await fetchTeamExtras()
  if (!extras) return null
  if (extras.stallOps && (extras.stallOps.stock?.length || extras.stallOps.menu?.length)) {
    return normalizeStallOps({
      ...emptyStallOps(),
      ...extras.stallOps,
      stock: extras.stallOps.stock?.length ? extras.stallOps.stock : emptyStallOps().stock,
    })
  }
  return null
}

export async function saveStallOpsCloud(ops: StallOpsState): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase is not configured')
  saveStallOpsLocal(ops)
  const {
    data: { user },
  } = await sb.auth.getUser()
  const existing = await sb.from('team_extras').select('id').eq('id', 'latest').maybeSingle()
  if (existing.data) {
    const { error } = await sb
      .from('team_extras')
      .update({
        stall_ops: ops,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq('id', 'latest')
    if (error) throw new Error(error.message)
    return
  }
  const { error } = await sb.from('team_extras').insert({
    id: 'latest',
    stall_ops: ops,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  })
  if (error) throw new Error(error.message)
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
