import type { Venue } from './marketAnalysis'

export const NASTA_MARKS = {
  name: 'Nasta (your stall / concept)',
  dosa: true,
  idli: true,
  veganMarks: true,
  lunch: true,
  note: 'From the food you already sell: masala dosa, cheese dosa, plain dosa, sambar idli. Daytime stalls are lunch evidence, not evening restaurant proof.',
}

export type OfferMarks = {
  dosa: boolean | 'unk'
  idli: boolean | 'unk'
  veganMarks: boolean | 'unk'
  lunch: boolean | 'unk'
}

function flag(v: boolean | 'Not verified'): boolean | 'unk' {
  if (v === true) return true
  if (v === false) return false
  return 'unk'
}

export function venueMarks(v: Venue): OfferMarks {
  const text = `${v.distinctive} ${v.pricesObserved} ${v.cuisine.join(' ')} ${v.veg} ${v.vegan}`
  const idli = /idli/i.test(text) ? true : v.dosa === true ? 'unk' : false
  const vegan =
    /100% vegan|vegan-focused|vegan-friendly|vegan marks|clearly marked vegan/i.test(`${v.vegan} ${v.distinctive}`) ||
    v.vegan.includes('vegan')
  return {
    dosa: flag(v.dosa),
    idli,
    veganMarks: vegan ? true : v.vegan === 'Not verified' ? 'unk' : false,
    lunch: flag(v.lunch),
  }
}

export function markLabel(v: boolean | 'unk') {
  return v === true ? 'yes' : v === false ? 'no' : 'unk'
}
