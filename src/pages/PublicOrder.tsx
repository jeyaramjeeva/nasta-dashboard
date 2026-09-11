import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Leaf,
  Minus,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  Utensils,
  WheatOff,
  X,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { springSoft } from '../lib/motion'
import { Link, useSearchParams } from 'react-router-dom'
import { CountUp } from '../components/CountUp'
import { EditableText } from '../components/EditableText'
import { EuroInput } from '../components/EuroInput'
import { StallFinder } from '../components/StallFinder'
import { useAuth } from '../context/AuthContext'
import { useEditUi } from '../context/EditUiContext'
import { formatEuroLabel, parseEuroField, roundEuro } from '../lib/euroAmount'
import { isGuestUser } from '../lib/guestAuth'
import { fileToMenuImageDataUrl } from '../lib/imageDataUrl'
import {
  addPublicMenuItem,
  patchPublicMenuItem,
  removePublicMenuItem,
  reorderPublicMenu,
  type PublicMenuPatch,
  type PublicMenuSection,
} from '../lib/patchPublicMenu'
import {
  loadOrderLang,
  orderCopy,
  saveOrderLang,
  type OrderLang,
} from '../lib/publicOrderI18n'
import { loadLocalSiteConfig } from '../lib/siteConfig'
import type { DrinkChoice } from '../lib/stallOps'

interface PublicMenuItem {
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
  soldOut?: boolean
}

function dishSection(m: PublicMenuItem): PublicMenuSection {
  if (m.publicSection) return m.publicSection
  if (m.kind === 'combo') return 'combos'
  if (isDrinkItem(m)) return 'drinks'
  if (isSnackItem(m)) return 'snacks'
  return 'mains'
}

type CartKey = string
type Cart = Record<CartKey, { menuItemId: string; qty: number; drink?: DrinkChoice }>
type DietFilter = 'all' | 'vegan' | 'glutenFree'

const DRINK_IDS = new Set(['masala-chai', 'mango-lassi'])
const SNACK_IDS = new Set(['gobi-65', 'medu-vada', 'custom-mrwgvuy8-k7m'])

function isSnackItem(m: {
  id: string
  name: string
  nameDe?: string
  publicSection?: PublicMenuSection
}): boolean {
  // Compare via string so tsc never flags narrowed PublicMenuSection unions (TS2367).
  if (m.publicSection != null) return String(m.publicSection) === 'snacks'
  if (SNACK_IDS.has(m.id)) return true
  const n = `${m.name} ${m.nameDe || ''}`.trim().toLowerCase()
  return (
    n.includes('blumenkohl') ||
    n.includes('gobi 65') ||
    n.includes('gobi65') ||
    n.includes('gobi-65') ||
    n.includes('medu vada') ||
    n.includes('meduvada')
  )
}

function isDrinkItem(m: {
  id: string
  name: string
  nameDe?: string
  publicSection?: PublicMenuSection
}): boolean {
  if (m.publicSection != null) return String(m.publicSection) === 'drinks'
  if (DRINK_IDS.has(m.id)) return true
  const n = `${m.name} ${m.nameDe || ''}`.trim().toLowerCase()
  return (
    n === 'masala chai' ||
    n === 'mango lassi' ||
    n === 'mango-lassi' ||
    n === 'masala-chai'
  )
}

function cartKey(id: string, drink?: DrinkChoice) {
  return drink ? `${id}:${drink}` : id
}

function itemPrice(m: PublicMenuItem, drink?: DrinkChoice) {
  if (m.kind === 'combo') {
    if (drink === 'lassi') return Number(m.priceWithLassi ?? m.price) || 0
    return Number(m.priceWithChai ?? m.price) || 0
  }
  return Number(m.price) || 0
}

function localized(
  lang: OrderLang,
  en: string | undefined,
  de: string | undefined,
  fallback = '',
) {
  if (lang === 'de') return (de || en || fallback).trim()
  return (en || de || fallback).trim()
}

type TrackState = {
  status: 'awaiting_claim' | 'pending' | 'completed'
  ahead: number | null
  ticket: string | null
  claimCode: string
  lines: { name: string; qty: number; price: number }[]
}

type DishDraft = {
  name: string
  nameDe: string
  contents: string
  contentsDe: string
  description: string
  descriptionDe: string
  ingredients: string
  ingredientsDe: string
  kind: 'single' | 'combo'
  price: number
  priceWithChai: number
  priceWithLassi: number
  /** Empty string = remove photo on save. */
  imageUrl: string
  publicSection: PublicMenuSection
  vegan: boolean
  vegetarian: boolean
  glutenFree: boolean
  isNew?: boolean
}

