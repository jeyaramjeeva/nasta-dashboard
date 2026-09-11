/** Sourced people / demand-base figures for Köln and Bonn.
 * Register vs official (Zensus) series are kept separate. No invented district India counts.
 */

import type { City, Confidence } from './marketAnalysis'

export type PeopleFilter =
  | 'residents'
  | 'indian'
  | 'students'
  | 'employees'
  | 'commuters'
  | 'tourists'
  | 'young'
  | 'nonGerman'
  | 'migration'

export type HeatLayer =
  | 'residents'
  | 'density'
  | 'employeesHome'
  | 'nonGerman'
  | 'migrationShare'
  | 'asiaNonGerman'
  | 'purchasingPower'

export type PeopleStat = {
  id: string
  city: City | 'Both'
  label: string
  value: number
  unit?: string
  asOf: string
  source: string
  url: string
  note: string
  confidence: Confidence
  filters: PeopleFilter[]
}

export type DistrictRow = {
  id: string
  city: City
  name: string
  x: number
  y: number
  residents: number | null
  densityPerKm2: number | null
  employeesHome: number | null
  nonGerman: number | null
  migrationShare: number | null
  asiaNonGerman: number | null
  purchasingPower: number | null
}

export const PEOPLE_CHECKED_LABEL = '8 September 2026'

export const PEOPLE_FILTERS: { id: PeopleFilter; label: string; hint: string }[] = [
  { id: 'residents', label: 'Residents', hint: 'Municipal register (Haupt + Neben in Köln; Haupt/einzig in Bonn).' },
  { id: 'indian', label: 'Indian / South Asian', hint: 'Nationality or India-origin register groups. Not “people who eat Indian”.' },
  { id: 'students', label: 'Students', hint: 'MLP city student stock 2025. Not a campus census.' },
  { id: 'employees', label: 'Employees', hint: 'Sozialversicherungspflichtig am Arbeitsort (BA).' },
  { id: 'commuters', label: 'In-commuters', hint: 'People who work in the city and live elsewhere.' },
  { id: 'tourists', label: 'Tourists', hint: 'Hotel arrivals / overnight stays. Day visitors not counted.' },
  { id: 'young', label: 'Age 18–29', hint: 'Köln register age bands only. Bonn split not in the 2025 pages used here.' },
  { id: 'nonGerman', label: 'Non-German', hint: 'Foreign nationality, not migration background.' },
  { id: 'migration', label: 'Migration background', hint: 'City estimate / register combination. Not a nationality.' },
]

export const HEAT_LAYERS: { id: HeatLayer; label: string; cities: City[] }[] = [
  { id: 'residents', label: 'Residents', cities: ['Köln', 'Bonn'] },
  { id: 'density', label: 'Density / km²', cities: ['Köln'] },
  { id: 'employeesHome', label: 'Employees living there', cities: ['Köln'] },
  { id: 'nonGerman', label: 'Non-German residents', cities: ['Köln'] },
  { id: 'migrationShare', label: 'Migration-background %', cities: ['Köln'] },
  { id: 'asiaNonGerman', label: 'Asian non-German (not India-only)', cities: ['Köln'] },
  { id: 'purchasingPower', label: 'Purchasing-power index', cities: ['Köln'] },
]

