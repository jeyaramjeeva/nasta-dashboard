/** After a deploy, old tabs still request deleted Vite chunks. Reload once. */

const RELOAD_KEY = 'nasta-stale-chunk-reload'

export function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '')
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
    msg,
  )
}

export function reloadOnceForStaleChunk(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false
    sessionStorage.setItem(RELOAD_KEY, '1')
  } catch {
    /* private mode */
  }
  window.location.reload()
  return true
}

export function installStaleChunkReload() {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    reloadOnceForStaleChunk()
  })
}