export function PublicOrder() {
  const brand = loadLocalSiteConfig().text
  const { user } = useAuth()
  const { editUi, setEditUi, canEditUi } = useEditUi()
  const [params, setParams] = useSearchParams()
  const [lang, setLang] = useState<OrderLang>(() => loadOrderLang())
  const t = orderCopy(lang)
  const [menu, setMenu] = useState<PublicMenuItem[]>([])
  const [menuLabel, setMenuLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cart, setCart] = useState<Cart>({})
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [claimCode, setClaimCode] = useState(params.get('code') || '')
  const [track, setTrack] = useState<TrackState | null>(null)
  const [filter, setFilter] = useState<DietFilter>('all')
  const reduceMotion = useReducedMotion()
  const [editMode, setEditMode] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DishDraft | null>(null)
  const [editBusy, setEditBusy] = useState(false)
  const [imgBusy, setImgBusy] = useState(false)
  const [editMsg, setEditMsg] = useState<string | null>(null)
  const dishImgRef = useRef<HTMLInputElement>(null)
  /** Ignore backdrop click from the same gesture that opened the editor. */
  const ignoreBackdropCloseUntil = useRef(0)

  const typeParam = (params.get('type') || '').trim()
  const eventParam = (params.get('event') || '').trim()
  const isPreview = params.get('preview') === '1'
  const [boundEventId, setBoundEventId] = useState(eventParam)
  const [boundMenuKey, setBoundMenuKey] = useState(typeParam)
  const canStaffEdit = Boolean(user && !isGuestUser(user))
  const showPens = isPreview && editMode && canStaffEdit

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    if (!isPreview) return
    document.title = 'Customer preview · Nasta Zentrum'
    return () => {
      document.title = 'Nasta Zentrum'
    }
  }, [isPreview])

  useEffect(() => {
    if (!isPreview || !editMode) return
    if (canEditUi) setEditUi(true)
  }, [isPreview, editMode, canEditUi, setEditUi])

  function openDishEditor(m: PublicMenuItem) {
    ignoreBackdropCloseUntil.current = Date.now() + 500
    setEditId(m.id)
    setEditMsg(null)
    const price = roundEuro(Number(m.price) || 0)
    const section = dishSection(m)
    setDraft({
      name: m.name || '',
      nameDe: m.nameDe || '',
      contents: m.contents || '',
      contentsDe: m.contentsDe || '',
      description: m.description || '',
      descriptionDe: m.descriptionDe || '',
      ingredients: m.ingredients || '',
      ingredientsDe: m.ingredientsDe || '',
      kind: section === 'combos' ? 'combo' : 'single',
      price,
      priceWithChai: roundEuro(Number(m.priceWithChai ?? m.price) || 0),
      priceWithLassi: roundEuro(Number(m.priceWithLassi ?? m.price) || 0),
      imageUrl: String(m.imageUrl || '').trim(),
      publicSection: section,
      vegan: Boolean(m.vegan),
      vegetarian: Boolean(m.vegetarian || m.vegan),
      glutenFree: Boolean(m.glutenFree),
      isNew: false,
    })
  }

  function openNewDishEditor(section: PublicMenuSection) {
    ignoreBackdropCloseUntil.current = Date.now() + 500
    setEditId(`new-${section}`)
    setEditMsg(null)
    setDraft({
      name: '',
      nameDe: '',
      contents: '',
      contentsDe: '',
      description: '',
      descriptionDe: '',
      ingredients: '',
      ingredientsDe: '',
      kind: section === 'combos' ? 'combo' : 'single',
      price: section === 'drinks' ? 3 : 7,
      priceWithChai: 10,
      priceWithLassi: 11,
      imageUrl: '',
      publicSection: section,
      vegan: false,
      vegetarian: true,
      glutenFree: section === 'mains',
      isNew: true,
    })
  }

  function applyMenuFromServer(next: PublicMenuItem[]) {
    setMenu(next)
  }

  async function moveDish(id: string, dir: 'up' | 'down') {
    if (!user || isGuestUser(user)) return
    const ids = menu.map((m) => m.id)
    const idx = ids.indexOf(id)
    if (idx < 0) return
    const swap = dir === 'up' ? idx - 1 : idx + 1
    if (swap < 0 || swap >= ids.length) return
    const next = [...ids]
    ;[next[idx], next[swap]] = [next[swap]!, next[idx]!]
    setEditBusy(true)
    setEditMsg(null)
    try {
      const updated = await reorderPublicMenu(next, {
        name: user.name,
        email: user.email,
      })
      applyMenuFromServer(updated as PublicMenuItem[])
    } catch (e) {
      setEditMsg(e instanceof Error ? e.message : 'Reorder failed')
    } finally {
      setEditBusy(false)
    }
  }

  async function deleteDish(id: string) {
    if (!user || isGuestUser(user)) return
    const ok = window.confirm(
      lang === 'de' ? 'Gericht von /order entfernen?' : 'Remove this dish from /order?',
    )
    if (!ok) return
    setEditBusy(true)
    try {
      const updated = await removePublicMenuItem(id, {
        name: user.name,
        email: user.email,
      })
      applyMenuFromServer(updated as PublicMenuItem[])
      if (editId === id) closeDishEditor()
    } catch (e) {
      setEditMsg(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setEditBusy(false)
    }
  }

  function closeDishEditor() {
    setEditId(null)
    setDraft(null)
    setEditMsg(null)
    setImgBusy(false)
    if (dishImgRef.current) dishImgRef.current.value = ''
  }

  async function onDishImageFile(file: File | null) {
    if (!file || !draft) return
    setImgBusy(true)
    setEditMsg(null)
    try {
      const dataUrl = await fileToMenuImageDataUrl(file)
      setDraft({ ...draft, imageUrl: dataUrl })
    } catch (e) {
      setEditMsg(
        e instanceof Error
          ? e.message
          : lang === 'de'
            ? 'Foto konnte nicht geladen werden.'
            : 'Could not load photo.',
      )
    } finally {
      setImgBusy(false)
      if (dishImgRef.current) dishImgRef.current.value = ''
    }
  }

  async function saveDishEditor() {
    if (!editId || !draft) return
    if (!draft.name.trim()) {
      setEditMsg(lang === 'de' ? 'Name fehlt.' : 'Name is required.')
      return
    }
    setEditBusy(true)
    setEditMsg(null)
    try {
      if (!user || isGuestUser(user)) {
        throw new Error(
          lang === 'de'
            ? 'Zum Speichern im Team-Tab einloggen (nicht Gast).'
            : 'Sign in on the team tab to save (not Guest).',
        )
      }
      const auth = { name: user.name, email: user.email }
      const section = draft.publicSection
      const isCombo = section === 'combos'
      let updated: PublicMenuItem[]
      if (draft.isNew) {
        updated = (await addPublicMenuItem(
          {
            name: draft.name.trim(),
            nameDe: draft.nameDe.trim() || draft.name.trim(),
            publicSection: section,
            price: isCombo
              ? Math.max(0, parseEuroField(draft.priceWithChai))
              : Math.max(0, parseEuroField(draft.price)),
            priceWithChai: Math.max(0, parseEuroField(draft.priceWithChai)),
            priceWithLassi: Math.max(0, parseEuroField(draft.priceWithLassi)),
            description: draft.description,
            descriptionDe: draft.descriptionDe,
            vegan: draft.vegan,
            vegetarian: draft.vegan ? true : draft.vegetarian,
            glutenFree: draft.glutenFree,
          },
          auth,
        )) as PublicMenuItem[]
        // Apply remaining fields (photo/text) onto the new id if present
        const created = updated.find(
          (m) =>
            m.name === draft.name.trim() && dishSection(m) === section,
        )
        if (created && (draft.imageUrl || draft.contents || draft.ingredients)) {
          const patch: PublicMenuPatch = {
            contents: draft.contents,
            contentsDe: draft.contentsDe,
            ingredients: draft.ingredients,
            ingredientsDe: draft.ingredientsDe,
            description: draft.description,
            descriptionDe: draft.descriptionDe,
            imageUrl: draft.imageUrl.trim(),
            publicSection: section,
          }
          updated = (await patchPublicMenuItem(
            created.id,
            patch,
            auth,
            boundMenuKey || typeParam,
          )) as PublicMenuItem[]
        }
      } else {
        const patch: PublicMenuPatch = {
          name: draft.name,
          nameDe: draft.nameDe,
          contents: draft.contents,
          contentsDe: draft.contentsDe,
          description: draft.description,
          descriptionDe: draft.descriptionDe,
          ingredients: draft.ingredients,
          ingredientsDe: draft.ingredientsDe,
          vegan: draft.vegan,
          vegetarian: draft.vegan ? true : draft.vegetarian,
          glutenFree: draft.glutenFree,
          publicSection: section,
          kind: isCombo ? 'combo' : 'single',
          ...(isCombo
            ? {
                price: Math.max(0, parseEuroField(draft.priceWithChai)),
                priceWithChai: Math.max(0, parseEuroField(draft.priceWithChai)),
                priceWithLassi: Math.max(0, parseEuroField(draft.priceWithLassi)),
              }
            : {
                price: Math.max(0, parseEuroField(draft.price)),
              }),
          imageUrl: draft.imageUrl.trim(),
        }
        updated = (await patchPublicMenuItem(
          editId,
          patch,
          auth,
          boundMenuKey || typeParam,
        )) as PublicMenuItem[]
      }
      applyMenuFromServer(updated)
      setEditMsg(
        lang === 'de'
          ? 'Gespeichert — gilt auch für die echte Kundenseite (/order).'
          : 'Saved — also live on the real customer /order page.',
      )
      window.setTimeout(() => closeDishEditor(), 900)
    } catch (e) {
      setEditMsg(
        e instanceof Error
          ? e.message
          : lang === 'de'
            ? 'Speichern fehlgeschlagen — bist du online und eingeloggt?'
            : 'Save failed — are you online and signed in?',
      )
    } finally {
      setEditBusy(false)
    }
  }

  function switchLang(next: OrderLang) {
    setLang(next)
    saveOrderLang(next)
  }

  const loadMenu = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams()
      if (eventParam) q.set('event', eventParam)
      if (typeParam) q.set('type', typeParam)
      const url = q.toString()
        ? `/api/customer-order?${q.toString()}`
        : '/api/customer-order'
      const res = await fetch(url)
      const data = (await res.json()) as {
        menu?: PublicMenuItem[]
        menuLabel?: string
        menuKey?: string
        eventId?: string
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'load')
      setMenu(data.menu || [])
      setMenuLabel(String(data.menuLabel || '').trim())
      setBoundEventId(String(data.eventId || eventParam || '').trim())
      setBoundMenuKey(String(data.menuKey || typeParam || '').trim())
    } catch {
      setError('load')
    } finally {
      setLoading(false)
    }
  }, [eventParam, typeParam])

  const pollStatus = useCallback(
    async (code: string) => {
      const cleaned = code.replace(/\D/g, '').slice(0, 4)
      if (cleaned.length !== 4) return
      try {
        const q = new URLSearchParams({ code: cleaned })
        if (boundEventId || eventParam) {
          q.set('event', boundEventId || eventParam)
        }
        const res = await fetch(`/api/customer-order?${q.toString()}`)
        const data = (await res.json()) as {
          order?: TrackState & { claimCode?: string }
          error?: string
        }
        if (!res.ok || !data.order) return
        setTrack({
          status: data.order.status,
          ahead: data.order.ahead,
          ticket: data.order.ticket,
          claimCode: data.order.claimCode || cleaned,
          lines: data.order.lines || [],
        })
      } catch {
        /* ignore poll errors */
      }
    },
    [boundEventId, eventParam],
  )

  useEffect(() => {
    void loadMenu()
  }, [loadMenu])

  useEffect(() => {
    const code = (params.get('code') || claimCode || '').replace(/\D/g, '').slice(0, 4)
    if (code.length !== 4) return
    void pollStatus(code)
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void pollStatus(code)
    }, 12000)
    const onVis = () => {
      if (!document.hidden) void pollStatus(code)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [params, claimCode, pollStatus])

  const filteredMenu = useMemo(() => {
    if (filter === 'vegan') return menu.filter((m) => m.vegan)
    if (filter === 'glutenFree') return menu.filter((m) => m.glutenFree)
    return menu
  }, [menu, filter])

  const menuSections = useMemo(() => {
    const combos = filteredMenu.filter((m) => dishSection(m) === 'combos')
    const drinks = filteredMenu.filter((m) => dishSection(m) === 'drinks')
    const snacks = filteredMenu.filter((m) => dishSection(m) === 'snacks')
    const mains = filteredMenu.filter((m) => dishSection(m) === 'mains')
    const sections: {
      key: PublicMenuSection
      title: string
      items: PublicMenuItem[]
    }[] = [
      { key: 'combos', title: t.sectionCombos, items: combos },
      { key: 'mains', title: t.sectionMains, items: mains },
      { key: 'snacks', title: t.sectionSnacks, items: snacks },
      { key: 'drinks', title: t.sectionDrinks, items: drinks },
    ]
    // In edit mode show empty sections so staff can add dishes there
    return showPens ? sections : sections.filter((s) => s.items.length > 0)
  }, [
    filteredMenu,
    showPens,
    t.sectionCombos,
    t.sectionDrinks,
    t.sectionMains,
    t.sectionSnacks,
  ])

  const cartLines = useMemo(() => {
    const byId = new Map(menu.map((m) => [m.id, m]))
    return Object.values(cart)
      .map((c) => {
        const m = byId.get(c.menuItemId)
        if (!m || c.qty <= 0) return null
        const drink = m.kind === 'combo' ? c.drink || 'chai' : undefined
        const dish = localized(lang, m.name, m.nameDe, m.id)
        const drinkName =
          drink === 'lassi' ? t.drinkLassi : drink === 'chai' ? t.drinkChai : ''
        return {
          ...c,
          drink,
          name: drinkName ? `${dish} · ${drinkName}` : dish,
          price: itemPrice(m, drink),
        }
      })
      .filter(Boolean) as {
      menuItemId: string
      qty: number
      drink?: DrinkChoice
      name: string
      price: number
    }[]
  }, [cart, menu, lang, t.drinkChai, t.drinkLassi])

  const cartTotal = cartLines.reduce((s, l) => s + l.price * l.qty, 0)
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0)

  function addItem(m: PublicMenuItem, drink?: DrinkChoice) {
    if (m.soldOut) return
    const d = m.kind === 'combo' ? drink || 'chai' : undefined
    const key = cartKey(m.id, d)
    setCart((c) => ({
      ...c,
      [key]: {
        menuItemId: m.id,
        drink: d,
        qty: Math.min(20, (c[key]?.qty || 0) + 1),
      },
    }))
  }

  function setQty(key: string, qty: number) {
    setCart((c) => {
      const next = { ...c }
      if (qty <= 0) delete next[key]
      else next[key] = { ...next[key], qty: Math.min(20, qty) }
      return next
    })
  }

  async function placeOrder() {
    if (!cartLines.length || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/customer-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place',
          eventId: boundEventId || eventParam || undefined,
          menuKey: boundMenuKey || typeParam || undefined,
          customerName: name.trim() || undefined,
          lines: cartLines.map((l) => ({
            menuItemId: l.menuItemId,
            qty: l.qty,
            drink: l.drink,
          })),
        }),
      })
      const data = (await res.json()) as {
        claimCode?: string
        eventId?: string
        error?: string
        message?: string
      }
      if (!res.ok || !data.claimCode) throw new Error(data.error || 'fail')
      setClaimCode(data.claimCode)
      if (data.eventId) setBoundEventId(data.eventId)
      setCart({})
      const nextParams: Record<string, string> = { code: data.claimCode }
      const eid = data.eventId || boundEventId || eventParam
      if (eid) nextParams.event = eid
      if (typeParam) nextParams.type = typeParam
      if (isPreview) nextParams.preview = '1'
      setParams(nextParams)
      setTrack({
        status: 'awaiting_claim',
        ahead: null,
        ticket: null,
        claimCode: data.claimCode,
        lines: cartLines.map((l) => ({ name: l.name, qty: l.qty, price: l.price })),
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message.trim() : ''
      setError(msg && msg !== 'fail' ? msg : 'order')
    } finally {
      setBusy(false)
    }
  }

  const showingTrack = Boolean(track && claimCode)
  const waitLo = Math.max(5, ((track?.ahead ?? 0) + 1) * 4)
  const waitHi = Math.max(8, ((track?.ahead ?? 0) + 1) * 7)

  return (
    <div
      className={`public-order${cartCount > 0 && !showingTrack ? ' has-cart' : ''}${showingTrack ? ' is-track' : ''}`}
    >
      <div className="public-order__bg" aria-hidden>
        <span className="public-order__bg-glow public-order__bg-glow--a" />
        <span className="public-order__bg-glow public-order__bg-glow--b" />
        <span className="public-order__bg-pattern" />
      </div>
      {isPreview && (
        <div className="public-order__preview-banner" role="status">
          <div>
            <strong>
              {lang === 'de' ? 'Team-Vorschau' : 'Staff preview'}
            </strong>
            <span>
              {lang === 'de'
                ? ' — so sieht die Kundenseite aus. Mit Stift bearbeiten → speichert für alle Gäste.'
                : ' — what guests see. Use the pen to edit → saves for the real /order page.'}
            </span>
            {menuLabel ? (
              <span className="public-order__preview-menu">
                {' '}
                · {lang === 'de' ? 'Menü' : 'Menu'}: {menuLabel}
              </span>
            ) : null}
            {editMode && !canStaffEdit && (
              <div className="hint-inline" style={{ marginTop: 6 }}>
                {lang === 'de'
                  ? 'Zum Bearbeiten im Team-Tab einloggen, dann Vorschau neu öffnen.'
                  : 'Sign in on the team app first, then reopen this preview.'}
              </div>
            )}
          </div>
          <div className="public-order__preview-actions">
            <button
              type="button"
              className={`btn${editMode ? '' : ' ghost'}`}
              onClick={() => {
                if (!canStaffEdit) {
                  setEditMode(true)
                  return
                }
                const next = !editMode
                setEditMode(next)
                if (!next) {
                  closeDishEditor()
                  if (canEditUi) setEditUi(false)
                }
              }}
              title={
                canStaffEdit
                  ? lang === 'de'
                    ? 'Bearbeiten ein/aus'
                    : 'Toggle edit pens'
                  : lang === 'de'
                    ? 'Team-Login nötig'
                    : 'Team login required'
              }
            >
              <Pencil size={14} />{' '}
              {editMode
                ? lang === 'de'
                  ? 'Bearbeiten aus'
                  : 'Edit off'
                : lang === 'de'
                  ? 'Bearbeiten'
                  : 'Edit'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => void loadMenu()}
            >
              {lang === 'de' ? 'Aktualisieren' : 'Refresh'}
            </button>
            <a className="btn ghost" href="/order" target="_blank" rel="noreferrer">
              {lang === 'de' ? 'Gäste-Ansicht' : 'Guest view'}
            </a>
          </div>
        </div>
      )}

      {!showingTrack && (
        <header className="public-order__hero">
          <div className="public-order__hero-top">
            <div className="public-order__lang" role="group" aria-label="Language">
              <button
                type="button"
                className={lang === 'de' ? 'is-active' : ''}
                onClick={() => switchLang('de')}
              >
                {t.langDe}
              </button>
              <button
                type="button"
                className={lang === 'en' ? 'is-active' : ''}
                onClick={() => switchLang('en')}
              >
                {t.langEn}
              </button>
            </div>
          </div>
          <div className="public-order__brand">
            <img
              className="public-order__logo"
              src="/nasta-logo.png"
              alt=""
              width={72}
              height={72}
            />
            <h1 className="public-order__brand-name">
              {brand.brandName || 'Nasta Zentrum'}
            </h1>
            {showPens || editUi ? (
              <EditableText
                id="order.tagline"
                as="p"
                className="public-order__tagline"
                defaultText={t.tagline}
              />
            ) : (
              <p className="public-order__tagline">{t.tagline}</p>
            )}
            <p className="public-order__menu-label">
              {t.todaysMenu}
              {menuLabel &&
              !/^menu$/i.test(menuLabel) &&
              !/^menü$/i.test(menuLabel) ? (
                <span> · {menuLabel}</span>
              ) : null}
            </p>
          </div>
          {menu.length > 0 && (
            <a className="public-order__scroll-cue" href="#po-menu">
              {t.browseMenu}
            </a>
          )}
          <div className="public-order__hero-links">
            <a href="#stall-map">{lang === 'de' ? 'Stand finden' : 'Find stall'}</a>
            <Link to="/faq">{lang === 'de' ? 'Würze & FAQ' : 'Spice FAQ'}</Link>
          </div>
        </header>
      )}

      {showingTrack ? (
        <section className="public-order__ticket" aria-live="polite">
          <img
            className="public-order__ticket-logo"
            src="/nasta-logo.png"
            alt=""
            width={48}
            height={48}
          />
          <p className="public-order__ticket-kicker">{t.claimCodeLabel}</p>
          <div className="public-order__code">{track!.claimCode}</div>
          {track!.status === 'awaiting_claim' && (
            <>
              <h2>{t.showStaffTitle}</h2>
              <p className="public-order__ticket-body">{t.showStaffBody}</p>
              <p className="public-order__ticket-meta">{t.codeExpires}</p>
            </>
          )}
          {track!.status === 'pending' && (
            <>
              <h2>{t.inQueueTitle}</h2>
              <p className="public-order__ticket-body">
                {lang === 'de' ? 'Kunde' : 'Customer'} <strong>{track!.ticket}</strong>
                {track!.ahead === 0
                  ? t.youreNext
                  : track!.ahead != null
                    ? t.aheadOfYou(track!.ahead)
                    : '.'}
              </p>
              <p className="public-order__ticket-meta">{t.roughWait(waitLo, waitHi)}</p>
            </>
          )}
          {track!.status === 'completed' && (
            <>
              <h2>{t.readyTitle}</h2>
              <p className="public-order__ticket-body">
                {lang === 'de' ? 'Kunde' : 'Customer'} <strong>{track!.ticket}</strong>{' '}
                {t.readyBody}
              </p>
            </>
          )}
          {track!.lines?.length > 0 && (
            <ul className="public-order__lines">
              {track!.lines.map((l, i) => (
                <li key={i}>
                  <span>
                    {l.qty}× {l.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="public-order__btn public-order__btn--ghost"
            onClick={() => {
              setTrack(null)
              setClaimCode('')
              setParams({})
            }}
          >
            {t.orderElse}
          </button>
        </section>
      ) : (
        <>
          {loading && (
            <p className="public-order__status" role="status">
              {t.loading}
            </p>
          )}
          {error && (
            <div className="public-order__alert" role="alert">
              {error === 'load'
                ? t.loadError
                : error === 'order' || error === 'fail'
                  ? t.orderFailed
                  : error}
            </div>
          )}

          {!loading && !error && menu.length === 0 && !showPens && (
            <div className="public-order__empty">
              <h2>{t.menuEmptyTitle}</h2>
              <p>{t.menuEmptyBody}</p>
            </div>
          )}

          {(menu.length > 0 || showPens) && (
            <nav className="public-order__filters" role="group" aria-label="Filter">
              {(
                [
                  { id: 'all' as const, label: t.filterAll },
                  { id: 'vegan' as const, label: t.filterVegan, icon: true },
                  { id: 'glutenFree' as const, label: t.filterGlutenFree, wheat: true },
                ]
              ).map((item) => {
                const on = filter === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${on ? 'is-active' : ''}${on && !reduceMotion ? ' has-glider' : ''}`}
                    onClick={() => setFilter(item.id)}
                  >
                    {on && !reduceMotion && (
                      <motion.span
                        layoutId="po-diet-pill"
                        className="po-filter-glider"
                        transition={springSoft}
                      />
                    )}
                    {item.icon ? <Leaf size={15} aria-hidden /> : null}
                    {item.wheat ? <WheatOff size={15} aria-hidden /> : null}
                    {item.label}
                  </button>
                )
              })}
            </nav>
          )}

          {!loading && menu.length > 0 && filteredMenu.length === 0 && (
            <p className="public-order__status">{t.noFilterMatch}</p>
          )}

          <div id="po-menu" className="public-order__menu">
            {menuSections.map((section, sIdx) => (
              <section
                key={section.key}
                className="public-order__section"
                style={{ '--po-delay': `${sIdx * 60}ms` } as CSSProperties}
              >
                {showPens || editUi ? (
                  <EditableText
                    id={`order.section.${section.key}`}
                    as="h2"
                    className="public-order__section-title"
                    defaultText={section.title}
                  />
                ) : (
                  <h2 className="public-order__section-title">{section.title}</h2>
                )}
                <div className="public-order__section-list">
                  {section.items.map((m) => {
                    const dishName = localized(lang, m.name, m.nameDe, m.id)
                    const contents = localized(lang, m.contents, m.contentsDe)
                    const description = localized(lang, m.description, m.descriptionDe)
                    const ingredients = localized(lang, m.ingredients, m.ingredientsDe)
                    const globalIdx = menu.findIndex((x) => x.id === m.id)
                    return (
                      <article
                        key={m.id}
                        className={`public-order__dish${m.soldOut ? ' public-order__dish--soldout' : ''}`}
                      >
                        {showPens && (
                          <div className="public-order__edit-tools">
                            <button
                              type="button"
                              className="public-order__edit-pen"
                              aria-label="Up"
                              disabled={editBusy || globalIdx <= 0}
                              onClick={() => void moveDish(m.id, 'up')}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              className="public-order__edit-pen"
                              aria-label="Down"
                              disabled={editBusy || globalIdx < 0 || globalIdx >= menu.length - 1}
                              onClick={() => void moveDish(m.id, 'down')}
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              className="public-order__edit-pen"
                              aria-label={lang === 'de' ? 'Gericht bearbeiten' : 'Edit dish'}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                openDishEditor(m)
                              }}
                            >
                              <Pencil size={14} />                            </button>
                            <button
                              type="button"
                              className="public-order__edit-pen"
                              aria-label={lang === 'de' ? 'Entfernen' : 'Remove'}
                              disabled={editBusy}
                              onClick={() => void deleteDish(m.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                        <div className="public-order__photo">
                          {m.imageUrl ? (
                            <img src={m.imageUrl} alt="" loading="lazy" />
                          ) : (
                            <div className="public-order__photo-fallback" aria-hidden>
                              {dishName.slice(0, 1)}
                            </div>
                          )}
                        </div>
                        <div className="public-order__dish-body">
                          <div className="public-order__dish-head">
                            <h3>{dishName}</h3>
                            <strong className="public-order__price">
                              {m.kind === 'combo' ? `${t.fromPrice} ` : '€'}
                              <CountUp
                                value={
                                  m.kind === 'combo'
                                    ? Number(m.priceWithChai ?? m.price) || 0
                                    : Number(m.price) || 0
                                }
                                format={(n) => formatEuroLabel(n)}
                              />
                            </strong>
                          </div>
                          {m.soldOut && (
                            <span className="public-order__tag">{lang === 'de' ? 'Ausverkauft' : 'Sold out'}</span>
                          )}
                          {(m.vegan || m.vegetarian || m.glutenFree) && (
                            <div className="public-order__tags">
                              {m.vegan && (
                                <span className="public-order__tag public-order__tag--vegan">
                                  <Leaf size={12} aria-hidden />
                                  {t.tagVegan}
                                </span>
                              )}
                              {!m.vegan && m.vegetarian && (
                                <span className="public-order__tag public-order__tag--veg">
                                  <Leaf size={12} aria-hidden />
                                  {t.tagVegetarian}
                                </span>
                              )}
                              {m.glutenFree && (
                                <span className="public-order__tag public-order__tag--gf">
                                  <WheatOff size={12} aria-hidden />
                                  {t.tagGlutenFree}
                                </span>
                              )}
                            </div>
                          )}
                          {contents && <p className="public-order__contents">{contents}</p>}
                          <p className="public-order__desc">
                            {description || t.freshStall}
                          </p>
                          {ingredients && (
                            <details className="public-order__ingredients">
                              <summary>
                                <Utensils size={12} aria-hidden />
                                {t.ingredientsLabel}
                              </summary>
                              <p>{ingredients}</p>
                            </details>
                          )}
                          {m.kind === 'combo' ? (
                            <div className="public-order__add-row">
                              <button
                                type="button"
                                className="public-order__btn"
                                disabled={m.soldOut}
                                onClick={() => addItem(m, 'chai')}
                              >
                                {t.addChai} · €
                                {formatEuroLabel(Number(m.priceWithChai ?? m.price))}
                              </button>
                              <button
                                type="button"
                                className="public-order__btn public-order__btn--soft"
                                disabled={m.soldOut}
                                onClick={() => addItem(m, 'lassi')}
                              >
                                {t.addLassi} · €
                                {formatEuroLabel(Number(m.priceWithLassi ?? m.price))}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="public-order__btn"
                              disabled={m.soldOut}
                              onClick={() => addItem(m)}
                            >
                              {t.add} · €{formatEuroLabel(Number(m.price))}
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
                {showPens && (
                  <button
                    type="button"
                    className="public-order__btn public-order__btn--soft"
                    disabled={editBusy}
                    onClick={() => openNewDishEditor(section.key)}
                  >
                    <Plus size={16} aria-hidden />{' '}
                    {lang === 'de'
                      ? `Gericht zu ${section.title} hinzufügen`
                      : `Add dish to ${section.title}`}
                  </button>
                )}
              </section>
            ))}
          </div>

          {cartCount > 0 && (
            <aside className="public-order__cart" aria-label={t.yourOrder}>
              <div className="public-order__cart-handle" aria-hidden />
              <h2>
                <ShoppingBag size={18} aria-hidden />
                {t.yourOrder}
                <span className="public-order__cart-count">{cartCount}</span>
              </h2>
              <div className="public-order__cart-lines">
                {cartLines.map((l) => {
                  const key = cartKey(l.menuItemId, l.drink)
                  return (
                    <div key={key} className="public-order__cart-line">
                      <span>
                        {l.name}
                        <em>€{(l.price * l.qty).toFixed(2)}</em>
                      </span>
                      <div className="public-order__stepper">
                        <button
                          type="button"
                          aria-label="−"
                          onClick={() => setQty(key, l.qty - 1)}
                        >
                          <Minus size={14} />
                        </button>
                        <strong>{l.qty}</strong>
                        <button
                          type="button"
                          aria-label="+"
                          onClick={() => setQty(key, l.qty + 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="public-order__cart-field">
                <label htmlFor="co-name">{t.nameLabel}</label>
                <input
                  id="co-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  maxLength={60}
                />
              </div>
              <div className="public-order__cart-total">
                <span>{t.total}</span>
                <strong>€{cartTotal.toFixed(2)}</strong>
              </div>
              <button
                type="button"
                className="public-order__btn public-order__btn--block"
                disabled={busy}
                onClick={() => void placeOrder()}
              >
                {busy ? t.placing : t.placeOrder}
              </button>
              <p className="public-order__cart-hint">{t.claimHint}</p>
            </aside>
          )}
        </>
      )}

      {!showingTrack && <StallFinder lang={lang} />}

      <footer className="public-order__foot">
        <Link to="/review">{t.leaveReview}</Link>
        <Link to="/faq">{lang === 'de' ? 'FAQ' : 'FAQ'}</Link>
      </footer>

      {draft && editId && (
        <div
          className="public-order__editor-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            // Prevent the opening click from closing the modal immediately.
            if (e.target !== e.currentTarget) return
            if (Date.now() < ignoreBackdropCloseUntil.current) return
            closeDishEditor()
          }}
        >
          <div
            className="public-order__editor"
            role="dialog"
            aria-labelledby="po-edit-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="public-order__editor-head">
              <strong id="po-edit-title">
                {lang === 'de' ? 'Gericht bearbeiten' : 'Edit dish'}
              </strong>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close"
                onClick={closeDishEditor}
              >
                <X size={16} />
              </button>
            </div>
            <p className="hint-inline" style={{ marginTop: 0 }}>
              {lang === 'de'
                ? 'Änderungen gelten sofort für die Kundenseite (/order), sobald du speicherst.'
                : 'Changes go live on the customer /order page as soon as you save.'}
            </p>
            <div className="public-order__editor-photo">
              <div className="public-order__editor-photo-thumb">
                {draft.imageUrl ? (
                  <img src={draft.imageUrl} alt="" />
                ) : (
                  <span className="hint-inline">
                    {lang === 'de' ? 'Kein Foto' : 'No photo'}
                  </span>
                )}
              </div>
              <div className="public-order__editor-photo-actions">
                <input
                  ref={dishImgRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => void onDishImageFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  className="btn ghost"
                  disabled={imgBusy || editBusy}
                  onClick={() => dishImgRef.current?.click()}
                >
                  <ImagePlus size={16} aria-hidden />{' '}
                  {imgBusy
                    ? lang === 'de'
                      ? 'Laden…'
                      : 'Loading…'
                    : draft.imageUrl
                      ? lang === 'de'
                        ? 'Foto ersetzen'
                        : 'Replace photo'
                      : lang === 'de'
                        ? 'Foto hinzufügen'
                        : 'Add photo'}
                </button>
                {draft.imageUrl ? (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={imgBusy || editBusy}
                    onClick={() => setDraft({ ...draft, imageUrl: '' })}
                  >
                    {lang === 'de' ? 'Foto entfernen' : 'Remove photo'}
                  </button>
                ) : null}
                <p className="hint-inline" style={{ margin: 0 }}>
                  {lang === 'de'
                    ? 'Foto wird mit „Speichern“ auf /order übernommen.'
                    : 'Photo goes live on /order when you save.'}
                </p>
              </div>
            </div>
            <div className="public-order__editor-grid">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="po-section">
                  {lang === 'de' ? 'Bereich' : 'Section'}
                </label>
                <select
                  id="po-section"
                  value={draft.publicSection}
                  onChange={(e) => {
                    const publicSection = e.target.value as PublicMenuSection
                    setDraft({
                      ...draft,
                      publicSection,
                      kind: publicSection === 'combos' ? 'combo' : 'single',
                    })
                  }}
                >
                  <option value="combos">{t.sectionCombos}</option>
                  <option value="mains">{t.sectionMains}</option>
                  <option value="snacks">{t.sectionSnacks}</option>
                  <option value="drinks">{t.sectionDrinks}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="po-name-en">Name (EN)</label>
                <input
                  id="po-name-en"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="po-name-de">Name (DE)</label>
                <input
                  id="po-name-de"
                  value={draft.nameDe}
                  onChange={(e) => setDraft({ ...draft, nameDe: e.target.value })}
                />
              </div>
              {draft.publicSection === 'combos' ? (
                <>
                  <div className="field">
                    <label htmlFor="po-price-chai">
                      {lang === 'de' ? 'Preis mit Chai (€)' : 'Price with Chai (€)'}
                    </label>
                    <EuroInput
                      id="po-price-chai"
                      value={draft.priceWithChai}
                      onChange={(priceWithChai) => setDraft({ ...draft, priceWithChai })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="po-price-lassi">
                      {lang === 'de' ? 'Preis mit Lassi (€)' : 'Price with Lassi (€)'}
                    </label>
                    <EuroInput
                      id="po-price-lassi"
                      value={draft.priceWithLassi}
                      onChange={(priceWithLassi) => setDraft({ ...draft, priceWithLassi })}
                    />
                  </div>
                </>
              ) : (
                <div className="field">
                  <label htmlFor="po-price">
                    {lang === 'de' ? 'Preis (€)' : 'Price (€)'}
                  </label>
                  <EuroInput
                    id="po-price"
                    value={draft.price}
                    onChange={(price) => setDraft({ ...draft, price })}
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="po-contents-en">Contents (EN)</label>
                <input
                  id="po-contents-en"
                  value={draft.contents}
                  onChange={(e) => setDraft({ ...draft, contents: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="po-contents-de">Contents (DE)</label>
                <input
                  id="po-contents-de"
                  value={draft.contentsDe}
                  onChange={(e) => setDraft({ ...draft, contentsDe: e.target.value })}
                />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="po-desc-en">Description (EN)</label>
                <textarea
                  id="po-desc-en"
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="po-desc-de">Description (DE)</label>
                <textarea
                  id="po-desc-de"
                  rows={2}
                  value={draft.descriptionDe}
                  onChange={(e) => setDraft({ ...draft, descriptionDe: e.target.value })}
                />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="po-ing-en">Ingredients (EN)</label>
                <textarea
                  id="po-ing-en"
                  rows={2}
                  value={draft.ingredients}
                  onChange={(e) => setDraft({ ...draft, ingredients: e.target.value })}
                />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="po-ing-de">Ingredients (DE)</label>
                <textarea
                  id="po-ing-de"
                  rows={2}
                  value={draft.ingredientsDe}
                  onChange={(e) => setDraft({ ...draft, ingredientsDe: e.target.value })}
                />
              </div>
            </div>
            <div className="public-order__editor-tags">
              <label>
                <input
                  type="checkbox"
                  checked={draft.vegan}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      vegan: e.target.checked,
                      vegetarian: e.target.checked ? true : draft.vegetarian,
                    })
                  }
                />{' '}
                {t.tagVegan}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.vegetarian || draft.vegan}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      vegetarian: e.target.checked,
                      vegan: e.target.checked ? draft.vegan : false,
                    })
                  }
                />{' '}
                {t.tagVegetarian}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.glutenFree}
                  onChange={(e) =>
                    setDraft({ ...draft, glutenFree: e.target.checked })
                  }
                />{' '}
                {t.tagGlutenFree}
              </label>
            </div>
            {editMsg && <p className="hint-inline">{editMsg}</p>}
            <div className="page-actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn"
                disabled={editBusy}
                onClick={() => void saveDishEditor()}
              >
                {editBusy
                  ? lang === 'de'
                    ? 'Speichern…'
                    : 'Saving…'
                  : lang === 'de'
                    ? 'Speichern für /order'
                    : 'Save to /order'}
              </button>
              <button type="button" className="btn ghost" onClick={closeDishEditor}>
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
