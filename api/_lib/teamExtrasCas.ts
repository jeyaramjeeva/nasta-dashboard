/** Compare-and-swap writes for `team_extras.stall_ops` so guest place/claim
 *  and staff saves cannot silently drop each other’s tickets. */

export type StallOpsBlob = Record<string, unknown>

export class MutateAbort extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'MutateAbort'
    this.status = status
  }
}

type MutateOk<T> = { ok: true; value: T; ops: StallOpsBlob }
type MutateFail = { ok: false; error: string; status?: number }

function asBlob(ops: object): StallOpsBlob {
  return { ...(ops as StallOpsBlob) }
}

function asRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
  }
  if (data && typeof data === 'object') return [data as Record<string, unknown>]
  return []
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function restJson(
  url: string,
  key: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const method = String(init?.method || 'GET').toUpperCase()
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(method === 'GET' ? {} : { Prefer: 'return=representation' }),
      ...(init?.headers || {}),
    },
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const err =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message: string }).message)
        : text || res.statusText
    return { ok: false, status: res.status, data, error: err }
  }
  return { ok: true, status: res.status, data }
}

/**
 * Load latest stall_ops, apply `mutate`, PATCH only if `updated_at` still matches.
 * Empty representation = another writer won — retry on a fresh row.
 */
export async function saveStallOpsMutate<T>(
  url: string,
  key: string,
  mutate: (ops: StallOpsBlob) => { ops: object; value: T },
): Promise<MutateOk<T> | MutateFail> {
  if (!url || !key) return { ok: false, error: 'Supabase not configured', status: 503 }

  for (let attempt = 0; attempt < 8; attempt++) {
    const got = await restJson(
      url,
      key,
      'team_extras?id=eq.latest&select=stall_ops%2Cupdated_at',
    )
    if (!got.ok) return { ok: false, error: got.error || 'Could not load stall state', status: got.status }
    const rows = asRows(got.data)
    const row = (rows[0] || null) as
      | { stall_ops?: StallOpsBlob | null; updated_at?: string | null }
      | null
    if (!row) {
      return {
        ok: false,
        error: 'Stall state is missing.',
        status: 500,
      }
    }

    const current =
      row.stall_ops && typeof row.stall_ops === 'object' ? asBlob(row.stall_ops) : {}
    const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : ''

    let next: { ops: object; value: T }
    try {
      next = mutate(current)
    } catch (e) {
      if (e instanceof MutateAbort) {
        return { ok: false, error: e.message, status: e.status }
      }
      throw e
    }

    const stamp = new Date().toISOString()
    const filter = updatedAt
      ? `team_extras?id=eq.latest&updated_at=eq.${encodeURIComponent(updatedAt)}`
      : 'team_extras?id=eq.latest'
    const patched = await restJson(url, key, filter, {
      method: 'PATCH',
      body: JSON.stringify({ stall_ops: next.ops, updated_at: stamp }),
    })
    if (!patched.ok) return { ok: false, error: patched.error || 'Could not save stall state', status: patched.status }
    const written = asRows(patched.data)
    if (written.length > 0) return { ok: true, value: next.value, ops: asBlob(next.ops) }
    await sleep(40 * (attempt + 1))
  }

  return { ok: false, error: 'Stall sync is busy — try again.', status: 409 }
}