export const PEOPLE_STATS: PeopleStat[] = [
  {
    id: 'koeln-register',
    city: 'Köln',
    label: 'Residents (register, Haupt + Neben)',
    value: 1_100_076,
    asOf: '31 Dec 2025',
    source: 'Stadt Köln KSN 3/2026 / Statistik Bevölkerung',
    url: 'https://www.stadt-koeln.de/artikel/74185/index.html',
    note: 'Municipal register. IT.NRW official (Zensus) series is lower and is not used for Veedel tables.',
    confidence: 'High',
    filters: ['residents'],
  },
  {
    id: 'koeln-haupt',
    city: 'Köln',
    label: 'Residents with Hauptwohnsitz',
    value: 1_092_607,
    asOf: '31 Dec 2025',
    source: 'Stadt Köln KSN 3/2026',
    url: 'https://www.stadt-koeln.de/mediaasset/content/pdf15/statistik-einwohner-und-haushalte/ksn_3_2026_bev%C3%B6lkerung_in_k%C3%B6ln_2025.pdf',
    note: 'Same register, main residence only.',
    confidence: 'High',
    filters: ['residents'],
  },
  {
    id: 'bonn-register',
    city: 'Bonn',
    label: 'Residents (register, Haupt / einzig)',
    value: 342_152,
    asOf: '31 Dec 2025',
    source: 'Stadt Bonn Statistikstelle via Jahreswirtschaftsbericht 2026',
    url: 'https://www.bonn.de/themen-entdecken/wirtschaft-wissenschaft/jahreswirtschaftsbericht-2026/standortentwicklung/demographische-entwicklung.php',
    note: 'Register used for Stadtbezirk tables. Grew +1,926 vs 2024.',
    confidence: 'High',
    filters: ['residents'],
  },
  {
    id: 'bonn-official',
    city: 'Bonn',
    label: 'Official residents (IT.NRW / Zensus 2022)',
    value: 323_587,
    asOf: '31 Dec 2025',
    source: 'IT.NRW Fortschreibung, cited by Stadt Bonn',
    url: 'https://www.bonn.de/themen-entdecken/wirtschaft-wissenschaft/jahreswirtschaftsbericht-2026/standortentwicklung/demographische-entwicklung.php',
    note: 'Different counting method. Do not mix with the 342,152 register figure.',
    confidence: 'High',
    filters: ['residents'],
  },
  {
    id: 'koeln-indian',
    city: 'Köln',
    label: 'Indian nationality',
    value: 4_186,
    asOf: '31 Dec 2025',
    source: 'Stadt Köln nationality ranking 31.12.2025 (rank 15; same register as the published Top 10)',
    url: 'https://de.wikipedia.org/wiki/Einwohnerentwicklung_von_K%C3%B6ln',
    note: 'Top 10 on stadt-koeln.de matches this table (Turkey 48,640 … Afghanistan 5,408). India is not in the Top 10, so the city page omits it. Passport count only — naturalised / PIO not included. 123 India-origin naturalisations in 2025.',
    confidence: 'Medium',
    filters: ['indian'],
  },
  {
    id: 'koeln-south-asian',
    city: 'Köln',
    label: 'India + Pakistan + Bangladesh nationality',
    value: 6_355,
    asOf: '31 Dec 2025',
    source: 'Same Köln nationality ranking (IN 4,186 + PK 910 + BD 1,259)',
    url: 'https://de.wikipedia.org/wiki/Einwohnerentwicklung_von_K%C3%B6ln',
    note: 'Still passports, not cuisine demand. Sri Lanka not in that extract.',
    confidence: 'Medium',
    filters: ['indian'],
  },
  {
    id: 'koeln-india-net',
    city: 'Köln',
    label: 'India net migration 2025',
    value: 279,
    asOf: '2025',
    source: 'Stadt Köln KSN 8/2026',
    url: 'https://www.stadt-koeln.de/mediaasset/content/pdf15/statistik-einwohner-und-haushalte/ksn_8_2026_bevoelkerungsbewegungen_in_koeln_2025.pdf',
    note: '937 arrivals − 658 departures. Small vs 4,186 stock.',
    confidence: 'High',
    filters: ['indian'],
  },
  {
    id: 'bonn-indian',
    city: 'Bonn',
    label: 'India-origin (migration background)',
    value: 2_459,
    asOf: '31 Dec 2022',
    source: 'Stadt Bonn Statistik aktuell — Bevölkerungsstatistik 2022',
    url: 'https://www2.bonn.de/statistik/dl/ews/Bevoelkerungsstatistik2022.pdf',
    note: '2.3% of people with Zuwanderungshintergrund. Later 2025 India split was not on the Bonn pages used this wave. Do not treat as 2026.',
    confidence: 'Medium',
    filters: ['indian'],
  },
  {
    id: 'koeln-students',
    city: 'Köln',
    label: 'Students in the city',
    value: 104_576,
    asOf: '2025',
    source: 'MLP Studentenwohnreport 2025',
    url: 'https://mlp-se.de/redaktion/mlp-se-de/studentenwohnreport-microsite/2025/report/mlp-studentenwohnreport-2025.pdf',
    note: 'City student stock, not enrolled-only at one Hochschule. No official Veedel student map published here.',
    confidence: 'Medium',
    filters: ['students'],
  },
  {
    id: 'bonn-students',
    city: 'Bonn',
    label: 'Students in the city',
    value: 38_625,
    asOf: '2025',
    source: 'MLP Studentenwohnreport 2025',
    url: 'https://mlp-se.de/redaktion/mlp-se-de/studentenwohnreport-microsite/2025/report/mlp-studentenwohnreport-2025.pdf',
    note: 'Same MLP series as Köln. Campus pins on the map are locations, not headcounts.',
    confidence: 'Medium',
    filters: ['students'],
  },
  {
    id: 'koeln-jobs',
    city: 'Köln',
    label: 'Employees at workplace',
    value: 631_907,
    asOf: '30 Jun 2025',
    source: 'Bundesagentur für Arbeit via Stadt Köln',
    url: 'https://www.stadt-koeln.de/politik-und-verwaltung/statistik/wirtschaft-arbeitsmarkt-koeln-im-ueberblick',
    note: 'Sozialversicherungspflichtig am Arbeitsort. Includes 322,224 in-commuters.',
    confidence: 'High',
    filters: ['employees'],
  },
  {
    id: 'koeln-jobs-home',
    city: 'Köln',
    label: 'Employees living in Köln (working age)',
    value: 452_533,
    asOf: 'Dec 2025',
    source: 'Stadt Köln / BA — Beschäftigtenquote am Wohnort',
    url: 'https://www.stadt-koeln.de/politik-und-verwaltung/statistik/wirtschaft-arbeitsmarkt-koeln-im-ueberblick',
    note: '60.4% of working-age Hauptwohnsitz residents. District heatmap uses the Wohnort table.',
    confidence: 'High',
    filters: ['employees'],
  },
  {
    id: 'bonn-jobs',
    city: 'Bonn',
    label: 'Employees at workplace',
    value: 195_321,
    asOf: '30 Jun 2025',
    source: 'Bundesagentur für Arbeit via Stadt Bonn Jahreswirtschaftsbericht 2026',
    url: 'https://www.bonn.de/themen-entdecken/wirtschaft-wissenschaft/jahreswirtschaftsbericht-2026/standortentwicklung/beschaeftigtenentwicklung.php',
    note: 'Record high. 36.5% academic degrees (71,250). No 2025 Wohnort-by-Stadtbezirk table in the pages used.',
    confidence: 'High',
    filters: ['employees'],
  },
  {
    id: 'koeln-incommute',
    city: 'Köln',
    label: 'In-commuters',
    value: 322_224,
    asOf: '30 Jun 2025',
    source: 'BA via Stadt Köln Jahrbuch / KSN 6/2026',
    url: 'https://www.stadt-koeln.de/mediaasset/content/pdf15/statistik-wirtschaft-und-arbeitsmarkt/ksn_06_2026_arbeitsmarkt_koeln.pdf',
    note: 'About half of workplace jobs. Out-commuters 140,003. Weekday lunch demand is larger than residents.',
    confidence: 'High',
    filters: ['commuters', 'employees'],
  },
  {
    id: 'koeln-outcommute',
    city: 'Köln',
    label: 'Out-commuters',
    value: 140_003,
    asOf: '30 Jun 2025',
    source: 'BA via Stadt Köln',
    url: 'https://www.stadt-koeln.de/politik-und-verwaltung/statistik/wirtschaft-arbeitsmarkt-koeln-im-ueberblick',
    note: 'Köln residents working outside the city.',
    confidence: 'High',
    filters: ['commuters'],
  },
  {
    id: 'koeln-tourists',
    city: 'Köln',
    label: 'Hotel guest arrivals',
    value: 4_252_560,
    asOf: '2025',
    source: 'Stadt Köln Tourismusstatistik (Betriebe ab 10 Betten)',
    url: 'https://www.stadt-koeln.de/politik-und-verwaltung/statistik/wirtschaft-arbeitsmarkt-koeln-im-ueberblick',
    note: 'KölnTourismus: 7.22m overnight stays, €5.51bn spend. Foreign arrivals 1,489,525. India not in the published top-10 origin list.',
    confidence: 'High',
    filters: ['tourists'],
  },
  {
    id: 'koeln-nights',
    city: 'Köln',
    label: 'Hotel overnight stays',
    value: 7_220_000,
    asOf: '2025',
    source: 'KölnTourismus Bilanz 2025',
    url: 'https://www.koelntourismus.de/service/newsroom/news/detail/bilanz-2025-koelner-tourismus-setzt-erfolgsgeschichte-fort',
    note: 'Rounded “more than 7.22 million”. Not a Veedel split.',
    confidence: 'High',
    filters: ['tourists'],
  },
  {
    id: 'bonn-tourists',
    city: 'Bonn',
    label: 'Hotel guest arrivals',
    value: 802_103,
    asOf: '2025',
    source: 'Stadt Bonn Jahreswirtschaftsbericht 2026',
    url: 'https://www.bonn.de/themen-entdecken/wirtschaft-wissenschaft/jahreswirtschaftsbericht-2026/internationaler-standort/Tourismusstandort-Bonn.php',
    note: 'Plus 1,607,886 overnight stays (Tourismus NRW: −2.0% vs 2024).',
    confidence: 'High',
    filters: ['tourists'],
  },
  {
    id: 'bonn-nights',
    city: 'Bonn',
    label: 'Hotel overnight stays',
    value: 1_607_886,
    asOf: '2025',
    source: 'Tourismus NRW Beherbergungsstatistik 2025 / Stadt Bonn',
    url: 'https://www.bonn.de/themen-entdecken/wirtschaft-wissenschaft/jahreswirtschaftsbericht-2026/internationaler-standort/Tourismusstandort-Bonn.php',
    note: 'City-wide hotel count. Day visitors not included.',
    confidence: 'High',
    filters: ['tourists'],
  },
  {
    id: 'koeln-young',
    city: 'Köln',
    label: 'Residents aged 18–29',
    value: 177_074,
    asOf: '31 Dec 2025',
    source: 'Stadt Köln Statistik Bevölkerung (18–24: 86,531 + 25–29: 90,543)',
    url: 'https://www.stadt-koeln.de/artikel/74185/index.html',
    note: 'Student + young-worker pool. Not a student count.',
    confidence: 'High',
    filters: ['young', 'students'],
  },
  {
    id: 'koeln-nongerman',
    city: 'Köln',
    label: 'Non-German residents',
    value: 237_750,
    asOf: '31 Dec 2025',
    source: 'Stadt Köln Statistik Bevölkerung',
    url: 'https://www.stadt-koeln.de/artikel/74185/index.html',
    note: '21.6% of the register. Heatmap uses the Stadtteilinformationen 2025 nationality table.',
    confidence: 'High',
    filters: ['nonGerman'],
  },
  {
    id: 'koeln-mh',
    city: 'Köln',
    label: 'Migration background',
    value: 473_731,
    asOf: '31 Dec 2025',
    source: 'Stadt Köln KSN 3/2026',
    url: 'https://www.stadt-koeln.de/mediaasset/content/pdf15/statistik-einwohner-und-haushalte/ksn_3_2026_bev%C3%B6lkerung_in_k%C3%B6ln_2025.pdf',
    note: '43.1%. Estimated from register fields, not a census question.',
    confidence: 'High',
    filters: ['migration'],
  },
  {
    id: 'bonn-nongerman',
    city: 'Bonn',
    label: 'Non-German residents',
    value: 69_428,
    asOf: '1 Jan 2025',
    source: 'Stadt Bonn — Bonn in Zahlen',
    url: 'https://www.bonn.de/service-bieten/aktuelles-zahlen-fakten/bonn-in-zahlen.php',
    note: 'On the 340,226 1 Jan 2025 register snapshot. 2025 year-end nationality table not used here.',
    confidence: 'Medium',
    filters: ['nonGerman'],
  },
  {
    id: 'bonn-mh',
    city: 'Bonn',
    label: 'Migration background',
    value: 113_382,
    asOf: '1 Jan 2025',
    source: 'Stadt Bonn — Bonn in Zahlen',
    url: 'https://www.bonn.de/service-bieten/aktuelles-zahlen-fakten/bonn-in-zahlen.php',
    note: 'Same 1 Jan 2025 snapshot as 340,226 residents.',
    confidence: 'Medium',
    filters: ['migration'],
  },
  {
    id: 'koeln-asia',
    city: 'Köln',
    label: 'Asian non-German residents',
    value: 51_364,
    asOf: '31 Dec 2025',
    source: 'Kölner Stadtteilinformationen Bevölkerung 2025, Tabelle 11',
    url: 'https://www.stadt-koeln.de/mediaasset/content/pdf15/statistik-einwohner-und-haushalte/koelner_stadtteilinformationen_-_zahlen_2025_bev%C3%B6lkerung.pdf',
    note: 'Continent bucket: India + Syria + Iran + Afghanistan + China and others. Not an India heatmap.',
    confidence: 'High',
    filters: ['indian', 'nonGerman'],
  },
]

