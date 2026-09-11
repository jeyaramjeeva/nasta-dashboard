import type { VercelRequest } from '@vercel/node'

export type TeamRole = 'Jeeva' | 'Sriram' | 'Sneha' | 'Developer' | 'Guest' | 'Other'

export interface Caller {
  name: string
  email: string
  role: TeamRole
}

const TEAM: Caller[] = [
  { email: 'jeeva@nastazentrum.de', name: 'Jeeva', role: 'Jeeva' },
  { email: 'sriram@nastazentrum.de', name: 'Sriram', role: 'Sriram' },
  { email: 'sneha@nastazentrum.de', name: 'Sneha', role: 'Sneha' },
  { email: 'developer@nastazentrum.de', name: 'Developer', role: 'Developer' },
  { email: 'guest@nastazentrum.de', name: 'Guest', role: 'Guest' },
]

export const TEAM_API_CORS_HEADERS =
  'Content-Type, Authorization, x-nasta-name, x-nasta-email'

function supabaseAuthEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  return { url, anon }
}

export async function emailFromBearer(req: VercelRequest): Promise<string | null> {
  const raw = String(req.headers.authorization || '')
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : ''
  if (!token) return null
  const { url, anon } = supabaseAuthEnv()
  if (!url || !anon) return null
  const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { email?: string }
  const email = String(data.email || '').trim().toLowerCase()
  return email.includes('@') ? email : null
}

function callerFromEmail(email: string): Caller | null {
  const hit = TEAM.find((u) => u.email === email.trim().toLowerCase())
  if (!hit || hit.role === 'Guest' || hit.role === 'Other') return null
  return hit
}

/**
 * Authorize team APIs from the Supabase JWT only.
 * Name/email headers are ignored for access control.
 */
export async function readCaller(req: VercelRequest): Promise<Caller | null> {
  const email = await emailFromBearer(req)
  if (!email) return null
  return callerFromEmail(email)
}

export function json(res: import('@vercel/node').VercelResponse, status: number, data: unknown) {
  res.status(status).json(data)
}
