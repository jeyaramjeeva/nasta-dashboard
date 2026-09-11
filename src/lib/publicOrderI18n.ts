export type OrderLang = 'de' | 'en'

export const ORDER_LANG_KEY = 'nasta-order-lang'

export function loadOrderLang(): OrderLang {
  try {
    const v = localStorage.getItem(ORDER_LANG_KEY)
    if (v === 'en' || v === 'de') return v
  } catch {
    /* ignore */
  }
  return 'de'
}

export function saveOrderLang(lang: OrderLang) {
  try {
    localStorage.setItem(ORDER_LANG_KEY, lang)
  } catch {
    /* ignore */
  }
}

type Copy = {
  tagline: string
  todaysMenu: string
  loading: string
  loadError: string
  menuEmptyTitle: string
  menuEmptyBody: string
  freshStall: string
  fromPrice: string
  add: string
  addChai: string
  addLassi: string
  filterAll: string
  filterVegan: string
  filterGlutenFree: string
  tagVegan: string
  tagVegetarian: string
  tagGlutenFree: string
  yourOrder: string
  nameLabel: string
  namePlaceholder: string
  total: string
  placing: string
  placeOrder: string
  claimHint: string
  claimCodeLabel: string
  showStaffTitle: string
  showStaffBody: string
  codeExpires: string
  inQueueTitle: string
  youreNext: string
  aheadOfYou: (n: number) => string
  roughWait: (lo: number, hi: number) => string
  readyTitle: string
  readyBody: string
  orderElse: string
  leaveReview: string
  langDe: string
  langEn: string
  orderFailed: string
  drinkChai: string
  drinkLassi: string
  noFilterMatch: string
  sectionCombos: string
  sectionMains: string
  sectionSnacks: string
  sectionDrinks: string
  ingredientsLabel: string
  browseMenu: string
}

const de: Copy = {
  tagline: 'Bestellen am Stand — frisches südindisches Essen',
  todaysMenu: 'Heutiges Menü',
  loading: 'Menü wird geladen…',
  loadError: 'Menü konnte nicht geladen werden',
  menuEmptyTitle: 'Menü noch nicht bereit',
  menuEmptyBody:
    'Das Team muss unter Bestellungen → Menüpreise einen Event-Typ wählen und speichern. Danach erscheinen die Gerichte hier.',
  freshStall: 'Frisch vom Stand.',
  fromPrice: 'ab',
  add: 'Hinzufügen',
  addChai: '+ Chai',
  addLassi: '+ Lassi',
  filterAll: 'Alle',
  filterVegan: 'Nur vegan',
  filterGlutenFree: 'Glutenfrei',
  tagVegan: 'Vegan',
  tagVegetarian: 'Vegetarisch',
  tagGlutenFree: 'Glutenfrei',
  yourOrder: 'Deine Bestellung',
  nameLabel: 'Name (optional)',
  namePlaceholder: 'Damit wir dich rufen können',
  total: 'Summe',
  placing: 'Wird gesendet…',
  placeOrder: 'Bestellen',
  claimHint: 'Du bekommst einen 4-stelligen Code. Zeig ihn dem Team, bevor wir kochen.',
  claimCodeLabel: 'Dein Abholcode',
  showStaffTitle: 'Zeig diese Nummer dem Team',
  showStaffBody:
    'Wir kochen erst, wenn das Team deinen Code eingibt. So verhindern wir Fake-Bestellungen in der Warteschlange.',
  codeExpires: 'Der Code verfällt nach 30 Minuten, wenn er nicht benutzt wird.',
  inQueueTitle: 'Du bist in der Küchenwarteschlange',
  youreNext: ' — du bist als Nächstes dran!',
  aheadOfYou: (n) =>
    n === 1 ? ' — 1 Bestellung vor dir.' : ` — ${n} Bestellungen vor dir.`,
  roughWait: (lo, hi) =>
    `Ungefähre Wartezeit: etwa ${lo}–${hi} Minuten (je nach Stand).`,
  readyTitle: 'Fertig',
  readyBody: 'ist fertig. Guten Appetit!',
  orderElse: 'Etwas anderes bestellen',
  leaveReview: 'Bewertung hinterlassen',
  langDe: 'DE',
  langEn: 'EN',
  orderFailed: 'Bestellung fehlgeschlagen',
  drinkChai: 'Masala Chai',
  drinkLassi: 'Mango-Lassi',
  noFilterMatch: 'Keine Gerichte für diesen Filter — Filter zurücksetzen.',
  sectionCombos: 'Combos',
  sectionMains: 'Hauptgerichte',
  sectionSnacks: 'Snacks',
  sectionDrinks: 'Getränke',
  ingredientsLabel: 'Zutaten',
  browseMenu: 'Menü ansehen',
}

const en: Copy = {
  tagline: 'Order at the stall — fresh South Indian food',
  todaysMenu: "Today's Menu",
  loading: 'Loading menu…',
  loadError: 'Could not load menu',
  menuEmptyTitle: 'Menu not ready yet',
  menuEmptyBody:
    'Staff need to open Orders → Menu prices, pick an event type, and save the menu. Then this page will show the dishes.',
  freshStall: 'Fresh from the stall.',
  fromPrice: 'from',
  add: 'Add',
  addChai: '+ Chai',
  addLassi: '+ Lassi',
  filterAll: 'All',
  filterVegan: 'Vegan only',
  filterGlutenFree: 'Gluten free',
  tagVegan: 'Vegan',
  tagVegetarian: 'Vegetarian',
  tagGlutenFree: 'Gluten free',
  yourOrder: 'Your order',
  nameLabel: 'Name (optional)',
  namePlaceholder: 'So staff can call you',
  total: 'Total',
  placing: 'Placing…',
  placeOrder: 'Place order',
  claimHint: "You'll get a 4-digit code. Show it to staff before we cook.",
  claimCodeLabel: 'Your claim code',
  showStaffTitle: 'Show this number to staff',
  showStaffBody:
    'We only start cooking after staff enter your code. That stops fake online orders from jumping the queue.',
  codeExpires: 'Code expires in 30 minutes if unused.',
  inQueueTitle: "You're in the kitchen queue",
  youreNext: " — you're next!",
  aheadOfYou: (n) =>
    n === 1 ? ' — 1 order ahead of you.' : ` — ${n} orders ahead of you.`,
  roughWait: (lo, hi) =>
    `Rough wait: about ${lo}–${hi} minutes (depends on the stall).`,
  readyTitle: 'Ready / done',
  readyBody: 'is finished. Enjoy!',
  orderElse: 'Order something else',
  leaveReview: 'Leave a review',
  langDe: 'DE',
  langEn: 'EN',
  orderFailed: 'Order failed',
  drinkChai: 'Masala chai',
  drinkLassi: 'Mango lassi',
  noFilterMatch: 'No dishes match this filter — clear filters to see all.',
  sectionCombos: 'Combos',
  sectionMains: 'Main dishes',
  sectionSnacks: 'Snacks',
  sectionDrinks: 'Drinks',
  ingredientsLabel: 'Ingredients',
  browseMenu: 'Browse the menu',
}

export function orderCopy(lang: OrderLang): Copy {
  return lang === 'en' ? en : de
}
