/** Per-user 4-digit PIN — stored on the account (cloud), cached locally for offline. */

import { getSupabase, isCloudConfigured } from './supabase'
import { teamApiHeaders } from './teamApiHeaders'

const STORE_KEY = 'nasta-login-pins-v1'
const ENROLL_KEY = 'nasta-pin-enroll-v1'
const SKIP_SESSION_KEY = 'nasta-pin-enroll-skip-session-v1'

export const LOGIN_PIN_DIGITS = 4

export interface PinEnrollPending {
  accountKey: string
  name: string
  password: string
  cloud: boolean
  email: string
}

export interface PinVault {
  salt: string
  pinHash: string
  iv: string
  encPassword: string
  updatedAt: string
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

function b64ToBuf(b64: string): ArrayBuffer {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes.buffer
}

function readAll(): Record<string, PinVault & { accountKey?: string }> {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, PinVault & { accountKey?: string }>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, PinVault & { accountKey?: string }>) {
  localStorage.setItem(STORE_KEY, JSON.stringify(map))
}

function cacheVault(accountKey: string, vault: PinVault) {
  const map = readAll()
  map[accountKey] = { ...vault, accountKey }
  writeAll(map)
}

async function deriveKey(pin: string, saltB64: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: b64ToBuf(saltB64),
      iterations: 40_000,
      hash: 'SHA-256',
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function hashPin(pin: string, saltB64: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(`${saltB64}:${pin}`)
  const dig = await crypto.subtle.digest('SHA-256', data)
  return bufToB64(dig)
}

function normalizePin(pin: string): string {
  return pin.replace(/\D/g, '').slice(0, LOGIN_PIN_DIGITS)
}

function assertPin(pin: string): string {
  const digits = normalizePin(pin)
  if (digits.length !== LOGIN_PIN_DIGITS) {
    throw new Error(`PIN must be ${LOGIN_PIN_DIGITS} digits.`)
  }
  return digits
}

export function accountKeyFor(opts: { cloud: boolean; email: string; name: string }): string {
  return opts.cloud ? opts.email.trim().toLowerCase() : `local:${opts.name}`
}

/** Local cache only — prefer `fetchAccountHasPin` on the login screen. */
export function hasLocalLoginPin(accountKey: string): boolean {
  return Boolean(readAll()[accountKey]?.encPassword)
}

const HINT_KEY = 'nasta-login-pin-hint-v1'

function readPinHintMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(HINT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Last known PIN-or-not for this account on this device (avoids login field flash). */
export function accountPinHint(accountKey: string): boolean | null {
  if (hasLocalLoginPin(accountKey)) return true
  const map = readPinHintMap()
  if (Object.prototype.hasOwnProperty.call(map, accountKey)) return Boolean(map[accountKey])
  return null
}

export function rememberAccountPinHint(accountKey: string, hasPin: boolean): void {
  const key = String(accountKey || '').trim()
  if (!key) return
  const map = readPinHintMap()
  map[key] = hasPin
  try {
    localStorage.setItem(HINT_KEY, JSON.stringify(map))
  } catch {
    /* quota */
  }
}

/** @deprecated use hasLocalLoginPin / fetchAccountHasPin */
export function hasLoginPin(accountKey: string): boolean {
  return hasLocalLoginPin(accountKey)
}

export function skipPinEnroll(_accountKey?: string): void {
  try {
    sessionStorage.setItem(SKIP_SESSION_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function isPinSkipped(_accountKey?: string): boolean {
  try {
    return sessionStorage.getItem(SKIP_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function clearPinSkip(_accountKey?: string): void {
  try {
    sessionStorage.removeItem(SKIP_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

async function buildVault(pin: string, password: string): Promise<PinVault> {
  const digits = assertPin(pin)
  const salt = bufToB64(crypto.getRandomValues(new Uint8Array(16)).buffer)
  const iv = bufToB64(crypto.getRandomValues(new Uint8Array(12)).buffer)
  const key = await deriveKey(digits, salt)
  const enc = new TextEncoder()
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(iv)) },
    key,
    enc.encode(password),
  )
  return {
    salt,
    pinHash: await hashPin(digits, salt),
    iv,
    encPassword: bufToB64(cipher),
    updatedAt: new Date().toISOString(),
  }
}

async function decryptVault(pin: string, rec: PinVault): Promise<string> {
  const digits = assertPin(pin)
  const pinHash = await hashPin(digits, rec.salt)
  if (pinHash !== rec.pinHash) throw new Error('Wrong PIN.')
  const key = await deriveKey(digits, rec.salt)
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(rec.iv)) },
      key,
      b64ToBuf(rec.encPassword),
    )
    return new TextDecoder().decode(plain)
  } catch {
    throw new Error('Wrong PIN.')
  }
}

async function pinApi(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const headers = await teamApiHeaders()
  const res = await fetch('/api/login-pin', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    data = {}
  }
  return { ok: res.ok, status: res.status, data }
}

export async function fetchTeamPinStatus(): Promise<Record<string, boolean>> {
  try {
    const res = await fetch('/api/login-pin?all=1', { headers: await teamApiHeaders() })
    if (!res.ok) return {}
    const data = (await res.json()) as { pins?: Record<string, boolean> }
    return data.pins && typeof data.pins === 'object' ? data.pins : {}
  } catch {
    return {}
  }
}

/** Cloud (or local-only) — null if we could not ask the server (offline). */
export async function fetchAccountHasPin(accountKey: string): Promise<boolean | null> {
  if (!accountKey.includes('@') || !isCloudConfigured()) {
    const has = hasLocalLoginPin(accountKey)
    rememberAccountPinHint(accountKey, has)
    return has
  }
  try {
    const res = await fetch(`/api/login-pin?key=${encodeURIComponent(accountKey)}`)
    if (!res.ok) {
      const local = hasLocalLoginPin(accountKey)
      if (local) rememberAccountPinHint(accountKey, true)
      return local ? true : null
    }
    const data = (await res.json()) as { hasPin?: boolean }
    if (data.hasPin) {
      rememberAccountPinHint(accountKey, true)
      return true
    }
    if (hasLocalLoginPin(accountKey)) clearLoginPin(accountKey)
    rememberAccountPinHint(accountKey, false)
    return false
  } catch {
    const local = hasLocalLoginPin(accountKey)
    if (local) rememberAccountPinHint(accountKey, true)
    return local ? true : null
  }
}

export async function saveLoginPin(
  accountKey: string,
  pin: string,
  password: string,
): Promise<void> {
  const vault = await buildVault(pin, password)
  cacheVault(accountKey, vault)
  clearPinSkip(accountKey)
  rememberAccountPinHint(accountKey, true)

  if (!accountKey.includes('@') || !isCloudConfigured()) return

  const sb = getSupabase()
  if (sb) {
    await sb.auth.updateUser({ data: { nastaLoginPin: vault } }).catch(() => undefined)
  }

  const saved = await pinApi({
    action: 'save',
    accountKey,
    password,
    record: vault,
  })
  if (!saved.ok) {
    throw new Error(
      typeof saved.data.error === 'string'
        ? saved.data.error
        : 'Could not save PIN to your account.',
    )
  }
}

export async function unlockAccountWithPin(
  accountKey: string,
  pin: string,
): Promise<{ password?: string; access_token?: string; refresh_token?: string }> {
  const digits = assertPin(pin)

  if (accountKey.includes('@') && isCloudConfigured() && navigator.onLine) {
    const unlocked = await pinApi({ action: 'unlock', accountKey, pin: digits })
    if (unlocked.ok) {
      const access_token =
        typeof unlocked.data.access_token === 'string' ? unlocked.data.access_token : ''
      const refresh_token =
        typeof unlocked.data.refresh_token === 'string' ? unlocked.data.refresh_token : ''
      if (access_token && refresh_token) return { access_token, refresh_token }
      if (typeof unlocked.data.password === 'string' && unlocked.data.password) {
        return { password: unlocked.data.password }
      }
    }
    if (unlocked.status === 404) {
      clearLoginPin(accountKey)
      throw new Error('No PIN set for this account. Use your password.')
    }
    if (unlocked.status !== 0 && unlocked.data.error) {
      const local = readAll()[accountKey]
      if (local) {
        try {
          return { password: await decryptVault(digits, local) }
        } catch {
          /* use server message */
        }
      }
      throw new Error(
        typeof unlocked.data.error === 'string' ? unlocked.data.error : 'Wrong PIN.',
      )
    }
  }

  const rec = readAll()[accountKey]
  if (!rec) throw new Error('No PIN set for this account. Use your password.')
  return { password: await decryptVault(digits, rec) }
}

export async function unlockPasswordWithPin(
  accountKey: string,
  pin: string,
): Promise<string> {
  const unlocked = await unlockAccountWithPin(accountKey, pin)
  if (unlocked.password) return unlocked.password
  throw new Error('PIN unlocked in the cloud — refresh and try password if login did not finish.')
}

export function clearLoginPin(accountKey: string): void {
  const map = readAll()
  delete map[accountKey]
  writeAll(map)
  rememberAccountPinHint(accountKey, false)
}

export async function clearAccountPin(accountKey: string, password: string): Promise<void> {
  clearLoginPin(accountKey)
  if (!accountKey.includes('@') || !isCloudConfigured()) return
  const sb = getSupabase()
  if (sb) {
    await sb.auth.updateUser({ data: { nastaLoginPin: null } }).catch(() => undefined)
  }
  await pinApi({ action: 'delete', accountKey, password })
}

export function setPinEnrollPending(pending: PinEnrollPending): void {
  sessionStorage.setItem(ENROLL_KEY, JSON.stringify(pending))
}

export function peekPinEnrollPending(): PinEnrollPending | null {
  try {
    const raw = sessionStorage.getItem(ENROLL_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PinEnrollPending
  } catch {
    return null
  }
}

export function clearPinEnrollPending(): void {
  sessionStorage.removeItem(ENROLL_KEY)
}