export const DISTRICTS: DistrictRow[] = [
  { id: 'k-innen', city: 'Köln', name: 'Innenstadt', x: 42, y: 50, residents: 127_889, densityPerKm2: 7_796, employeesHome: 62_579, nonGerman: 24_360, migrationShare: 33.6, asiaNonGerman: 5_540, purchasingPower: 121 },
  { id: 'k-roden', city: 'Köln', name: 'Rodenkirchen', x: 38, y: 76, residents: 113_101, densityPerKm2: 2_072, employeesHome: 43_756, nonGerman: 21_597, migrationShare: 37.1, asiaNonGerman: 5_094, purchasingPower: 110 },
  { id: 'k-linden', city: 'Köln', name: 'Lindenthal', x: 18, y: 52, residents: 153_655, densityPerKm2: 3_686, employeesHome: 64_020, nonGerman: 19_848, migrationShare: 28.5, asiaNonGerman: 5_500, purchasingPower: 123 },
  { id: 'k-ehren', city: 'Köln', name: 'Ehrenfeld', x: 22, y: 36, residents: 112_575, densityPerKm2: 4_671, employeesHome: 49_043, nonGerman: 23_894, migrationShare: 41.0, asiaNonGerman: 4_445, purchasingPower: 96 },
  { id: 'k-nippes', city: 'Köln', name: 'Nippes', x: 38, y: 28, residents: 117_852, densityPerKm2: 3_733, employeesHome: 50_182, nonGerman: 24_364, migrationShare: 40.8, asiaNonGerman: 3_811, purchasingPower: 90 },
  { id: 'k-chor', city: 'Köln', name: 'Chorweiler', x: 34, y: 10, residents: 83_991, densityPerKm2: 1_247, employeesHome: 30_808, nonGerman: 19_889, migrationShare: 55.2, asiaNonGerman: 4_140, purchasingPower: 91 },
  { id: 'k-porz', city: 'Köln', name: 'Porz', x: 74, y: 78, residents: 117_504, densityPerKm2: 1_492, employeesHome: 44_646, nonGerman: 27_390, migrationShare: 50.1, asiaNonGerman: 7_674, purchasingPower: 96 },
  { id: 'k-kalk', city: 'Köln', name: 'Kalk', x: 72, y: 54, residents: 122_905, densityPerKm2: 3_253, employeesHome: 47_385, nonGerman: 38_487, migrationShare: 59.2, asiaNonGerman: 8_116, purchasingPower: 79 },
  { id: 'k-muel', city: 'Köln', name: 'Mülheim', x: 70, y: 32, residents: 150_604, densityPerKm2: 2_854, employeesHome: 59_807, nonGerman: 37_921, migrationShare: 48.3, asiaNonGerman: 7_044, purchasingPower: 87 },
  { id: 'b-bonn', city: 'Bonn', name: 'Bonn (Bezirk)', x: 42, y: 36, residents: 159_412, densityPerKm2: null, employeesHome: null, nonGerman: null, migrationShare: null, asiaNonGerman: null, purchasingPower: null },
  { id: 'b-godes', city: 'Bonn', name: 'Bad Godesberg', x: 40, y: 74, residents: 79_245, densityPerKm2: null, employeesHome: null, nonGerman: null, migrationShare: null, asiaNonGerman: null, purchasingPower: null },
  { id: 'b-beuel', city: 'Bonn', name: 'Beuel', x: 72, y: 42, residents: 68_013, densityPerKm2: null, employeesHome: null, nonGerman: null, migrationShare: null, asiaNonGerman: null, purchasingPower: null },
  { id: 'b-hardt', city: 'Bonn', name: 'Hardtberg', x: 16, y: 44, residents: 35_482, densityPerKm2: null, employeesHome: null, nonGerman: null, migrationShare: null, asiaNonGerman: null, purchasingPower: null },
]

