/**
 * Live two-device concurrency QA against nastazentrum.vercel.app.
 * Uses two isolated Chromium profiles + a copied team auth session.
 * Writes results JSON only (no secrets).
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import puppeteer from 'puppeteer-core'

const LIVE = 'https://nastazentrum.vercel.app'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const SESSION_FILE = path.join(os.tmpdir(), 'nasta-qa-session.json')
const OUT = path.join(os.tmpdir(), 'nasta-qa-two-device-results.json')
const MARK = `QA-${Date.now().toString(36)}`

function loadSession() {
  const raw = fs.readFileSync(SESSION_FILE, 'utf8')
  const dump = JSON.parse(raw)
  const keys = Object.keys(dump)
  if (!keys.length) throw new Error('empty session dump')
  const sample = String(dump[keys[0]] || '')
  if (!sample.includes('access_token')) throw new Error('session dump has no access_token')
  return dump
}

function summary(ops, sinceIso) {
  const orders = Array.isArray(ops?.orders) ? ops.orders : []
  const qa = orders.filter((o) => !sinceIso || String(o.createdAt || '') >= sinceIso)
  const byEvent = {}
  for (const o of qa) {
    const eid = String(o.eventId || 'none')
    byEvent[eid] = byEvent[eid] || []
    byEvent[eid].push({
      id: o.id,
      label: o.label,
      status: o.status,
      voided: !!o.voided,
      source: o.source || 'pos',
      claimCode: o.claimCode || '',
      total: (o.lines || []).reduce((s, l) => s + Number(l.price || 0) * Number(l.qty || 0), 0),
      lines: (o.lines || []).map((l) => `${l.qty}x ${l.name} @${l.price}`),
    })
  }
  const stock = (ops?.stock || []).map((s) => ({
    id: s.id,
    name: s.name,
    bought: Number(s.bought) || 0,
    used: Number(s.used) || 0,
  }))
  return {
    activeEventId: ops?.activeEventId || '',
    deleted: ops?.deletedOrderIds || [],
    byEvent,
    stock,
    pending: orders.filter((o) => o.status === 'pending' && !o.voided).length,
    completed: orders.filter((o) => o.status === 'completed' && !o.voided).length,
    awaiting: orders.filter((o) => o.status === 'awaiting_claim' && !o.voided).length,
  }
}

async function readOps(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('nasta-stall-ops-v1')
    return raw ? JSON.parse(raw) : null
  })
}

async function waitOrders(page) {
  await page.waitForFunction(
    () => {
      const t = document.body?.innerText || ''
      return t.includes('New order') || t.includes('Sign out') || t.includes('Sign in')
    },
    { timeout: 45000 },
  )
}

async function injectSession(page, dump) {
  await page.evaluate((d) => {
    for (const [k, v] of Object.entries(d)) {
      try {
        localStorage.setItem(k, v)
      } catch {
        /* ignore */
      }
    }
  }, dump)
}

