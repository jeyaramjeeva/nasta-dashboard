import { roundEuro } from './euroAmount'

const ONES = ['null', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun']
const TEENS = [
  'zehn',
  'elf',
  'zwölf',
  'dreizehn',
  'vierzehn',
  'fünfzehn',
  'sechzehn',
  'siebzehn',
  'achtzehn',
  'neunzehn',
]
const TENS = [
  '',
  '',
  'zwanzig',
  'dreißig',
  'vierzig',
  'fünfzig',
  'sechzig',
  'siebzig',
  'achtzig',
  'neunzig',
]

function belowHundred(n: number, one: 'ein' | 'eins'): string {
  if (n < 10) return n === 1 ? one : ONES[n]!
  if (n < 20) return TEENS[n - 10]!
  const tens = Math.floor(n / 10)
  const ones = n % 10
  if (ones === 0) return TENS[tens]!
  const head = ones === 1 ? 'ein' : ONES[ones]!
  return `${head}und${TENS[tens]}`
}

function belowThousand(n: number): string {
  if (n < 100) return belowHundred(n, 'eins')
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const head = hundreds === 1 ? 'einhundert' : `${ONES[hundreds]}hundert`
  if (rest === 0) return head
  return `${head}${belowHundred(rest, 'eins')}`
}

function cap(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Spoken German for a euro amount, e.g. 12.50 → "Zwölf Euro fünfzig". */
export function euroAmountDe(value: number): string {
  const centsTotal = Math.round(roundEuro(value) * 100)
  if (centsTotal <= 0) return 'Null Euro'
  const euros = Math.floor(centsTotal / 100)
  const cents = centsTotal % 100
  if (euros === 0) return `${cap(belowHundred(cents, 'eins'))} Cent`
  const euroWords = euros === 1 ? 'Ein Euro' : `${cap(belowThousand(euros))} Euro`
  if (cents === 0) return euroWords
  return `${euroWords} ${belowHundred(cents, 'eins')}`
}