export const CAMPUSES = [
  { id: 'uzk', city: 'Köln' as City, name: 'Universität zu Köln', district: 'Lindenthal', x: 20, y: 50 },
  { id: 'th-deutz', city: 'Köln' as City, name: 'TH Köln Deutz', district: 'Deutz / Innenstadt', x: 50, y: 52 },
  { id: 'th-sued', city: 'Köln' as City, name: 'TH Köln Südstadt', district: 'Neustadt-Süd', x: 40, y: 58 },
  { id: 'dshs', city: 'Köln' as City, name: 'Deutsche Sporthochschule', district: 'Müngersdorf', x: 14, y: 48 },
  { id: 'uni-bonn', city: 'Bonn' as City, name: 'Universität Bonn (Zentrum)', district: 'Bonn', x: 44, y: 34 },
  { id: 'poppels', city: 'Bonn' as City, name: 'Poppelsdorf campus', district: 'Poppelsdorf', x: 34, y: 42 },
  { id: 'endenich', city: 'Bonn' as City, name: 'Endenich', district: 'Endenich', x: 28, y: 38 },
]

export const DISTRICT_SOURCES = {
  koelnPop: {
    label: 'Stadt Köln — Bevölkerung in den Stadtbezirken 2025',
    url: 'https://www.stadt-koeln.de/artikel/74185/index.html',
  },
  koelnJobs: {
    label: 'Stadt Köln — Beschäftigte am Wohnort, Dez. 2025',
    url: 'https://www.stadt-koeln.de/politik-und-verwaltung/statistik/wirtschaft-arbeitsmarkt-koeln-im-ueberblick',
  },
  koelnNation: {
    label: 'Kölner Stadtteilinformationen Bevölkerung 2025, Tabelle 10–11',
    url: 'https://www.stadt-koeln.de/mediaasset/content/pdf15/statistik-einwohner-und-haushalte/koelner_stadtteilinformationen_-_zahlen_2025_bev%C3%B6lkerung.pdf',
  },
  bonnPop: {
    label: 'Stadt Bonn Strukturdatenatlas 31.12.2025',
    url: 'https://www2.bonn.de/statistik/Strukturdatenatlas/10010001020251231.pdf',
  },
}

