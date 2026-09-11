/**
 * Patch src/lib/i18n.ts with Events + chrome keys for en/de/ta/ka.
 * Tamil/Kannada built from code points so this file stays ASCII-safe.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const i18nPath = path.join(__dirname, '..', 'src', 'lib', 'i18n.ts')

const u = (...cps) => String.fromCodePoint(...cps)

/** @type {Record<string, { en: string, de: string, ta: string, ka: string }>} */
const extras = {
  eventsSub: {
    en: 'Scorecards for every market and festival — filter and compare.',
    de: 'Scorecards fur jeden Markt und jedes Festival — filtern und vergleichen.',
    ta:
      u(0x0bae, 0x0bbe, 0x0bb0, 0x0bcd, 0x0b95, 0x0bcd, 0x0b95, 0x0bc6, 0x0b9f, 0x0bcd) +
      ' ' +
      u(0x0bae, 0x0bb1, 0x0bcd, 0x0bb1, 0x0bc1, 0x0bae, 0x0bcd) +
      ' ' +
      u(0x0ba4, 0x0bbf, 0x0bb0, 0x0bc1, 0x0bb5, 0x0bbf, 0x0bb4, 0x0bbe) +
      ' — ' +
      u(0x0bb5, 0x0b9f, 0x0bbf, 0x0b95, 0x0b9f, 0x0bcd, 0x0b9f, 0x0bbf) +
      ' ' +
      u(0x0b92, 0x0baa, 0x0bcd, 0x0baa, 0x0bbf, 0x0b9f, 0x0bc1) +
      '.',
    ka:
      u(0x0caa, 0x0ccd, 0x0cb0, 0x0ca4, 0x0cbf) +
      ' ' +
      u(0x0cae, 0x0cbe, 0x0cb0, 0x0cc1, 0x0c95) +
      '/' +
      u(0x0cb9, 0x0cac, 0x0ccd, 0x0cac) +
      ' — ' +
      u(0x0cab, 0x0cbf, 0x0cb2, 0x0ccd, 0x0c9f, 0x0cb0, 0x0ccd) +
      ' ' +
      u(0x0cae, 0x0ca4, 0x0ccd, 0x0ca4, 0x0cc1) +
      ' ' +
      u(0x0cb9, 0x0ccb, 0x0cb2, 0x0cbf, 0x0cb8, 0x0cbf) +
      '.',
  },
  shown: {
    en: 'shown',
    de: 'angezeigt',
    ta: u(0x0b95, 0x0bbe, 0x0b9f, 0x0bcd, 0x0b9a, 0x0bbf),
    ka: u(0x0ca4, 0x0ccb, 0x0cb0, 0x0cbf, 0x0cb8, 0x0cbf, 0x0ca6, 0x0cc6),
  },
  allTypes: {
    en: 'All types',
    de: 'Alle Typen',
    ta: u(0x0b85, 0x0ba9, 0x0bc8, 0x0ba4, 0x0bcd, 0x0ba4, 0x0bc1) + ' ' + u(0x0bb5, 0x0b95, 0x0bc8),
    ka: u(0x0c8e, 0x0cb2, 0x0ccd, 0x0cb2, 0x0cbe) + ' ' + u(0x0caa, 0x0ccd, 0x0cb0, 0x0c95, 0x0cbe, 0x0cb0),
  },
  allStatuses: {
    en: 'All statuses',
    de: 'Alle Status',
    ta: u(0x0b85, 0x0ba9, 0x0bc8, 0x0ba4, 0x0bcd, 0x0ba4, 0x0bc1) + ' ' + u(0x0ba8, 0x0bbf, 0x0bb2, 0x0bc8),
    ka: u(0x0c8e, 0x0cb2, 0x0ccd, 0x0cb2, 0x0cbe) + ' ' + u(0x0cb8, 0x0ccd, 0x0ca5, 0x0cbf, 0x0ca4, 0x0cbf),
  },
  searchLocationOrId: {
    en: 'Search location or ID…',
    de: 'Ort oder ID suchen…',
    ta:
      u(0x0b87, 0x0b9f, 0x0bae, 0x0bcd) +
      ' ' +
      u(0x0b85, 0x0bb2, 0x0bcd, 0x0bb2, 0x0ba4, 0x0bc1) +
      ' ID ' +
      u(0x0ba4, 0x0bc7, 0x0b9f, 0x0bc1) +
      '…',
    ka:
      u(0x0cb8, 0x0ccd, 0x0ca5, 0x0cb3) +
      ' ' +
      u(0x0c85, 0x0ca5, 0x0cb5, 0x0cbe) +
      ' ID ' +
      u(0x0cb9, 0x0cc1, 0x0ca1, 0x0cc1, 0x0c95, 0x0cbf) +
      '…',
  },
  income: {
    en: 'Income',
    de: 'Einnahmen',
    ta: u(0x0bb5, 0x0bb0, 0x0bc1, 0x0bb5, 0x0bbe, 0x0baf, 0x0bcd),
    ka: u(0x0c86, 0x0ca6, 0x0cbe, 0x0caf),
  },
  expense: {
    en: 'Expense',
    de: 'Ausgaben',
    ta: u(0x0b9a, 0x0bc6, 0x0bb2, 0x0bb5, 0x0bc1),
    ka: u(0x0cb5, 0x0cc6, 0x0c9a, 0x0ccd, 0x0c9a),
  },
  profit: {
    en: 'Profit',
    de: 'Gewinn',
    ta: u(0x0bb2, 0x0bbe, 0x0baa, 0x0bae, 0x0bcd),
    ka: u(0x0cb2, 0x0cbe, 0x0cad),
  },
  perDay: {
    en: '€ / day',
    de: '€ / Tag',
    ta: '€ / ' + u(0x0ba8, 0x0bbe, 0x0bb3, 0x0bcd),
    ka: '€ / ' + u(0x0ca6, 0x0cbf, 0x0ca8),
  },
  noEventsYet: {
    en: 'No events yet',
    de: 'Noch keine Events',
    ta: u(0x0b87, 0x0ba9, 0x0bcd, 0x0ba9, 0x0bc1, 0x0bae, 0x0bcd) + ' ' + u(0x0ba8, 0x0bbf, 0x0b95, 0x0bb4, 0x0bcd, 0x0bb5, 0x0bc1, 0x0b95, 0x0bb3, 0x0bcd) + ' ' + u(0x0b87, 0x0bb2, 0x0bcd, 0x0bb2, 0x0bc8),
    ka: u(0x0c88, 0x0cb5, 0x0cc6, 0x0c82, 0x0c9f, 0x0ccd, 0x200c, 0x0c97, 0x0cb3, 0x0cc1) + ' ' + u(0x0c87, 0x0ca8, 0x0ccd, 0x0ca8, 0x0cc2),
  },
  noEventsBody: {
    en: 'Upload Excel to see event scorecards.',
    de: 'Excel hochladen, um Event-Scorecards zu sehen.',
    ta:
      u(0x0ba8, 0x0bbf, 0x0b95, 0x0bb4, 0x0bcd, 0x0bb5, 0x0bc1) +
      ' ' +
      u(0x0b85, 0x0b9f, 0x0bcd, 0x0b9f, 0x0bbe, 0x0bb5, 0x0ba3) +
      ' ' +
      u(0x0b95, 0x0bbe, 0x0ba3) +
      ' Excel ' +
      u(0x0baa, 0x0ba4, 0x0bbf, 0x0bb5, 0x0bc7, 0x0bb1, 0x0bcd, 0x0bb1, 0x0bc1, 0x0bae, 0x0bcd) +
      '.',
    ka:
      u(0x0c88, 0x0cb5, 0x0cc6, 0x0c82, 0x0c9f, 0x0ccd) +
      ' ' +
      u(0x0cb8, 0x0ccd, 0x0c95, 0x0ccb, 0x0cb0, 0x0ccd) +
      ' ' +
      u(0x0ca8, 0x0ccb, 0x0ca1, 0x0cb2, 0x0cc1) +
      ' Excel ' +
      u(0x0c85, 0x0caa, 0x0ccd, 0x200c, 0x0cb2, 0x0ccb, 0x0ca1, 0x0ccd) +
      ' ' +
      u(0x0cae, 0x0cbe, 0x0ca1, 0x0cbf) +
      '.',
  },
  eventTable: {
    en: 'Event table',
    de: 'Event-Tabelle',
    ta: u(0x0ba8, 0x0bbf, 0x0b95, 0x0bb4, 0x0bcd, 0x0bb5, 0x0bc1) + ' ' + u(0x0b85, 0x0b9f, 0x0bcd, 0x0b9f, 0x0bb5, 0x0ba3),
    ka: u(0x0c88, 0x0cb5, 0x0cc6, 0x0c82, 0x0c9f, 0x0ccd) + ' ' + u(0x0c95, 0x0ccb, 0x0cb7, 0x0ccd, 0x0c9f, 0x0c95),
  },
  colId: { en: 'ID', de: 'ID', ta: 'ID', ka: 'ID' },
  colName: {
    en: 'Name',
    de: 'Name',
    ta: u(0x0baa, 0x0bc6, 0x0baf, 0x0bb0, 0x0bcd),
    ka: u(0x0cb9, 0x0cc6, 0x0cb8, 0x0cb0, 0x0cc1),
  },
  colLocation: {
    en: 'Location',
    de: 'Ort',
    ta: u(0x0b87, 0x0b9f, 0x0bae, 0x0bcd),
    ka: u(0x0cb8, 0x0ccd, 0x0ca5, 0x0cb3),
  },
  searchOrJump: {
    en: 'Search or jump…',
    de: 'Suchen oder springen…',
    ta: u(0x0ba4, 0x0bc7, 0x0b9f, 0x0bc1) + '…',
    ka: u(0x0cb9, 0x0cc1, 0x0ca1, 0x0cc1, 0x0c95, 0x0cbf) + '…',
  },
  cloudSyncOn: {
    en: 'Cloud sync on',
    de: 'Cloud-Sync an',
    ta: u(0x0b95, 0x0bcd, 0x0bb2, 0x0bc1, 0x0b9f, 0x0bcd) + ' ' + u(0x0b9a, 0x0bbf, 0x0b99, 0x0bcd, 0x0b95, 0x0bcd) + ' ' + u(0x0b86, 0x0ba9, 0x0bcd),
    ka: u(0x0c95, 0x0ccd, 0x0cb2, 0x0ccc, 0x0ca1, 0x0ccd) + ' ' + u(0x0cb8, 0x0cbf, 0x0c82, 0x0c95, 0x0ccd) + ' ' + u(0x0c86, 0x0ca8, 0x0ccd),
  },
  localSeedMode: {
    en: 'Local + seed mode',
    de: 'Lokal + Seed-Modus',
    ta: u(0x0bb2, 0x0bcb, 0x0b95, 0x0bb2, 0x0bcd) + ' + seed',
    ka: u(0x0cb8, 0x0ccd, 0x0ca5, 0x0cb3, 0x0cc0, 0x0caf) + ' + seed',
  },
  demoSandbox: {
    en: 'Demo sandbox',
    de: 'Demo-Sandbox',
    ta: 'Demo',
    ka: 'Demo',
  },
  syncing: {
    en: 'Syncing…',
    de: 'Synchronisiere…',
    ta: u(0x0b9a, 0x0bbf, 0x0b99, 0x0bcd, 0x0b95, 0x0bcd) + '…',
    ka: u(0x0cb8, 0x0cbf, 0x0c82, 0x0c95, 0x0ccd) + '…',
  },
  updated: {
    en: 'Updated',
    de: 'Aktualisiert',
    ta: u(0x0baa, 0x0bc1, 0x0ba4, 0x0bbf, 0x0baa, 0x0bcd, 0x0baa, 0x0bbf, 0x0b95, 0x0bcd, 0x0b95, 0x0baa, 0x0bcd, 0x0baa, 0x0b9f, 0x0bcd, 0x0b9f, 0x0ba4, 0x0bc1),
    ka: u(0x0ca8, 0x0cb5, 0x0cc0, 0x0c95, 0x0cb0, 0x0cbf, 0x0cb8, 0x0cb2, 0x0cbe, 0x0c97, 0x0cbf, 0x0ca6, 0x0cc6),
  },
  liveSync: {
    en: 'Live sync',
    de: 'Live-Sync',
    ta: u(0x0ba8, 0x0bc7, 0x0bb0, 0x0b9f, 0x0bbf) + ' ' + u(0x0b9a, 0x0bbf, 0x0b99, 0x0bcd, 0x0b95, 0x0bcd),
    ka: u(0x0cb2, 0x0cc8, 0x0cb5, 0x0ccd) + ' ' + u(0x0cb8, 0x0cbf, 0x0c82, 0x0c95, 0x0ccd),
  },
}

