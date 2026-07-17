// Deploy: supabase functions deploy pull-excel --no-verify-jwt
// (or enable JWT and pass anon key from the app — app already sends Authorization)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function toOneDriveContentUrl(shareUrl: string): string {
  const bytes = new TextEncoder().encode(shareUrl.trim())
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  const b64 = btoa(binary).replace(/=+$/g, '').replace(/\//g, '_').replace(/\+/g, '-')
  return `https://api.onedrive.com/v1.0/shares/u!${b64}/root/content`
}

function resolveDownloadUrl(url: string): string[] {
  const candidates = [url]
  if (/1drv\.ms|onedrive\.live\.com|sharepoint\.com/i.test(url)) {
    candidates.unshift(toOneDriveContentUrl(url))
  }
  if (/drive\.google\.com\/file\/d\//i.test(url)) {
    const m = url.match(/\/file\/d\/([^/]+)/i)
    if (m?.[1]) {
      candidates.unshift(`https://drive.google.com/uc?export=download&id=${m[1]}`)
    }
  }
  return [...new Set(candidates)]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const body = (await req.json()) as { url?: string }
    const url = body.url?.trim()
    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: 'Valid https url required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    let lastStatus = 0
    let buf: Uint8Array | null = null
    for (const candidate of resolveDownloadUrl(url)) {
      const upstream = await fetch(candidate, {
        redirect: 'follow',
        headers: { 'User-Agent': 'NastaZentrumPull/1.0' },
      })
      lastStatus = upstream.status
      if (!upstream.ok) continue
      const next = new Uint8Array(await upstream.arrayBuffer())
      if (next.byteLength < 100) continue
      const head = String.fromCharCode(...next.slice(0, 15))
      if (head.startsWith('<!') || head.toLowerCase().startsWith('<html')) continue
      buf = next
      break
    }

    if (!buf) {
      return new Response(
        JSON.stringify({
          error: `Upstream download failed (${lastStatus || 'no response'}). Share as Anyone with the link.`,
        }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    let binary = ''
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]!)
    const base64 = btoa(binary)

    return new Response(JSON.stringify({ base64, bytes: buf.byteLength }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Pull failed' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
})
