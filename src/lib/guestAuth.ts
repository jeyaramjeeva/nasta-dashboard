/** Shared “helper / guest” login — same screens as Stall mode, no money pages. */

export const GUEST_NAME = 'Guest'
export const GUEST_EMAIL = 'guest@nastazentrum.de'

/** Default guest password (override with VITE_GUEST_PASSWORD on Vercel). */
export const DEFAULT_GUEST_PASSWORD = 'Guest9987'

export function getGuestPassword(): string {
  const fromEnv = (import.meta.env.VITE_GUEST_PASSWORD as string | undefined)?.trim()
  return fromEnv || DEFAULT_GUEST_PASSWORD
}

export function checkGuestPassword(password: string): boolean {
  return password === getGuestPassword()
}

export function isGuestName(name: string | undefined | null): boolean {
  return (name || '').trim().toLowerCase() === GUEST_NAME.toLowerCase()
}

export function isGuestEmail(email: string | undefined | null): boolean {
  return (email || '').trim().toLowerCase() === GUEST_EMAIL
}

export function isGuestUser(user: { name?: string; email?: string } | null | undefined): boolean {
  if (!user) return false
  return isGuestName(user.name) || isGuestEmail(user.email)
}