export function peopleFor(city: City | 'All' | 'Compare', filter: PeopleFilter) {
  return PEOPLE_STATS.filter((s) => {
    if (!s.filters.includes(filter)) return false
    if (city === 'All' || city === 'Compare') return true
    return s.city === city || s.city === 'Both'
  })
}

export function districtsFor(city: City | 'All' | 'Compare') {
  if (city === 'Bonn') return DISTRICTS.filter((d) => d.city === 'Bonn')
  if (city === 'Köln') return DISTRICTS.filter((d) => d.city === 'Köln')
  return DISTRICTS
}

export function layerValue(d: DistrictRow, layer: HeatLayer): number | null {
  if (layer === 'residents') return d.residents
  if (layer === 'density') return d.densityPerKm2
  if (layer === 'employeesHome') return d.employeesHome
  if (layer === 'nonGerman') return d.nonGerman
  if (layer === 'migrationShare') return d.migrationShare
  if (layer === 'asiaNonGerman') return d.asiaNonGerman
  return d.purchasingPower
}

export function layerUnit(layer: HeatLayer) {
  if (layer === 'density') return '/km²'
  if (layer === 'migrationShare') return '%'
  if (layer === 'purchasingPower') return ' (Köln=100)'
  return ''
}

export function suggestedLayer(filter: PeopleFilter): HeatLayer {
  if (filter === 'employees' || filter === 'commuters') return 'employeesHome'
  if (filter === 'nonGerman') return 'nonGerman'
  if (filter === 'migration') return 'migrationShare'
  if (filter === 'indian') return 'asiaNonGerman'
  if (filter === 'young' || filter === 'students') return 'density'
  if (filter === 'tourists') return 'density'
  return 'residents'
}

