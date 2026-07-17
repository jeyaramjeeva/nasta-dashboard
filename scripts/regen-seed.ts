import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseWorkbook } from '../src/lib/parseWorkbook'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const xlsxPath = String.raw`H:\Jeeva\Nasta Zentrum Tracker.xlsx`
const outPath = path.join(root, 'public', 'seed-data.json')

const buf = fs.readFileSync(xlsxPath)
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
const snap = parseWorkbook(ab, 'Nasta Zentrum Tracker.xlsx')
fs.writeFileSync(outPath, JSON.stringify(snap, null, 2))
console.log(
  'events',
  snap.events.length,
  'eventCash',
  snap.eventCashCounts?.length ?? 0,
  'reserve',
  snap.coinReserve?.length ?? 0,
  'reserveTotal',
  snap.coinReserveTotal,
  'main',
  snap.mainBoxTotal,
)
