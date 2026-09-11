/** Event-type keys a public-menu price patch may touch. Empty = do not fan out. */
export function eventKeysForMenuPatch(
  scopeKey: string | undefined,
  _allKeys?: string[],
): string[] {
  const key = String(scopeKey || '').trim()
  return key ? [key] : []
}

/** Guest place must name a stall; never fall back to staff activeEventId. */
export function requirePlaceEventId(eventId: string | undefined | null): string | null {
  const id = String(eventId || '').trim()
  return id ? id : null
}
