/** India + Germany seasonal / festival days for the stall calendar. */

export type SpecialRegion = 'DE' | 'IN' | 'BOTH'

export interface SeasonalSpecial {
  /** yyyy-mm-dd */
  date: string
  /** Short label on the calendar cell */
  label: string
  /** Full name */
  name: string
  region: SpecialRegion
  /** Stall menu / vibe tip */
  tip: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  dt.setUTCDate(dt.getUTCDate() + days)
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** Western Easter Sunday (Gregorian). */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return ymd(year, month, day)
}

/** Lunar / regional festival dates we care about (extend as years pass). */
const DIWALI: Record<number, string> = {
  2024: '2024-10-31',
  2025: '2025-10-20',
  2026: '2026-11-08',
  2027: '2027-10-29',
  2028: '2028-10-17',
  2029: '2029-11-05',
  2030: '2030-10-26',
  2031: '2031-11-14',
  2032: '2032-11-03',
}

const HOLI: Record<number, string> = {
  2024: '2024-03-25',
  2025: '2025-03-14',
  2026: '2026-03-03',
  2027: '2027-03-22',
  2028: '2028-03-11',
  2029: '2029-03-01',
  2030: '2030-03-19',
  2031: '2031-03-09',
  2032: '2032-03-27',
}

const ONAM: Record<number, string> = {
  2024: '2024-09-15',
  2025: '2025-09-05',
  2026: '2026-08-26',
  2027: '2027-09-14',
  2028: '2028-09-02',
  2029: '2029-08-23',
  2030: '2030-09-11',
}

function push(
  out: SeasonalSpecial[],
  date: string | undefined,
  label: string,
  name: string,
  region: SpecialRegion,
  tip: string,
) {
  if (!date) return
  out.push({ date, label, name, region, tip })
}

