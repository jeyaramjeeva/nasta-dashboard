/** Last-used login person (name) on this device. */

const LAST_KEY = 'nasta-login-last-person-v1'

export function getLastLoginPerson(): string | null {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}

export function setLastLoginPerson(name: string): void {
  try {
    localStorage.setItem(LAST_KEY, name)
  } catch {
    /* ignore */
  }
}