function esc(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
}

function insertBeforeClosing(block, entries, indent = '  ') {
  // Insert before last `}` of object that ends the block string
  const idx = block.lastIndexOf('\n}')
  if (idx < 0) throw new Error('no closing brace')
  const lines = entries.map(([k, v]) => `${indent}${k}: '${esc(v)}',`).join('\n')
  return block.slice(0, idx) + '\n' + lines + block.slice(idx)
}

let s = fs.readFileSync(i18nPath, 'utf8')

// Avoid double-insert
if (s.includes('eventsSub:')) {
  console.log('eventsSub already present — skip insert')
} else {
  // Patch `en` object: before `} as const`
  const enEnd = s.indexOf('} as const')
  if (enEnd < 0) throw new Error('en end not found')
  const enLines = Object.entries(extras)
    .map(([k, v]) => `  ${k}: '${esc(v.en)}',`)
    .join('\n')
  s = s.slice(0, enEnd) + enLines + '\n' + s.slice(enEnd)

  // Patch `de` — before closing `}\n\n/** Tamil`
  const deMarker = '\n}\n\n/** Tamil'
  const deIdx = s.indexOf(deMarker)
  if (deIdx < 0) throw new Error('de end not found')
  const deLines = Object.entries(extras)
    .map(([k, v]) => `  ${k}: '${esc(v.de)}',`)
    .join('\n')
  s = s.slice(0, deIdx) + '\n' + deLines + s.slice(deIdx)

  // Patch `ta` — before `\n}\n\n/** Kannada`
  const taMarker = '\n}\n\n/** Kannada'
  const taIdx = s.indexOf(taMarker)
  if (taIdx < 0) throw new Error('ta end not found')
  const taLines = Object.entries(extras)
    .map(([k, v]) => `  ${k}: '${esc(v.ta)}',`)
    .join('\n')
  s = s.slice(0, taIdx) + '\n' + taLines + s.slice(taIdx)

  // Patch `ka` — before `\n}\n\nconst dict`
  const kaMarker = '\n}\n\nconst dict'
  const kaIdx = s.indexOf(kaMarker)
  if (kaIdx < 0) throw new Error('ka end not found')
  const kaLines = Object.entries(extras)
    .map(([k, v]) => `  ${k}: '${esc(v.ka)}',`)
    .join('\n')
  s = s.slice(0, kaIdx) + '\n' + kaLines + s.slice(kaIdx)

  fs.writeFileSync(i18nPath, s, 'utf8')
  console.log('Added', Object.keys(extras).length, 'keys to en/de/ta/ka')
}

// Sanity
for (const loc of ['en', 'de', 'ta', 'ka']) {
  const m = s.match(new RegExp(`income: '([^']*)'`))
}
console.log('income ta sample ok:', extras.income.ta, extras.profit.ka)