/** All specials that fall in a given calendar month (1–12). */
export function specialsForMonth(year: number, month: number): SeasonalSpecial[] {
  const out: SeasonalSpecial[] = []
  const prefix = `${year}-${pad(month)}-`

  // —— Germany fixed ——
  push(out, ymd(year, 1, 1), 'NY', 'Neujahr', 'DE', 'Calm start — chai specials sell well.')
  push(out, ymd(year, 1, 6), '3K', 'Heilige Drei Könige', 'DE', 'South DE markets busy — extra plates.')
  push(out, ymd(year, 5, 1), '1Mai', 'Tag der Arbeit', 'DE', 'City crowds — keep Combo Pack stocked.')
  push(out, ymd(year, 10, 3), 'TagDE', 'Tag der Deutschen Einheit', 'DE', 'Big markets — peak dosa + chai.')
  push(out, ymd(year, 10, 31), 'Hall', 'Halloween', 'DE', 'Fun orange garnish / kids chai.')
  push(out, ymd(year, 12, 6), 'Nikol', 'Nikolaustag', 'DE', 'Sweet stall vibe — offer festive combo.')
  push(out, ymd(year, 12, 24), 'HL', 'Heiligabend', 'BOTH', 'Short day — sell-through leftovers.')
  push(out, ymd(year, 12, 25), 'Xmas', 'Weihnachten', 'BOTH', 'Closed or quiet — plan next Flohmarkt.')
  push(out, ymd(year, 12, 26), '2WT', '2. Weihnachtstag', 'DE', 'Quiet markets — light prep only.')
  push(out, ymd(year, 12, 31), 'SY', 'Silvester', 'BOTH', 'Evening rush possible — cash float ready.')

  // —— Karneval / Fasching (DE, Easter-based) ——
  const easter = easterSunday(year)
  push(
    out,
    addDays(easter, -52),
    'Weiber',
    'Weiberfastnacht',
    'DE',
    'Karneval kickoff — bright specials, easy finger food.',
  )
  push(
    out,
    addDays(easter, -48),
    'Rosen',
    'Rosenmontag',
    'DE',
    'Parade crowds — max combos + chai, extra cups.',
  )
  push(
    out,
    addDays(easter, -47),
    'Veil',
    'Veilchendienstag',
    'DE',
    'Last Karneval day — festive pricing OK.',
  )
  push(
    out,
    addDays(easter, -46),
    'Asch',
    'Aschermittwoch',
    'DE',
    'Calm after Karneval — restock & reset.',
  )
  push(out, easter, 'Ostern', 'Ostersonntag', 'DE', 'Family markets — idli / dosa brunch vibe.')
  push(out, addDays(easter, 1), 'OstMo', 'Ostermontag', 'DE', 'Holiday crowds — keep lassi cold.')
  push(
    out,
    addDays(easter, -2),
    'Karfr',
    'Karfreitag',
    'DE',
    'Quiet Friday — lighter menu OK.',
  )
  // Christi Himmelfahrt = Easter + 39, Pfingsten = Easter + 49
  push(
    out,
    addDays(easter, 39),
    'Himm',
    'Christi Himmelfahrt',
    'DE',
    'Long weekend markets — strong weekend stock.',
  )
  push(out, addDays(easter, 49), 'Pfing', 'Pfingstsonntag', 'DE', 'Holiday weekend — peak streetfood.')
  push(out, addDays(easter, 50), 'PfMo', 'Pfingstmontag', 'DE', 'Holiday Monday — keep selling.')

  // —— India fixed ——
  push(
    out,
    ymd(year, 1, 14),
    'Pong',
    'Pongal / Makar Sankranti',
    'IN',
    'South Indian joy — highlight idli, dosa, sambar.',
  )
  push(
    out,
    ymd(year, 1, 15),
    'Pong2',
    'Pongal (day 2)',
    'IN',
    'Keep festive South Indian specials.',
  )
  push(
    out,
    ymd(year, 1, 26),
    'RepIN',
    'Republic Day (India)',
    'IN',
    'Tricolor vibe — pride menu board.',
  )
  push(
    out,
    ymd(year, 8, 15),
    'IndIN',
    'Independence Day (India)',
    'IN',
    'Celebrate with combo deal + free chai sticker.',
  )
  push(
    out,
    ymd(year, 10, 2),
    'Gandhi',
    'Gandhi Jayanti',
    'IN',
    'Quiet respect day — simple classic menu.',
  )

  // —— India lunar / table ——
  push(
    out,
    HOLI[year],
    'Holi',
    'Holi',
    'IN',
    'Colors & joy — mango lassi + festive dosa special.',
  )
  push(
    out,
    DIWALI[year],
    'Diwali',
    'Diwali',
    'IN',
    'Lights festival — Diwali thali / combo + sweet chai.',
  )
  if (DIWALI[year]) {
    push(
      out,
      addDays(DIWALI[year]!, -1),
      'Dhan',
      'Dhanteras',
      'IN',
      'Diwali lead-in — announce weekend special.',
    )
    push(
      out,
      addDays(DIWALI[year]!, 1),
      'Gov',
      'Govardhan / Diwali day 2',
      'IN',
      'Keep festive menu one more day.',
    )
  }
  push(
    out,
    ONAM[year],
    'Onam',
    'Onam',
    'IN',
    'Kerala feast mood — banana-leaf style combo story.',
  )

  // Shared / both communities in DE
  push(
    out,
    ymd(year, 11, 11),
    '11.11',
    'Karneval opening (11.11.)',
    'DE',
    'Season opens — plan costume-day specials.',
  )

  return out
    .filter((s) => s.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function specialsByDay(
  year: number,
  month: number,
): Map<number, SeasonalSpecial[]> {
  const map = new Map<number, SeasonalSpecial[]>()
  for (const s of specialsForMonth(year, month)) {
    const day = Number(s.date.slice(8, 10))
    const list = map.get(day) || []
    list.push(s)
    map.set(day, list)
  }
  return map
}
