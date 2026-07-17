import * as XLSX from 'xlsx'
import { countCash, isDenomLabel } from './cash'
import { germanyWallTime, germanyYmd } from './germanyTime'
import type {
  CashBoxRow,
  Denomination,
  EventCashCount,
  EventRow,
  PartnerRow,
  Snapshot,
  Transaction,
} from '../types'

function cell(row: unknown[], idx: number): unknown {
  return row[idx] ?? null
}

function asString(v: unknown): string {
  if (v == null || v === '') return ''
  return String(v).trim()
}

function asNumber(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number' && Number.isFinite(v)) return v
  let s = String(v)
    .trim()
    .replace(/€/g, '')
    .replace(/\s/g, '')
    .replace(/'/g, '')
  // €3,266.34 or 3.266,34
  if (/,\d{1,2}$/.test(s) && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '')
  } else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/**
 * Excel serial date or Date or string → ISO yyyy-mm-dd (always Europe/Berlin).
 * Never use toISOString().slice(0,10) — that shifts CET/CEST dates back one day.
 */
function asDate(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return germanyYmd(v)
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const parsed = XLSX.SSF.parse_date_code(v)
    if (!parsed) return null
    const mm = String(parsed.m).padStart(2, '0')
    const dd = String(parsed.d).padStart(2, '0')
    return `${parsed.y}-${mm}-${dd}`
  }
  const s = String(v).trim()
  // dd.mm.yyyy or dd-mm-yyyy
  const de = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (de) {
    return `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return germanyYmd(d)
  return s
}

function monthFromDate(iso: string | null): string | null {
  if (!iso || iso.length < 7) return null
  return iso.slice(0, 7)
}

function sheetRows(wb: XLSX.WorkBook, name: string): unknown[][] {
  const sheet = wb.Sheets[name]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][]
}

function parseEvents(rows: unknown[][]): EventRow[] {
  const out: EventRow[] = []
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const id = asString(cell(row, 0))
    const name = asString(cell(row, 1))
    if (!id || !name) continue
    const startDate = asDate(cell(row, 3))
    const endDate = asDate(cell(row, 4))
    let days = asNumber(cell(row, 6))
    if (!days && startDate && endDate) {
      const a = germanyWallTime(startDate, 12, 0)?.getTime()
      const b = germanyWallTime(endDate, 12, 0)?.getTime()
      if (a != null && b != null) {
        days = Math.max(1, Math.round((b - a) / 86400000) + 1)
      }
    }
    out.push({
      id,
      name,
      location: asString(cell(row, 2)),
      startDate,
      endDate,
      month: asString(cell(row, 5)) || monthFromDate(startDate),
      days: days || 0,
      fee: Math.abs(asNumber(cell(row, 7))),
      status: asString(cell(row, 8)),
    })
  }
  return out
}

function parseTransactions(rows: unknown[][]): Transaction[] {
  const out: Transaction[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const type = asString(cell(row, 4))
    const amount = cell(row, 8)
    const eventId = asString(cell(row, 2))
    const description = asString(cell(row, 7))
    if (!type && amount == null && !eventId && !description) continue
    if (!type && amount == null) continue
    const purchaseDate = asDate(cell(row, 3)) ?? (asString(cell(row, 3)) || null)
    const date = asDate(cell(row, 0)) || purchaseDate
    out.push({
      date,
      month: asString(cell(row, 1)) || monthFromDate(date),
      eventId,
      purchaseDate,
      type,
      costType: asString(cell(row, 5)),
      category: asString(cell(row, 6)),
      description,
      amount: asNumber(amount),
      person: asString(cell(row, 9)),
      status: asString(cell(row, 10)),
    })
  }
  return out
}

function isLedgerEventId(eventId: string): boolean {
  const id = eventId.trim()
  if (id === 'Setup') return true
  return /^E\d+$/i.test(id)
}

function parseCashBox(rows: unknown[][]): {
  rows: CashBoxRow[]
  denominations: Denomination[]
  paypalBalance: number
  coinReserve: Denomination[]
  coinReserveTotal: number
  mainBoxTotal: number
  allBoxesTotal: number
} {
  const cash: CashBoxRow[] = []
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const eventId = asString(cell(row, 0))
    if (!eventId || !isLedgerEventId(eventId)) continue
    const transactionType = asString(cell(row, 2))
    const description = asString(cell(row, 3))
    if (!transactionType && !description && cell(row, 4) == null && cell(row, 5) == null) {
      continue
    }
    cash.push({
      eventId,
      date: asDate(cell(row, 1)),
      transactionType,
      description,
      inAmount: asNumber(cell(row, 4)),
      outAmount: asNumber(cell(row, 5)),
      balance: cell(row, 6) == null || cell(row, 6) === '' ? null : asNumber(cell(row, 6)),
    })
  }

  const denominations: Denomination[] = []
  let paypalBalance = 0
  for (let i = 2; i < 40; i++) {
    const row = rows[i]
    if (!row) continue
    const label = asString(cell(row, 9))
    if (/^paypal$/i.test(label)) {
      paypalBalance = asNumber(cell(row, 11)) || asNumber(cell(row, 10))
      continue
    }
    if (!label) continue
    if (/^(cash|current count|count|total)$/i.test(label)) continue
    if (!isDenomLabel(label)) continue
    denominations.push({ label, count: Math.round(asNumber(cell(row, 10))) })
  }

  // Coin reserve block: look for header then denomination rows
  const coinReserve: Denomination[] = []
  let reserveStart = -1
  let mainBoxTotal = 0
  let allBoxesTotal = 0
  let coinReserveTotal = 0
  for (let i = 0; i < rows.length; i++) {
    const label = asString(cell(rows[i] || [], 0))
    // Match "COIN RESERVE BOX" header only — not "Coin Reserve Box Balance"
    if (/coin reserve box(?!\s*balance)/i.test(label) || /^[^\w]*coin reserve\b/i.test(label)) {
      if (!/balance/i.test(label)) reserveStart = i
    }
    if (/main cash box balance/i.test(label)) mainBoxTotal = asNumber(cell(rows[i] || [], 4))
    if (/coin reserve box balance/i.test(label)) coinReserveTotal = asNumber(cell(rows[i] || [], 4))
    if (/total cash \(all boxes\)/i.test(label)) allBoxesTotal = asNumber(cell(rows[i] || [], 4))
  }
  if (reserveStart >= 0) {
    for (let i = reserveStart + 1; i < Math.min(reserveStart + 20, rows.length); i++) {
      const row = rows[i] || []
      const label = asString(cell(row, 0))
      if (!label) continue
      if (/denomination|total reserve|transfer|summary/i.test(label)) continue
      if (!isDenomLabel(label)) {
        if (/^total\b/i.test(label)) break
        continue
      }
      coinReserve.push({ label, count: Math.round(asNumber(cell(row, 1))) })
    }
  }
  if (!coinReserveTotal && coinReserve.length) {
    coinReserveTotal = countCash(coinReserve)
  }
  const countedMain = countCash(denominations) + paypalBalance
  if (!mainBoxTotal) mainBoxTotal = countedMain
  if (!allBoxesTotal) allBoxesTotal = mainBoxTotal + coinReserveTotal

  return {
    rows: cash,
    denominations,
    paypalBalance,
    coinReserve,
    coinReserveTotal,
    mainBoxTotal,
    allBoxesTotal,
  }
}

/** Parse a denomination block starting at headerRow (Cash/Count/Total on next row). */
function parseDenomBlock(
  rows: unknown[][],
  col: number,
  headerRow: number,
): { denoms: Denomination[]; paypal: number; cashTotal: number } {
  const denoms: Denomination[] = []
  let paypal = 0
  let cashTotal = 0

  let i = headerRow + 1
  const head = asString(cell(rows[i] || [], col))
  if (/^cash$/i.test(head)) i += 1

  const end = Math.min(i + 22, rows.length)
  for (; i < end; i++) {
    const row = rows[i] || []
    const label = asString(cell(row, col))
    const mid = asString(cell(row, col + 1))

    if (/paypal/i.test(label) && !/mit/i.test(label)) {
      paypal = asNumber(cell(row, col + 2)) || asNumber(cell(row, col + 1)) || paypal
      continue
    }
    if (/cash counted/i.test(mid) || /cash counted/i.test(label)) {
      cashTotal = asNumber(cell(row, col + 2)) || asNumber(cell(row, col + 1))
      continue
    }
    if (/mit paypal/i.test(mid) || /mit paypal/i.test(label)) continue

    if (isDenomLabel(label)) {
      denoms.push({ label, count: Math.round(asNumber(cell(row, col + 1))) })
      continue
    }

    // Next section header (Day 2, Start-of-Day, E00x, Before…)
    if (
      label &&
      (/^day\s*\d+/i.test(label) ||
        /start-?of-?day/i.test(label) ||
        /^E\d+$/i.test(label) ||
        /before/i.test(label))
    ) {
      break
    }
  }

  if (!cashTotal) cashTotal = countCash(denoms)
  return { denoms, paypal, cashTotal }
}

function parseEventCashBox(rows: unknown[][]): EventCashCount[] {
  if (!rows.length) return []
  const map = new Map<string, EventCashCount>()
  /** Column index → event id from the top strip. */
  const colEvent = new Map<number, string>()
  let lastEventId = ''

  const ensure = (id: string) => {
    if (!map.has(id)) {
      map.set(id, {
        eventId: id,
        before: [],
        after: [],
        startOfDay: [],
        beforePaypal: 0,
        afterPaypal: 0,
        beforeCash: 0,
        afterCash: 0,
      })
    }
    return map.get(id)!
  }

  const applyBefore = (
    entry: EventCashCount,
    block: ReturnType<typeof parseDenomBlock>,
    force = false,
  ) => {
    if (!force && entry.before.length && entry.beforeCash > 0) return
    entry.before = block.denoms
    entry.beforePaypal = block.paypal
    entry.beforeCash = block.cashTotal
  }

  // Top strip: E### = after count; "Before Event" = explicit before
  const top = rows[0] || []
  for (let col = 0; col < Math.max(top.length, 40); col++) {
    const header = asString(cell(top, col))
    if (!header) continue
    if (/^E\d+$/i.test(header)) {
      lastEventId = header.toUpperCase()
      colEvent.set(col, lastEventId)
      const block = parseDenomBlock(rows, col, 0)
      const entry = ensure(lastEventId)
      entry.after = block.denoms
      entry.afterPaypal = block.paypal
      entry.afterCash = block.cashTotal
    } else if (/before/i.test(header) && lastEventId) {
      colEvent.set(col, lastEventId)
      const block = parseDenomBlock(rows, col, 0)
      applyBefore(ensure(lastEventId), block, true)
    }
  }

  // Lower sections: "Start-of-Day Count" (and Day 1 when no other before exists)
  for (let row = 1; row < rows.length; row++) {
    const line = rows[row] || []
    for (let col = 0; col < line.length; col++) {
      const header = asString(cell(line, col))
      if (!header) continue

      const eventId = colEvent.get(col)
      if (!eventId) continue

      const isStartOfDay = /start-?of-?day/i.test(header)
      const isDay1 = /^day\s*1$/i.test(header)
      if (!isStartOfDay && !isDay1) continue

      const block = parseDenomBlock(rows, col, row)
      if (!block.denoms.length && !block.cashTotal) continue

      const entry = ensure(eventId)
      if (isStartOfDay) {
        entry.startOfDay = block.denoms
        applyBefore(entry, block, true)
      } else if (isDay1 && !entry.before.length && !entry.startOfDay.length) {
        // First Day 1 block only — later "Day 1" under multi-day is mid-event
        entry.startOfDay = block.denoms
        applyBefore(entry, block)
      }
    }
  }

  // Final fallback: startOfDay → before
  for (const entry of map.values()) {
    if (!entry.before.length && entry.startOfDay.length) {
      entry.before = entry.startOfDay
      entry.beforeCash = countCash(entry.startOfDay)
    }
  }

  return [...map.values()].sort((a, b) => a.eventId.localeCompare(b.eventId))
}

function parsePartners(rows: unknown[][], transactions: Transaction[]): PartnerRow[] {
  const fromSheet: PartnerRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const name = asString(cell(row, 0))
    if (!name || name.toLowerCase() === 'box') continue
    fromSheet.push({
      name,
      paid: asNumber(cell(row, 1)),
      returned: asNumber(cell(row, 2)),
      balance: asNumber(cell(row, 3)),
    })
  }

  // Recompute from transactions so we don't rely on Excel formula cache
  const names = new Set<string>()
  for (const p of fromSheet) names.add(p.name)
  for (const t of transactions) {
    if (t.person && !['Box', 'Paypal', 'PayPal'].includes(t.person)) names.add(t.person)
  }

  return [...names].map((name) => {
    const paid = transactions
      .filter((t) => t.person === name && t.type === 'Expense')
      .reduce((s, t) => s + Math.abs(t.amount), 0)
    const returned = transactions
      .filter((t) => t.person === name && t.type === 'Settlement')
      .reduce((s, t) => s + Math.abs(t.amount), 0)
    return { name, paid, returned, balance: paid - returned }
  })
}

export function parseWorkbook(buffer: ArrayBuffer, sourceFile: string): Snapshot {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const events = parseEvents(sheetRows(wb, 'Events'))
  const transactions = parseTransactions(sheetRows(wb, 'Transactions'))
  const {
    rows: cashBox,
    denominations,
    paypalBalance,
    coinReserve,
    coinReserveTotal,
    mainBoxTotal,
    allBoxesTotal,
  } = parseCashBox(sheetRows(wb, 'Cash Box'))
  const eventCashCounts = parseEventCashBox(sheetRows(wb, 'Event Cash Box'))
  const partners = parsePartners(sheetRows(wb, 'Partner Balance'), transactions)

  return {
    uploadedAt: new Date().toISOString(),
    sourceFile,
    events,
    transactions,
    cashBox,
    denominations,
    paypalBalance,
    partners,
    eventCashCounts,
    coinReserve,
    coinReserveTotal,
    mainBoxTotal,
    allBoxesTotal,
  }
}

export async function parseWorkbookFile(file: File): Promise<Snapshot> {
  const buffer = await file.arrayBuffer()
  return parseWorkbook(buffer, file.name)
}
