/** Only these people may use the app. Configure via VITE_ALLOWED_EMAILS. */

import { isDemoMode } from './demoMode'
import { isTillTraining } from './tillTraining'
import { GUEST_EMAIL, GUEST_NAME } from './guestAuth'

export interface AllowedUser {
  email: string
  name: string
}

/**
 * Format: email:Name,email:Name
 * Example: sriram@mail.com:Sriram,sneha@mail.com:Sneha,jeeva@mail.com:Jeeva
 */
const DEFAULT_ALLOWED: AllowedUser[] = [
  { email: 'sriram@nastazentrum.de', name: 'Sriram' },
  { email: 'sneha@nastazentrum.de', name: 'Sneha' },
  { email: 'jeeva@nastazentrum.de', name: 'Jeeva' },
  { email: 'developer@nastazentrum.de', name: 'Developer' },
  { email: GUEST_EMAIL, name: GUEST_NAME },
]

const GUEST_USER: AllowedUser = { email: GUEST_EMAIL, name: GUEST_NAME }
export const DEVELOPER_EMAIL = 'developer@nastazentrum.de'
export const DEVELOPER_NAME = 'Developer'
const DEVELOPER_USER: AllowedUser = {
  email: DEVELOPER_EMAIL,
  name: DEVELOPER_NAME,
}

export function isDeveloperEmail(email: string | undefined | null): boolean {
  return (email || '').trim().toLowerCase() === DEVELOPER_EMAIL
}

export function isDeveloperName(name: string | undefined | null): boolean {
  const n = (name || '').trim().toLowerCase()
  return n === 'developer' || n === 'dev'
}

function withBuiltins(users: AllowedUser[]): AllowedUser[] {
  let out = [...users]
  if (!out.some((u) => u.email === GUEST_EMAIL || u.name.toLowerCase() === 'guest')) {
    out = [...out, GUEST_USER]
  }
  if (
    !out.some(
      (u) =>
        u.email === DEVELOPER_USER.email || u.name.trim().toLowerCase() === 'developer',
    )
  ) {
    out = [...out, DEVELOPER_USER]
  }
  return out
}

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
  return withBuiltins(parseEnvAllowlist() ?? DEFAULT_ALLOWED)
}

export function findAllowedUser(email: string | undefined | null): AllowedUser | null {
  if (!email) return null
  const key = email.trim().toLowerCase()
  return getAllowedUsers().find((u) => u.email === key) ?? null
}

export function isEmailAllowed(email: string | undefined | null): boolean {
  return Boolean(findAllowedUser(email))
}

function roleName(user: { name?: string; email?: string } | null | undefined): string {
  if (!user) return ''
  const n = user.name?.trim().toLowerCase() || ''
  if (n) return n
  return findAllowedUser(user.email)?.name.trim().toLowerCase() || ''
}

/** Site Studio + full customization (Developer account only). */
export function canDevelop(user: { name?: string; email?: string } | null | undefined): boolean {
  if (isDemoMode() && !isTillTraining()) return true
  const n = roleName(user)
  return n === 'developer' || n === 'dev'
}

/** Upload Excel / Quick add / AI Code — Developer account only. */
export function canManageUploads(user: { name?: string; email?: string } | null | undefined): boolean {
  if (isDemoMode() && !isTillTraining()) return true
  return canDevelop(user)
}

/** Add/edit stall events, status, and calendar notes — Sriram only. */
export function canManageStallEvents(
  user: { name?: string; email?: string } | null | undefined,
): boolean {
  return roleName(user) === 'sriram'
}

/** Sriram / Sneha / Jeeva / Developer — in-app AI helper (no code edits). */
export function canUseAiHelper(user: { name?: string; email?: string } | null | undefined): boolean {
  if (!user) return false
  const n = roleName(user)
  return n === 'sriram' || n === 'sneha' || n === 'jeeva' || n === 'developer' || n === 'dev'
}

/** Cursor cloud agent (code changes) — Developer only. */
export function canUseAiCodeAgent(
  user: { name?: string; email?: string } | null | undefined,
): boolean {
  return canDevelop(user)
}

const JEEVA_EMAILS = new Set(['jeeva@nastazentrum.de', 'jeevajeyaraam@gmail.com'])

/** Market Analysis and other Jeeva-only tools. Developer / Sriram / Sneha / Guest cannot see them. */
export function isJeevaAccount(user: { name?: string; email?: string } | null | undefined): boolean {
  if (!user) return false
  if (roleName(user) === 'jeeva') return true
  const email = (user.email || '').trim().toLowerCase()
  return JEEVA_EMAILS.has(email)
}

export const TEAM_NAMES = ['Sriram', 'Sneha', 'Jeeva', 'Developer'] as const
