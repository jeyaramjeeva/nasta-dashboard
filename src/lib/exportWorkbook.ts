/** Rebuild an .xlsx from a stored Snapshot (download from upload history). */

import * as XLSX from 'xlsx'
import type { Snapshot } from '../types'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function ensureXlsxName(name: string): string {
  const base = (name || 'nasta-snapshot').replace(/[<>:"/\\|?*]+/g, '_')
  if (/\.xlsx$/i.test(base)) return base
  if (/\.xls$/i.test(base)) return base.replace(/\.xls$/i, '.xlsx')
  return `${base}.xlsx`
}

/** Build workbook bytes matching the sheets the app reads. */
export function snapshotToWorkbook(snapshot: Snapshot): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  const eventsAoA: unknown[][] = [
    ['Nasta Zentrum — Events (exported from app)'],
    [],
    ['ID', 'Name', 'Location', 'Start', 'End', 'Month', 'Days', 'Fee', 'Status'],
    ...snapshot.events.map((e) => [
      e.id,
      e.name,
      e.location,
      e.startDate,
      e.endDate,
      e.month,
      e.days,
      e.fee,
      e.status,
    ]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eventsAoA), 'Events')

  const txAoA: unknown[][] = [
    [
      'Date',
      'Month',
      'Event ID',
      'Purchase Date',
      'Type',
      'Cost Type',
      'Category',
      'Description',
      'Amount',
      'Person',
      'Status',
    ],
    ...snapshot.transactions.map((t) => [
      t.date,
      t.month,
      t.eventId,
      t.purchaseDate,
      t.type,
      t.costType,
      t.category,
      t.description,
      t.amount,
      t.person,
      t.status,
    ]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(txAoA), 'Transactions')

  const cashAoA: unknown[][] = [
    ['Cash Box (exported)', `PayPal ${snapshot.paypalBalance ?? 0}`],
    [],
    ['Event ID', 'Date', 'Type', 'Description', 'In', 'Out', 'Balance'],
    ...snapshot.cashBox.map((r) => [
      r.eventId,
      r.date,
      r.transactionType,
      r.description,
      r.inAmount,
      r.outAmount,
      r.balance,
    ]),
    [],
    ['Denominations'],
    ['Label', 'Count'],
    ...(snapshot.denominations || []).map((d) => [d.label, d.count]),
    [],
    ['Coin reserve'],
    ['Label', 'Count'],
    ...(snapshot.coinReserve || []).map((d) => [d.label, d.count]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cashAoA), 'Cash Box')

  const partnerAoA: unknown[][] = [
    ['Name', 'Paid', 'Returned', 'Balance'],
    ...snapshot.partners.map((p) => [p.name, p.paid, p.returned, p.balance]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(partnerAoA), 'Partner Balance')

  const ecbAoA: unknown[][] = [['Event Cash Box (exported counts)']]
  for (const row of snapshot.eventCashCounts || []) {
    ecbAoA.push([])
    ecbAoA.push([row.eventId])
    if (row.before?.length) {
      ecbAoA.push(['Before'])
      for (const d of row.before) ecbAoA.push([d.label, d.count])
    }
    if (row.after?.length) {
      ecbAoA.push(['After'])
      for (const d of row.after) ecbAoA.push([d.label, d.count])
    }
    if (row.startOfDay?.length) {
      ecbAoA.push(['Start-of-Day'])
      for (const d of row.startOfDay) ecbAoA.push([d.label, d.count])
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ecbAoA), 'Event Cash Box')

  return wb
}

export function downloadSnapshotExcel(snapshot: Snapshot, filename?: string) {
  const wb = snapshotToWorkbook(snapshot)
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, ensureXlsxName(filename || snapshot.sourceFile || 'nasta-export.xlsx'))
}
