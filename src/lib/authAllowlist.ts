/** Only these people may use the app. Configure via VITE_ALLOWED_EMAILS. */

import { isDemoMode } from './demoMode'

export interface AllowedUser {
  email: string
  name: string
}

/**
 * Format: email:Name,email:Name
 * Example: jeeva@mail.com:Jeeva,sriram@mail.com:Sriram,sneha@mail.com:Sneha
 */
const DEFAULT_ALLOWED: AllowedUser[] = [
  { email: 'jeeva@nastazentrum.de', name: 'Jeeva' },
  { email: 'sriram@nastazentrum.de', name: 'Sriram' },
  { email: 'sneha@nastazentrum.de', name: 'Sneha' },
]

function parseEnvAllowlist(): AllowedUser[] | null {
  const raw = (import.meta.env.VITE_ALLOWED_EMAILS as string | undefined)?.trim()
  if (!raw) return null
  const out: AllowedUser[] = []
  for (const part of raw.split(',')) {
    const chunk = part.trim()
    if (!chunk) continue
    const [emailPart, namePart] = chunk.split(':')
    const email = (emailPart || '').trim().toLowerCase()
    if (!email.includes('@')) continue
    const name =
      (namePart || '').trim() ||
      email.split('@')[0]?.replace(/^\w/, (c) => c.toUpperCase()) ||
      email
    out.push({ email, name })
  }
  return out.length ? out : null
}

export function getAllowedUsers(): AllowedUser[] {
  return parseEnvAllowlist() ?? DEFAULT_ALLOWED
}

export function findAllowedUser(email: string | undefined | null): AllowedUser | null {
  if (!email) return null
  const key = email.trim().toLowerCase()
  return getAllowedUsers().find((u) => u.email === key) ?? null
}

export function isEmailAllowed(email: string | undefined | null): boolean {
  return Boolean(findAllowedUser(email))
}

/** Only Jeeva may open Upload and publish Excel changes (everyone in demo mode). */
export function canManageUploads(user: { name?: string; email?: string } | null | undefined): boolean {
  if (isDemoMode()) return true
  if (!user) return false
  if (user.name?.trim().toLowerCase() === 'jeeva') return true
  const allowed = findAllowedUser(user.email)
  return allowed?.name.trim().toLowerCase() === 'jeeva'
}

export const TEAM_NAMES = ['Jeeva', 'Sriram', 'Sneha'] as const
