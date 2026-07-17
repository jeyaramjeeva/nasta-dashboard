import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SnapshotVersion } from './history'
import type { Snapshot } from '../types'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let client: SupabaseClient | null = null

export function isCloudConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

export function getSupabase(): SupabaseClient | null {
  if (!isCloudConfigured()) return null
  if (!client) client = createClient(supabaseUrl!, supabaseAnonKey!)
  return client
}

const TABLE = 'snapshots'
const VERSIONS = 'snapshot_versions'

export async function fetchLatestSnapshot(): Promise<Snapshot | null> {
  const sb = getSupabase()
  if (!sb) return null

  const { data, error } = await sb
    .from(TABLE)
    .select('payload, uploaded_at')
    .eq('id', 'latest')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.payload) return null
  return data.payload as Snapshot
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase is not configured')

  const { error } = await sb.from(TABLE).upsert({
    id: 'latest',
    payload: snapshot,
    uploaded_at: snapshot.uploadedAt,
  })

  if (error) throw new Error(error.message)
}

export async function saveSnapshotVersion(
  version: Omit<SnapshotVersion, 'id'> & { id?: string },
): Promise<SnapshotVersion> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase is not configured')

  // Let Postgres generate uuid — local string ids are not valid UUIDs
  const row = {
    created_at: version.createdAt,
    source_file: version.sourceFile,
    mode: version.mode,
    note: version.note ?? null,
    summary: version.summary,
    payload: version.payload,
  }

  const { data, error } = await sb.from(VERSIONS).insert(row).select('id').single()
  if (error) throw new Error(error.message)

  return {
    id: data.id as string,
    createdAt: version.createdAt,
    sourceFile: version.sourceFile,
    mode: version.mode,
    note: version.note,
    summary: version.summary,
    payload: version.payload,
  }
}

export async function fetchSnapshotVersions(limit = 20): Promise<SnapshotVersion[]> {
  const sb = getSupabase()
  if (!sb) return []

  const { data, error } = await sb
    .from(VERSIONS)
    .select('id, created_at, source_file, mode, note, summary, payload')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    // Table may not exist yet
    console.warn(error.message)
    return []
  }

  return (data || []).map((row) => ({
    id: row.id as string,
    createdAt: row.created_at as string,
    sourceFile: row.source_file as string,
    mode: row.mode as SnapshotVersion['mode'],
    note: (row.note as string | null) ?? undefined,
    summary: row.summary as SnapshotVersion['summary'],
    payload: row.payload as Snapshot,
  }))
}

export async function fetchSnapshotVersion(id: string): Promise<SnapshotVersion | null> {
  const sb = getSupabase()
  if (!sb) return null

  const { data, error } = await sb
    .from(VERSIONS)
    .select('id, created_at, source_file, mode, note, summary, payload')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: data.id as string,
    createdAt: data.created_at as string,
    sourceFile: data.source_file as string,
    mode: data.mode as SnapshotVersion['mode'],
    note: (data.note as string | null) ?? undefined,
    summary: data.summary as SnapshotVersion['summary'],
    payload: data.payload as Snapshot,
  }
}

export function checkUploadPassword(password: string): boolean {
  const expected = import.meta.env.VITE_UPLOAD_PASSWORD as string | undefined
  if (!expected) {
    return password === 'Nasta998#'
  }
  return password === expected
}
