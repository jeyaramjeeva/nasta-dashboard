import fs from 'node:fs'

const raw = JSON.parse(fs.readFileSync(`${process.env.TEMP}/osm-both.json`, 'utf8'))
const drop = /currywurst|weltmeister|pommes/i
const places = raw.places.filter((p) => !drop.test(`${p.name} ${p.cuisine || ''}`))

const src = `/** Cached OSM Indian-tagged places. Used when Overpass returns 502. Not Google ratings. */
export const OSM_SNAPSHOT_CHECKED_AT = ${JSON.stringify(raw.checkedAt)}
export const OSM_SNAPSHOT_NOTE =
  'Saved OpenStreetMap extract. Live Overpass is tried first; this copy is the fallback.'
export const OSM_SNAPSHOT_PLACES = ${JSON.stringify(places, null, 2)} as const
`

fs.writeFileSync('src/lib/osmIndianSnapshot.ts', src)
console.log('places', places.length)
