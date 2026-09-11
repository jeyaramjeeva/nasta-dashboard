import { getSupabase } from './supabase'

/** Headers for team APIs — Authorization is the access check; name is display-only. */
export async function teamApiHeaders(
  user?: { name?: string; email?: string } | null,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const name = String(user?.name || '').trim()
  const email = String(user?.email || '').trim()
  if (name) headers['x-nasta-name'] = name
  if (email) headers['x-nasta-email'] = email
  const sb = getSupabase()
  if (sb) {
    const { data } = await sb.auth.getSession()
    const token = data.session?.access_token
    if (token) headers.Authorization = `Bearer ${token}`
  }
  return headers
}
