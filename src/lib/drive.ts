export type DriveProvider = 'google' | 'onedrive' | 'direct' | 'unknown'

export interface DriveLinkInfo {
  provider: DriveProvider
  inputUrl: string
  downloadUrl: string | null
  fileId: string | null
  hint: string
}

const SETTINGS_KEY = 'nasta-drive-settings-v1'

export interface DriveSettings {
  url: string
  lastPulledAt: string | null
  autoRemindDays: number
}

export function loadDriveSettings(): DriveSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { url: '', lastPulledAt: null, autoRemindDays: 7 }
    return { url: '', lastPulledAt: null, autoRemindDays: 7, ...JSON.parse(raw) }
  } catch {
    return { url: '', lastPulledAt: null, autoRemindDays: 7 }
  }
}

export function saveDriveSettings(settings: DriveSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

/** OneDrive public share → direct content URL (works server-side; browser may still CORS). */
export function toOneDriveContentUrl(shareUrl: string): string {
  const trimmed = shareUrl.trim()
  // base64url without padding
  const bytes = new TextEncoder().encode(trimmed)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  const b64 = btoa(binary).replace(/=+$/g, '').replace(/\//g, '_').replace(/\+/g, '-')
  return `https://api.onedrive.com/v1.0/shares/u!${b64}/root/content`
}

export function parseDriveLink(input: string): DriveLinkInfo {
  const url = input.trim()
  if (!url) {
    return {
      provider: 'unknown',
      inputUrl: url,
      downloadUrl: null,
      fileId: null,
      hint: 'Paste a Google Drive or OneDrive share link',
    }
  }

  // Google Drive: /file/d/FILE_ID/ or open?id=FILE_ID
  const g1 = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i)
  const g2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if ((g1 || g2) && /drive\.google\.com|docs\.google\.com/i.test(url)) {
    const fileId = (g1?.[1] || g2?.[1]) ?? null
    return {
      provider: 'google',
      inputUrl: url,
      fileId,
      downloadUrl: fileId
        ? `https://drive.google.com/uc?export=download&id=${fileId}`
        : null,
      hint: 'File must be “Anyone with the link”. Browser pull needs Supabase pull-excel (CORS).',
    }
  }

  // OneDrive / SharePoint short + long links
  if (/1drv\.ms|onedrive\.live\.com|sharepoint\.com/i.test(url)) {
    return {
      provider: 'onedrive',
      inputUrl: url,
      fileId: null,
      downloadUrl: toOneDriveContentUrl(url),
      hint: 'Share as “Anyone with the link”. OneDrive blocks browser downloads — use Supabase pull-excel or upload the .xlsx file.',
    }
  }

  // Direct .xlsx URL
  if (/^https?:\/\//i.test(url) && /\.xlsx(\?|$)/i.test(url)) {
    return {
      provider: 'direct',
      inputUrl: url,
      fileId: null,
      downloadUrl: url,
      hint: 'Direct file URL — will try browser fetch, then cloud helper.',
    }
  }

  return {
    provider: 'unknown',
    inputUrl: url,
    downloadUrl: url.startsWith('http') ? url : null,
    fileId: null,
    hint: 'Unrecognized link. Use Google Drive share, OneDrive share, or a direct .xlsx URL.',
  }
}

function networkFailMessage(cloudTried: boolean): string {
  if (cloudTried) {
    return 'Could not reach the pull helper (Failed to fetch). Check VITE_SUPABASE_URL / anon key, and that pull-excel is deployed.'
  }
  return (
    'OneDrive/Google block browser downloads (Failed to fetch / CORS). ' +
    'Fix: (1) Upload the .xlsx file on the left, or (2) add Supabase env + deploy supabase/functions/pull-excel.'
  )
}

export async function fetchExcelFromUrl(
  shareOrDownloadUrl: string,
  opts?: { supabaseUrl?: string; anonKey?: string },
): Promise<ArrayBuffer> {
  const cloudReady = Boolean(opts?.supabaseUrl && opts?.anonKey)
  const info = parseDriveLink(shareOrDownloadUrl)
  const directUrl = info.downloadUrl || shareOrDownloadUrl
  // Edge function should get the original share link so it can resolve OneDrive/Google
  const cloudUrl = info.inputUrl || shareOrDownloadUrl

  // Prefer Supabase Edge Function (no CORS issues)
  if (cloudReady) {
    const endpoint = `${opts!.supabaseUrl!.replace(/\/$/, '')}/functions/v1/pull-excel`
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opts!.anonKey}`,
          apikey: opts!.anonKey!,
        },
        body: JSON.stringify({ url: cloudUrl }),
      })
      if (res.ok) {
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const json = (await res.json()) as { base64?: string; error?: string }
          if (json.error) throw new Error(json.error)
          if (json.base64) {
            const bin = atob(json.base64)
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            return bytes.buffer as ArrayBuffer
          }
        }
        return res.arrayBuffer()
      }
      // fall through to direct if function missing
      if (res.status !== 404) {
        let detail = ''
        try {
          const j = (await res.json()) as { error?: string }
          detail = j.error || ''
        } catch {
          detail = await res.text()
        }
        throw new Error(detail || `Drive pull failed (${res.status})`)
      }
    } catch (e) {
      if (e instanceof Error && !/Failed to fetch|NetworkError|Load failed/i.test(e.message)) {
        throw e
      }
      try {
        return await fetchDirect(directUrl)
      } catch {
        throw new Error(networkFailMessage(true))
      }
    }
  }

  try {
    return await fetchDirect(directUrl)
  } catch (e) {
    if (e instanceof Error && !/Failed to fetch|NetworkError|Load failed/i.test(e.message)) {
      throw e
    }
    throw new Error(networkFailMessage(false))
  }
}

async function fetchDirect(downloadUrl: string): Promise<ArrayBuffer> {
  const direct = await fetch(downloadUrl, { redirect: 'follow' })
  if (!direct.ok) {
    throw new Error(
      `Could not download file (${direct.status}). Share publicly, or deploy pull-excel / upload the file.`,
    )
  }
  const buf = await direct.arrayBuffer()
  if (buf.byteLength < 100) {
    throw new Error('Downloaded file looks empty — check sharing permissions.')
  }
  // Reject HTML login pages mistaken for xlsx
  const head = new Uint8Array(buf.slice(0, 8))
  const asText = String.fromCharCode(...head)
  if (asText.startsWith('<!') || asText.startsWith('<html')) {
    throw new Error(
      'Got an HTML page instead of Excel — link is not publicly downloadable. Use “Anyone with the link” or upload the file.',
    )
  }
  return buf
}

export function isPullDue(settings: DriveSettings): boolean {
  if (!settings.url || !settings.lastPulledAt) return Boolean(settings.url)
  const last = new Date(settings.lastPulledAt).getTime()
  const days = settings.autoRemindDays || 7
  return Date.now() - last > days * 86400000
}