export function heatColor(value: number, min: number, max: number) {
  if (max <= min) return 'rgba(31, 61, 43, 0.28)'
  const t = (value - min) / (max - min)
  const a = 0.16 + t * 0.74
  return `rgba(31, 61, 43, ${a.toFixed(3)})`
}

export const LAYER_STORY: Record<
  HeatLayer,
  { question: string; meaning: string; unitWord: string; missing?: string }
> = {
  residents: {
    question: 'Which districts have the most residents?',
    meaning: 'Each tile is a Stadtbezirk. Darker green and a bigger number = more people registered there.',
    unitWord: 'residents',
  },
  density: {
    question: 'Where do people live most tightly packed?',
    meaning: 'People per km². Innenstadt is small and full; Chorweiler and Porz are large and thinner.',
    unitWord: 'people / km²',
  },
  employeesHome: {
    question: 'Where do employees sleep — not where they work?',
    meaning: 'Sozialversicherungspflichtig Beschäftigte am Wohnort. Weekday lunch is also fed by 322,224 in-commuters who are not on this map.',
    unitWord: 'employees living there',
  },
  nonGerman: {
    question: 'Which districts have the most foreign-passport residents?',
    meaning: 'Count of non-German nationality, not “migrants” and not Indian-only.',
    unitWord: 'non-German residents',
  },
  migrationShare: {
    question: 'Where is the share with a migration background highest?',
    meaning: 'Percent of residents, city estimate. Kalk and Chorweiler lead; Lindenthal is lowest.',
    unitWord: '% with migration background',
  },
  asiaNonGerman: {
    question: 'Closest official map to “Asian / Indian-adjacent” — not India-only.',
    meaning: 'Köln publishes Asia as one bucket (India + Syria + Iran + Afghanistan + China and others). There is no India-by-district table.',
    unitWord: 'Asian non-German residents',
    missing: 'Indian passports are only known at city level (Köln 4,186). This layer is a proxy.',
  },
  purchasingPower: {
    question: 'Where is spending power highest?',
    meaning: 'Index, Köln city = 100. Lindenthal and Innenstadt sit above the city average; Kalk is lowest.',
    unitWord: 'index (city = 100)',
  },
}

export function formatLayerValue(layer: HeatLayer, value: number) {
  if (layer === 'migrationShare') return `${value.toFixed(1)}%`
  if (layer === 'purchasingPower') return String(value)
  if (layer === 'density') return `${value.toLocaleString('de-DE')} /km²`
  return value.toLocaleString('de-DE')
}

export function rankedDistricts(districts: DistrictRow[], layer: HeatLayer) {
  return districts
    .map((d) => ({ d, value: layerValue(d, layer) }))
    .filter((row): row is { d: DistrictRow; value: number } => row.value != null)
    .sort((a, b) => b.value - a.value)
}