function readDotEnv(name) {
  for (const f of ['.env.local', '.env']) {
    if (!fs.existsSync(f)) continue
    const line = fs
      .readFileSync(f, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${name}=`))
    if (!line) continue
    return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

async function loginDeveloper(page, password) {
  await page.goto(`${LIVE}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction(() => (document.body?.innerText || '').includes('Developer'), {
    timeout: 30000,
  })
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Developer'),
    )
    btn?.click()
  })
  await page.waitForFunction(
    () => !(document.body?.innerText || '').includes('Checking…'),
    { timeout: 20000 },
  ).catch(() => undefined)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button, a')].find((b) =>
      (b.textContent || '').includes('Use password instead'),
    )
    btn?.click()
  })
  await page.waitForSelector('input[type="password"], input[placeholder*="password" i], input[placeholder*="Team" i]', {
    timeout: 10000,
  })
  await page.evaluate((pw) => {
    const input = document.querySelector('input[type="password"], input[placeholder*="Team" i], input[placeholder*="password" i]')
    if (!input) throw new Error('no password field')
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    proto.set.call(input, pw)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, password)
  await new Promise((r) => setTimeout(r, 200))
  await page.evaluate(() => {
    const form = document.querySelector('form')
    if (form && typeof form.requestSubmit === 'function') form.requestSubmit()
    else form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  try {
    await page.waitForFunction(
      () => {
        const t = document.body?.innerText || ''
        return t.includes('Sign out') || t.includes('New order') || t.includes('Wrong') || t.includes('Cloud sync')
      },
      { timeout: 25000 },
    )
  } catch {
    const t = await page.evaluate(() => (document.body?.innerText || '').slice(0, 1500))
    throw new Error(`developer login did not finish: ${t.replace(/\s+/g, ' ').slice(0, 400)}`)
  }
  const t = await page.evaluate(() => document.body?.innerText || '')
  if (/Wrong/.test(t) && !t.includes('Sign out')) throw new Error('developer login failed')
}

async function bootDevice(dump, label, password) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `nasta-${label}-`))
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    userDataDir,
    args: ['--disable-notifications', '--no-first-run', `--window-size=1100,900`],
  })
  const page = (await browser.pages())[0] || (await browser.newPage())
  page.setDefaultTimeout(45000)
  await page.goto(`${LIVE}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate((d) => {
    for (const [k, v] of Object.entries(d)) {
      localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
    }
  }, dump)
  await page.goto(`${LIVE}/orders`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await new Promise((r) => setTimeout(r, 1500))
  let text = await page.evaluate(() => document.body?.innerText || '')
  if (!text.includes('Sign out') && !text.includes('New order')) {
    await loginDeveloper(page, password)
    await page.goto(`${LIVE}/orders`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    text = await page.evaluate(() => document.body?.innerText || '')
  }
  await waitOrders(page)
  text = await page.evaluate(() => document.body?.innerText || '')
  if (!text.includes('New order') && !text.includes('Sign out')) {
    throw new Error(`${label} not logged in: ${text.replace(/\s+/g, ' ').slice(0, 400)}`)
  }
  const who = text.includes('Jeeva') ? 'Jeeva' : text.includes('Developer') ? 'Developer' : 'other'
  await new Promise((r) => setTimeout(r, 3000))
  return { browser, page, userDataDir, who }
}

async function clickText(page, text) {
  const ok = await page.evaluate((t) => {
    const nodes = [...document.querySelectorAll('button, a, [role="button"]')]
    const hit = nodes.find((n) => (n.textContent || '').replace(/\s+/g, ' ').trim().includes(t))
    if (!hit) return false
    hit.click()
    return true
  }, text)
  if (!ok) throw new Error(`clickText missed: ${text}`)
}

async function selectEvent(page, eventId) {
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /^\s*New order/.test((b.textContent || '').replace(/\s+/g, ' ')),
    )
    if (!btn) return false
    btn.click()
    return true
  })
  if (!clicked) throw new Error('New order button missing')
  const sel = await page.waitForSelector('#active-event, select.pos-toolbar__event select, .pos-toolbar select', {
    timeout: 15000,
  }).catch(() => null)
  if (!sel) {
    const t = await page.evaluate(() => (document.body?.innerText || '').slice(0, 1200))
    throw new Error(`no event select. page=${t.replace(/\s+/g, ' ').slice(0, 500)}`)
  }
  await page.waitForFunction(
    () => {
      const s = document.querySelector('#active-event')
      return s && [...s.options].some((o) => o.value.startsWith('E'))
    },
    { timeout: 20000 },
  ).catch(() => undefined)
  await page.select('#active-event', eventId)
  await new Promise((r) => setTimeout(r, 500))
  const v = await page.$eval('#active-event', (el) => el.value).catch(() => '')
  if (v !== eventId) {
    const opts = await page.$$eval('#active-event option', (xs) => xs.map((o) => o.value))
    throw new Error(`event select stayed '${v}', wanted ${eventId}, options=${opts.join(',')}`)
  }
}

async function addNamedItem(page, name) {
  const clicked = await page.evaluate((n) => {
    const add = document.querySelector(`button[aria-label="Add ${n}"]`)
    if (add) {
      add.click()
      return 'aria'
    }
    const btns = [...document.querySelectorAll('button')]
    const hit = btns.find((b) => (b.getAttribute('aria-label') || '').includes(n))
    if (hit) {
      hit.click()
      return 'aria-includes'
    }
    const drink = [...document.querySelectorAll('.pos-drink button, button.pos-drink')]
      .find((b) => (b.textContent || '').includes(n))
    if (drink) {
      drink.click()
      return 'drink'
    }
    return ''
  }, name)
  if (!clicked) throw new Error(`could not add item ${name}`)
}

async function submitCart(page, double = false) {
  await page.waitForSelector('button.pos-dock__submit, button.pos-cart__submit', { timeout: 10000 })
  await page.evaluate((dbl) => {
    const btn = document.querySelector('button.pos-dock__submit, button.pos-cart__submit')
    if (!btn) throw new Error('no submit')
    btn.click()
    if (dbl) btn.click()
  }, double)
  await new Promise((r) => setTimeout(r, 200))
}

async function createTicket(page, eventId, itemName, opts = {}) {
  await selectEvent(page, eventId)
  await addNamedItem(page, itemName)
  await submitCart(page, Boolean(opts.doubleClick))
}

async function pendingLabels(page, eventId) {
  return page.evaluate((eid) => {
    const ops = JSON.parse(localStorage.getItem('nasta-stall-ops-v1') || '{}')
    return (ops.orders || [])
      .filter(
        (o) =>
          o.status === 'pending' &&
          !o.voided &&
          String(o.eventId || '') === eid,
      )
      .map((o) => ({ id: o.id, label: o.label, total: (o.lines || []).reduce((s, l) => s + l.price * l.qty, 0), lines: o.lines }))
  }, eventId)
}

async function deliverAndPay(page, orderId) {
  await clickText(page, 'Pending')
  await new Promise((r) => setTimeout(r, 400))
  const opened = await page.evaluate((id) => {
    const cards = [...document.querySelectorAll('.order-list .card, .MotionCard, [class*="order"]')]
    const btn = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Pay & finish') || (b.textContent || '').includes('All done'),
    )
    const allDone = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('All done'))
    if (allDone) allDone.click()
    const pay = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Pay & finish'))
    if (pay && !pay.disabled) {
      pay.click()
      return true
    }
    return { id, hasPay: Boolean(pay), payDisabled: pay?.disabled }
  }, orderId)
  await new Promise((r) => setTimeout(r, 300))
  await page.evaluate(() => {
    const cash = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Cash')
    if (cash) cash.click()
  })
  await new Promise((r) => setTimeout(r, 250))
  const confirmed = await page.evaluate((dbl) => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Confirm delivery') || (b.textContent || '').includes('Confirm payment'),
    )
    if (!btn || btn.disabled) return false
    btn.click()
    if (dbl) btn.click()
    return true
  }, false)
  return { opened, confirmed }
}

async function refresh(page) {
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      (b.getAttribute('title') || '').toLowerCase().includes('refresh') ||
      (b.textContent || '').includes('Refresh'),
    )
    if (btn) {
      btn.click()
      return true
    }
    return false
  })
  if (!clicked) await page.reload({ waitUntil: 'networkidle2' })
  await waitOrders(page)
  await new Promise((r) => setTimeout(r, 2000))
}

function checksFrom(report) {
  const fails = []
  const push = (id, ok, detail) => {
    report.checks.push({ id, ok, detail })
    if (!ok) fails.push(`${id}: ${detail}`)
  }
  return { push, fails }
}

const dump = loadSession()
const teamPassword = readDotEnv('VITE_UPLOAD_PASSWORD')
if (!teamPassword) throw new Error('VITE_UPLOAD_PASSWORD missing for Developer login fallback')
const since = new Date().toISOString()
const report = {
  startedAt: since,
  live: LIVE,
  mark: MARK,
  checks: [],
  notes: [],
  devices: {},
  guest: {},
  expected: {},
  actual: {},
}

const browserA = { close: async () => undefined }
const browserB = { close: async () => undefined }
try {
  const a = await bootDevice(dump, 'A', teamPassword)
  const b = await bootDevice(dump, 'B', teamPassword)
  browserA.close = () => a.browser.close()
  browserB.close = () => b.browser.close()
  const pageA = a.page
  const pageB = b.page
  report.devices.who = { A: a.who, B: b.who }

  const beforeA = summary(await readOps(pageA))
  report.devices.beforeCompleted = beforeA.completed
  report.devices.beforeStock = beforeA.stock.filter((s) => s.id === 'chai-cup' || s.id === 'lassi-cup')

  await Promise.all([selectEvent(pageA, 'E014'), selectEvent(pageB, 'E013')])
  const tabA = await pageA.evaluate(() => document.querySelector('#active-event')?.value)
  const tabB = await pageB.evaluate(() => document.querySelector('#active-event')?.value)
  report.devices.eventPick = { A: tabA, B: tabB }

  // --- C1 burst: 5 overlapping staff tickets per stall ---
  const burstErrors = []
  for (let i = 0; i < 5; i++) {
    try {
      await Promise.all([
        createTicket(pageA, 'E014', 'Masala chai'),
        createTicket(pageB, 'E013', 'Mango lassi'),
      ])
    } catch (e) {
      burstErrors.push(String(e?.message || e))
    }
    await new Promise((r) => setTimeout(r, 80))
  }
  await new Promise((r) => setTimeout(r, 2500))

  // --- C2: guest QR place overlapping a staff save ---
  const guestPlaces = await Promise.all([
    fetch(`${LIVE}/api/customer-order`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'place',
        eventId: 'E014',
        menuKey: 'Flohmarkt',
        customerName: `${MARK}-guest-e014`,
        lines: [{ menuItemId: 'masala-chai', qty: 1 }],
      }),
    }).then(async (r) => ({ status: r.status, ...(await r.json()) })),
    fetch(`${LIVE}/api/customer-order`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'place',
        eventId: 'E013',
        menuKey: 'Gourmet',
        customerName: `${MARK}-guest-e013`,
        lines: [{ menuItemId: 'mango-lassi', qty: 1 }],
      }),
    }).then(async (r) => ({ status: r.status, ...(await r.json()) })),
    createTicket(pageA, 'E014', 'Masala chai').then(() => ({ staff: 'A' })).catch((e) => ({ staff: 'A', error: String(e.message || e) })),
  ])
  report.guest.places = guestPlaces.map((g) => ({
    status: g.status,
    ok: g.ok,
    claimCode: g.claimCode,
    orderId: g.orderId,
    eventId: g.eventId,
    error: g.error,
    staff: g.staff,
  }))

  // --- double-click add ---
  const beforeDbl = (await pendingLabels(pageA, 'E014')).length
  await createTicket(pageA, 'E014', 'Masala chai', { doubleClick: true })
  await new Promise((r) => setTimeout(r, 900))
  const afterDbl = (await pendingLabels(pageA, 'E014')).length
  report.devices.doubleAddDelta = afterDbl - beforeDbl

  await Promise.all([refresh(pageA), refresh(pageB)])
  await new Promise((r) => setTimeout(r, 1500))

  const opsA = await readOps(pageA)
  const opsB = await readOps(pageB)
  const sumA = summary(opsA, since)
  const sumB = summary(opsB, since)
  report.devices.afterBurstA = sumA
  report.devices.afterBurstB = sumB
  report.notes.push(`burstErrors:${burstErrors.length}`)
  if (burstErrors.length) report.notes.push(burstErrors.slice(0, 5).join(' | '))

  const e014A = (sumA.byEvent.E014 || []).filter((o) => !o.voided)
  const e013A = (sumA.byEvent.E013 || []).filter((o) => !o.voided)
  const e014B = (sumB.byEvent.E014 || []).filter((o) => !o.voided)
  const e013B = (sumB.byEvent.E013 || []).filter((o) => !o.voided)

  const { push, fails } = checksFrom(report)
  push('event-pick', tabA === 'E014' && tabB === 'E013', `A=${tabA} B=${tabB}`)
  push('c1-both-events-on-A', e014A.length >= 5 && e013A.length >= 5, `E014=${e014A.length} E013=${e013A.length}`)
  push('c1-both-events-on-B', e014B.length >= 5 && e013B.length >= 5, `E014=${e014B.length} E013=${e013B.length}`)
  push(
    'c1-no-lost-ids',
    e014A.map((o) => o.id).sort().join() === e014B.map((o) => o.id).sort().join() &&
      e013A.map((o) => o.id).sort().join() === e013B.map((o) => o.id).sort().join(),
    `A E014 ${e014A.length} vs B ${e014B.length}; A E013 ${e013A.length} vs B ${e013B.length}`,
  )
  push(
    'assignment',
    e014A.every((o) => o.lines.some((l) => l.includes('chai') || l.includes('Chai'))) &&
      e013A.every((o) => o.lines.some((l) => l.toLowerCase().includes('lassi')) || o.source === 'customer'),
    'chai stays on E014 / lassi on E013 (guest may differ)',
  )
  push('double-add', report.devices.doubleAddDelta === 1, `delta=${report.devices.doubleAddDelta}`)

  const guestE014 = guestPlaces.find((g) => g.eventId === 'E014' && g.claimCode)
  const guestE013 = guestPlaces.find((g) => g.eventId === 'E013' && g.claimCode)
  push('c2-guest-place-e014', Boolean(guestE014?.claimCode), JSON.stringify(report.guest.places[0] || {}))
  push('c2-guest-place-e013', Boolean(guestE013?.claimCode), JSON.stringify(report.guest.places[1] || {}))

  const awaitingA = (opsA.orders || []).filter((o) => o.status === 'awaiting_claim' && !o.voided && o.createdAt >= since)
  push(
    'c2-guest-survived-cloud',
    awaitingA.some((o) => o.eventId === 'E014') && awaitingA.some((o) => o.eventId === 'E013'),
    awaitingA.map((o) => `${o.eventId}:${o.claimCode}`).join(','),
  )

  // Claim cross-stall
  let crossErr = ''
  let scopedOk = false
  if (guestE013?.claimCode) {
    await clickText(pageA, 'Pending')
    await page.waitForSelector('#pending-event', { timeout: 10000 }).catch(() => undefined)
    if (await page.$('#pending-event')) await page.select('#pending-event', 'E014')
    const claimInput = await page.$('#claim-code')
    if (claimInput) {
      await claimInput.click({ clickCount: 3 })
      await page.type('#claim-code', guestE013.claimCode)
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) =>
          (b.textContent || '').includes('Claim'),
        )
        if (btn) btn.click()
      })
      await new Promise((r) => setTimeout(r, 1200))
      crossErr = await page.evaluate(() => document.body.innerText)
      const stillWaiting = (await readOps(pageA)).orders?.some(
        (o) => o.claimCode === guestE013.claimCode && o.status === 'awaiting_claim',
      )
      push(
        'claim-no-cross',
        Boolean(stillWaiting) && /E013|not found|Switch Event/i.test(crossErr),
        stillWaiting ? 'still awaiting on E013' : 'ticket left awaiting_claim',
      )
    } else {
      push('claim-no-cross', false, 'no claim input')
    }

    await page.select('#pending-event', 'E013').catch(() => undefined)
    if (await page.$('#claim-code')) {
      await page.click('#claim-code', { clickCount: 3 })
      await page.type('#claim-code', guestE013.claimCode)
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) =>
          (b.textContent || '').includes('Claim'),
        )
        if (btn) btn.click()
      })
      await new Promise((r) => setTimeout(r, 1200))
      const claimed = (await readOps(pageA)).orders?.find(
        (o) => o.claimCode === guestE013.claimCode && o.status === 'pending',
      )
      scopedOk = Boolean(claimed && claimed.eventId === 'E013')
      push('claim-same-stall', scopedOk, claimed ? `${claimed.label} ${claimed.eventId}` : 'not pending')
    }
  } else {
    push('claim-no-cross', false, 'no E013 guest code')
    push('claim-same-stall', false, 'no E013 guest code')
  }

  // Customer numbers
  const nums014 = e014A
    .filter((o) => o.status === 'pending' || o.status === 'completed')
    .map((o) => Number(String(o.label).replace(/\D/g, '')) || 0)
    .filter(Boolean)
    .sort((x, y) => x - y)
  const unique014 = new Set(nums014)
  push(
    'numbering-e014',
    unique014.size === nums014.length || nums014.length === 0,
    `labels=${nums014.join(',')}`,
  )
  const nums013 = e013A
    .filter((o) => o.status === 'pending' || o.status === 'completed')
    .map((o) => Number(String(o.label).replace(/\D/g, '')) || 0)
    .filter(Boolean)
    .sort((x, y) => x - y)
  push(
    'numbering-e013',
    new Set(nums013).size === nums013.length || nums013.length === 0,
    `labels=${nums013.join(',')}`,
  )
  push(
    'numbering-independent',
    nums014.includes(1) && nums013.includes(1),
    `E014 starts ${nums014[0]} E013 starts ${nums013[0]}`,
  )

  // Simultaneous pending update: bump delivered qty on different tickets
  const p014 = (opsA.orders || []).find(
    (o) => o.eventId === 'E014' && o.status === 'pending' && !o.voided && o.source === 'pos',
  )
  const p013 = (opsA.orders || []).find(
    (o) => o.eventId === 'E013' && o.status === 'pending' && !o.voided && o.source === 'pos',
  )
  if (p014 && p013) {
    await Promise.all([
      pageA.evaluate((id) => {
        const ops = JSON.parse(localStorage.getItem('nasta-stall-ops-v1'))
        ops.orders = ops.orders.map((o) =>
          o.id === id
            ? { ...o, lines: o.lines.map((l) => ({ ...l, deliveredQty: 1 })), updatedAt: new Date().toISOString() }
            : o,
        )
        localStorage.setItem('nasta-stall-ops-v1', JSON.stringify(ops))
      }, p014.id),
      pageB.evaluate((id) => {
        const ops = JSON.parse(localStorage.getItem('nasta-stall-ops-v1'))
        ops.orders = ops.orders.map((o) =>
          o.id === id
            ? { ...o, lines: o.lines.map((l) => ({ ...l, deliveredQty: 1 })), updatedAt: new Date().toISOString() }
            : o,
        )
        localStorage.setItem('nasta-stall-ops-v1', JSON.stringify(ops))
      }, p013.id),
    ])
    await Promise.all([
      pageA.evaluate(() => window.dispatchEvent(new Event('nasta-event-book'))),
      pageB.evaluate(() => window.dispatchEvent(new Event('nasta-event-book'))),
    ])
    // trigger persist via a harmless UI click
    await Promise.all([clickText(pageA, 'New order').catch(() => undefined), clickText(pageB, 'New order').catch(() => undefined)])
    await new Promise((r) => setTimeout(r, 2000))
    await Promise.all([refresh(pageA), refresh(pageB)])
    const merged = await readOps(pageA)
    const u014 = merged.orders.find((o) => o.id === p014.id)
    const u013 = merged.orders.find((o) => o.id === p013.id)
    push(
      'simultaneous-updates',
      Number(u014?.lines?.[0]?.deliveredQty) >= 1 && Number(u013?.lines?.[0]?.deliveredQty) >= 1,
      `E014 delivered=${u014?.lines?.[0]?.deliveredQty} E013 delivered=${u013?.lines?.[0]?.deliveredQty}`,
    )
  } else {
    push('simultaneous-updates', false, 'missing pending tickets to patch')
  }

  // Tombstone: delete one E014 pending on A while B creates
  const delTarget = (await readOps(pageA)).orders.find(
    (o) => o.eventId === 'E014' && o.status === 'pending' && !o.voided && o.source === 'pos' && o.createdAt >= since,
  )
  if (delTarget) {
    pageA.once('dialog', (d) => d.accept())
    await clickText(pageA, 'Pending')
    await new Promise((r) => setTimeout(r, 300))
    await Promise.all([
      pageA.evaluate((id) => {
        const ops = JSON.parse(localStorage.getItem('nasta-stall-ops-v1'))
        ops.deletedOrderIds = [...new Set([...(ops.deletedOrderIds || []), id])]
        ops.orders = (ops.orders || []).filter((o) => o.id !== id)
        localStorage.setItem('nasta-stall-ops-v1', JSON.stringify(ops))
      }, delTarget.id),
      createTicket(pageB, 'E013', 'Mango lassi'),
    ])
    await clickText(pageA, 'New order').catch(() => undefined)
    await new Promise((r) => setTimeout(r, 2500))
    await Promise.all([refresh(pageA), refresh(pageB)])
    const afterDel = await readOps(pageA)
    const resurrected = (afterDel.orders || []).some((o) => o.id === delTarget.id)
    const tomb = (afterDel.deletedOrderIds || []).includes(delTarget.id)
    push('tombstone', !resurrected && tomb, `deleted ${delTarget.id} resurrected=${resurrected} tomb=${tomb}`)
  } else {
    push('tombstone', false, 'no delete target')
  }

  // Pay two tickets (one each stall) overlapping, plus double confirm
  await clickText(pageA, 'Pending').catch(() => undefined)
  await selectEvent(pageA, 'E014').catch(() => undefined)
  const pay014 = (await pendingLabels(pageA, 'E014'))[0]
  const pay013 = (await pendingLabels(pageB, 'E013'))[0]
  let payA = { confirmed: false }
  let payB = { confirmed: false }
  if (pay014 && pay013) {
    await clickText(pageA, 'Pending')
    await clickText(pageB, 'Pending')
    await new Promise((r) => setTimeout(r, 400))
    payA = await deliverAndPay(pageA, pay014.id)
    payB = await deliverAndPay(pageB, pay013.id)
  }
  await new Promise((r) => setTimeout(r, 2000))
  await Promise.all([refresh(pageA), refresh(pageB)])

  const afterPay = summary(await readOps(pageA), since)
  const sold014 = (afterPay.byEvent.E014 || []).filter((o) => o.status === 'completed' && !o.voided)
  const sold013 = (afterPay.byEvent.E013 || []).filter((o) => o.status === 'completed' && !o.voided)
  report.actual.sold014 = sold014
  report.actual.sold013 = sold013
  push('complete-both-stalls', sold014.length >= 1 && sold013.length >= 1, `sold E014=${sold014.length} E013=${sold013.length}`)

  const rev014 = sold014.reduce((s, o) => s + o.total, 0)
  const rev013 = sold013.reduce((s, o) => s + o.total, 0)
  const expectedChai = 2
  const expectedLassi = 3.5
  const manual014 = sold014.length * expectedChai
  const manual013 = sold013.length * expectedLassi
  push('revenue-e014', Math.abs(rev014 - manual014) < 0.001, `app ${rev014} manual ${manual014}`)
  push('revenue-e013', Math.abs(rev013 - manual013) < 0.001, `app ${rev013} manual ${manual013}`)

  const stockAfter = (await readOps(pageA)).stock || []
  const chai = stockAfter.find((s) => s.id === 'chai-cup')
  const lassi = stockAfter.find((s) => s.id === 'lassi-cup')
  const chaiBefore = report.devices.beforeStock.find((s) => s.id === 'chai-cup')
  const lassiBefore = report.devices.beforeStock.find((s) => s.id === 'lassi-cup')
  const chaiSold = sold014.reduce((n, o) => n + o.lines.reduce((x, l) => x + (l.toLowerCase().includes('chai') ? Number(l.match(/^(\d+)/)?.[1] || 1) : 0), 0), 0)
  // parse "1x Masala chai @2"
  const qtyFrom = (rows, re) =>
    rows.reduce((n, o) => {
      for (const l of o.lines) {
        if (re.test(l)) n += Number(/^(\d+)/.exec(l)?.[1] || 0)
      }
      return n
    }, 0)
  const chaiQty = qtyFrom(sold014, /chai/i)
  const lassiQty = qtyFrom(sold013, /lassi/i)
  report.actual.stock = {
    chaiUsed: chai?.used,
    lassiUsed: lassi?.used,
    chaiBefore: chaiBefore?.used,
    lassiBefore: lassiBefore?.used,
    chaiQty,
    lassiQty,
  }
  push(
    'stock-chai',
    Number(chai?.used) >= Number(chaiBefore?.used || 0) + chaiQty,
    `used ${chai?.used} before ${chaiBefore?.used} soldQty ${chaiQty}`,
  )
  push(
    'stock-lassi',
    Number(lassi?.used) >= Number(lassiBefore?.used || 0) + lassiQty,
    `used ${lassi?.used} before ${lassiBefore?.used} soldQty ${lassiQty}`,
  )

  // Sale-date filter: completed today should appear for E013 even if calendar starts 21 Aug
  await clickText(pageA, 'Sold')
  await new Promise((r) => setTimeout(r, 500))
  if (await pageA.$('#sold-event')) await pageA.select('#sold-event', 'E013')
  await new Promise((r) => setTimeout(r, 400))
  const soldDays = await pageA.evaluate(() =>
    [...document.querySelectorAll('#sold-day option')].map((o) => o.value || o.textContent),
  )
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })
  push('sold-day-includes-today', soldDays.some((d) => String(d).includes(today)), `today=${today} options=${soldDays.join('|')}`)

  // Independent pending selector vs sold
  await clickText(pageA, 'Pending')
  if (await pageA.$('#pending-event')) await pageA.select('#pending-event', 'E014')
  await clickText(pageA, 'Sold')
  const soldVal = await pageA.$eval('#sold-event', (el) => el.value).catch(() => '')
  push('selectors-independent', soldVal === 'E013' || soldVal === '', `soldVal=${soldVal} pending set E014`)

  // Independent browser tabs (same profile, sessionStorage)
  const pageA2 = await a.browser.newPage()
  await pageA2.goto(`${LIVE}/orders`, { waitUntil: 'networkidle2' })
  await waitOrders(pageA2)
  await selectEvent(pageA2, 'E013')
  await selectEvent(pageA, 'E014')
  const t1 = await pageA.$eval('#active-event', (el) => el.value)
  const t2 = await pageA2.$eval('#active-event', (el) => el.value)
  push('tab-event-independent', t1 === 'E014' && t2 === 'E013', `tab1=${t1} tab2=${t2}`)
  await pageA2.close()

  // Refresh neither lost nor duplicated
  const ids1 = (await readOps(pageA)).orders.filter((o) => o.createdAt >= since).map((o) => o.id).sort()
  await Promise.all([refresh(pageA), refresh(pageB)])
  const ids2 = (await readOps(pageA)).orders.filter((o) => o.createdAt >= since).map((o) => o.id).sort()
  const idsB = (await readOps(pageB)).orders.filter((o) => o.createdAt >= since).map((o) => o.id).sort()
  push('refresh-stable', ids1.join() === ids2.join() && ids2.join() === idsB.join(), `n=${ids2.length}`)
  const dup = ids2.filter((id, i) => ids2.indexOf(id) !== i)
  push('no-duplicate-ids', dup.length === 0, dup.join(',') || 'none')

  report.actual.qaOrderCount = ids2.length
  report.actual.e014 = (await readOps(pageA)).orders.filter((o) => o.eventId === 'E014' && o.createdAt >= since && !o.voided).map((o) => ({
    id: o.id, label: o.label, status: o.status, source: o.source, total: (o.lines || []).reduce((s, l) => s + l.price * l.qty, 0),
  }))
  report.actual.e013 = (await readOps(pageA)).orders.filter((o) => o.eventId === 'E013' && o.createdAt >= since && !o.voided).map((o) => ({
    id: o.id, label: o.label, status: o.status, source: o.source, total: (o.lines || []).reduce((s, l) => s + l.price * l.qty, 0),
  }))

  // Cleanup QA tickets so Saturday stays clean
  await pageA.evaluate((iso) => {
    const ops = JSON.parse(localStorage.getItem('nasta-stall-ops-v1') || '{}')
    const kill = (ops.orders || []).filter((o) => String(o.createdAt || '') >= iso).map((o) => o.id)
    ops.deletedOrderIds = [...new Set([...(ops.deletedOrderIds || []), ...kill])]
    ops.orders = (ops.orders || []).filter((o) => !kill.includes(o.id))
    localStorage.setItem('nasta-stall-ops-v1', JSON.stringify(ops))
  }, since)
  await clickText(pageA, 'New order').catch(() => undefined)
  await new Promise((r) => setTimeout(r, 2500))
  await refresh(pageA)
  const leftover = (await readOps(pageA)).orders.filter((o) => o.createdAt >= since)
  report.cleanup = { leftover: leftover.length, tombstones: (await readOps(pageA)).deletedOrderIds?.length }

  report.failed = fails
  report.passCount = report.checks.filter((c) => c.ok).length
  report.failCount = report.checks.filter((c) => !c.ok).length
  report.verdict =
    report.failCount === 0 && report.actual.qaOrderCount >= 10
      ? 'PRODUCTION READY FOR TWO SIMULTANEOUS STALLS'
      : 'NOT READY'
  report.finishedAt = new Date().toISOString()
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ out: OUT, verdict: report.verdict, pass: report.passCount, fail: report.failCount, qa: report.actual.qaOrderCount, failed: report.failed }, null, 2))
  await browserA.close()
  await browserB.close()
  process.exit(report.failCount ? 2 : 0)
} catch (e) {
  report.fatal = String(e?.stack || e)
  report.verdict = 'NOT READY'
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
  console.error(report.fatal)
  await browserA.close().catch(() => undefined)
  await browserB.close().catch(() => undefined)
  process.exit(1)
}
