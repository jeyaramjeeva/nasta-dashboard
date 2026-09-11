/**
 * Patch / reorder / add dishes on the public `/order` catalog via the server.
 */

import { fetchStallOps } from './cloudExtras'
import { teamApiHeaders } from './teamApiHeaders'
import {
  loadStallOps,
  saveStallOpsLocal,
  type MenuItem,
  type StallOpsState,
} from './stallOps'

export type PublicMenuSection = 'combos' | 'mains' | 'snacks' | 'drinks'

export type PublicMenuPatch = Partial<
  Pick<
    MenuItem,
    | 'name'
    | 'nameDe'
    | 'contents'
    | 'contentsDe'
    | 'description'
    | 'descriptionDe'
    | 'ingredients'
    | 'ingredientsDe'
    | 'vegan'
    | 'vegetarian'
    | 'glutenFree'
    | 'imageUrl'
    | 'price'
    | 'priceWithChai'
    | 'priceWithLassi'
    | 'kind'
  >
> & {
  publicSection?: PublicMenuSection
  hideFromCustomer?: boolean
}

export type PublicMenuAuth = {
  name: string
  email?: string
}

export type PublicMenuItemDto = {
  id: string
  name: string
  nameDe?: string
  kind: 'single' | 'combo'
  publicSection?: PublicMenuSection
  price: number
  priceWithChai?: number
  priceWithLassi?: number
  contents?: string
  contentsDe?: string
  description?: string
  descriptionDe?: string
  ingredients?: string
  ingredientsDe?: string
  imageUrl?: string
  vegan?: boolean
  vegetarian?: boolean
  glutenFree?: boolean
}

async function postMenuAction(
  auth: PublicMenuAuth,
  body: Record<string, unknown>,
): Promise<PublicMenuItemDto[]> {
  const name = String(auth?.name || '').trim()
  if (!name) throw new Error('Team login required to edit the customer menu.')
  const res = await fetch('/api/customer-order', {
    method: 'POST',
    headers: await teamApiHeaders({ name, email: auth?.email }),
    body: JSON.stringify({
      ...body,
      userName: name,
      userEmail: String(auth?.email || ''),
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    ok?: boolean
    menu?: PublicMenuItemDto[]
  }
  if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`)
  return Array.isArray(data.menu) ? data.menu : []
}

function applyPatch(m: MenuItem, patch: PublicMenuPatch): MenuItem {
  const next: MenuItem = { ...m, ...patch, id: m.id }
  if (patch.name != null) next.name = String(patch.name).trim() || m.name
  if (patch.publicSection) {
    next.kind = patch.publicSection === 'combos' ? 'combo' : 'single'
  } else if (patch.kind === 'combo' || patch.kind === 'single') {
    next.kind = patch.kind
  }
  if (patch.price != null) next.price = Math.max(0, Number(patch.price) || 0)
  if (patch.priceWithChai != null) {
    next.priceWithChai = Math.max(0, Number(patch.priceWithChai) || 0)
  }
  if (patch.priceWithLassi != null) {
    next.priceWithLassi = Math.max(0, Number(patch.priceWithLassi) || 0)
  }
  if (patch.imageUrl !== undefined) {
    const img = String(patch.imageUrl || '').trim()
    next.imageUrl = img || undefined
  }
  return next
}

function mirrorPatchLocal(
  base: StallOpsState,
  id: string,
  patch: PublicMenuPatch,
  menuKey?: string,
): StallOpsState {
  const mapList = (list: MenuItem[]) =>
    list.map((m) => (m.id === id ? applyPatch(m, patch) : m))
  const eventMenus: StallOpsState['eventMenus'] = { ...(base.eventMenus || {}) }
  const scope = String(menuKey || '').trim()
  if (scope && Array.isArray(eventMenus[scope])) {
    eventMenus[scope] = mapList(eventMenus[scope]!)
  }
  const touchesPrice =
    patch.price != null || patch.priceWithChai != null || patch.priceWithLassi != null
  return {
    ...base,
    menu: touchesPrice ? base.menu : mapList(base.menu || []),
    eventMenus,
  }
}

async function mirrorFromServer() {
  try {
    const remote = await fetchStallOps()
    if (remote) saveStallOpsLocal(remote)
  } catch {
    /* ignore */
  }
}

export async function patchPublicMenuItem(
  id: string,
  patch: PublicMenuPatch,
  auth?: PublicMenuAuth,
  menuKey?: string,
): Promise<PublicMenuItemDto[]> {
  if (!id) throw new Error('Missing menu item id')
  const menu = await postMenuAction(auth!, {
    action: 'patchMenuItem',
    menuItemId: id,
    patch,
    menuKey: menuKey || undefined,
  })
  try {
    const remote = await fetchStallOps()
    const base = remote || loadStallOps()
    saveStallOpsLocal(mirrorPatchLocal(base, id, patch, menuKey))
  } catch {
    saveStallOpsLocal(mirrorPatchLocal(loadStallOps(), id, patch, menuKey))
  }
  return menu
}

export async function reorderPublicMenu(
  order: string[],
  auth?: PublicMenuAuth,
): Promise<PublicMenuItemDto[]> {
  const menu = await postMenuAction(auth!, { action: 'reorderMenu', order })
  await mirrorFromServer()
  return menu
}

export async function addPublicMenuItem(
  item: {
    name: string
    nameDe?: string
    publicSection: PublicMenuSection
    price?: number
    priceWithChai?: number
    priceWithLassi?: number
    description?: string
    descriptionDe?: string
    vegan?: boolean
    vegetarian?: boolean
    glutenFree?: boolean
  },
  auth?: PublicMenuAuth,
): Promise<PublicMenuItemDto[]> {
  const menu = await postMenuAction(auth!, { action: 'addMenuItem', item })
  await mirrorFromServer()
  return menu
}

export async function removePublicMenuItem(
  id: string,
  auth?: PublicMenuAuth,
): Promise<PublicMenuItemDto[]> {
  const menu = await postMenuAction(auth!, {
    action: 'removeMenuItem',
    menuItemId: id,
  })
  await mirrorFromServer()
  return menu
}
