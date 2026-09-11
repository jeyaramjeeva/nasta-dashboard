/** Stall & food DE flashcards for English-speaking team. */

export interface LearnCard {
  id: string
  en: string
  de: string
  hint?: string
  category: 'food' | 'stall' | 'customer' | 'money' | 'kitchen'
}

export const LEARN_CARDS: LearnCard[] = [
  { id: 'dosa', en: 'Dosa', de: 'Dosa (Pfannkuchen)', hint: 'Same word — say “Doh-sa”', category: 'food' },
  { id: 'chutney', en: 'Chutney', de: 'Chutney / Dip', category: 'food' },
  { id: 'sambar', en: 'Sambar', de: 'Sambar (Linsensuppe)', category: 'food' },
  { id: 'chai', en: 'Masala chai', de: 'Masala-Chai / Gewürztee', category: 'food' },
  { id: 'lassi', en: 'Mango lassi', de: 'Mango-Lassi', category: 'food' },
  { id: 'gobi', en: 'Gobi 65 / cauliflower', de: 'Blumenkohl 65', category: 'food' },
  { id: 'spicy', en: 'Spicy', de: 'Scharf', hint: 'Mild = mild · medium = mittel', category: 'food' },
  { id: 'vegan', en: 'Vegan', de: 'Vegan', category: 'food' },
  { id: 'gluten', en: 'Gluten-free', de: 'Glutenfrei', category: 'food' },
  { id: 'allergy', en: 'Allergy', de: 'Allergie', category: 'customer' },
  { id: 'nuts', en: 'Contains nuts', de: 'Enthält Nüsse', category: 'customer' },
  { id: 'dairy', en: 'Contains dairy', de: 'Enthält Milchprodukte', category: 'customer' },
  { id: 'hello', en: 'Hello', de: 'Hallo / Guten Tag', category: 'customer' },
  { id: 'thanks', en: 'Thank you', de: 'Danke / Danke schön', category: 'customer' },
  { id: 'please', en: 'Please', de: 'Bitte', category: 'customer' },
  { id: 'enjoy', en: 'Enjoy your meal', de: 'Guten Appetit', category: 'customer' },
  { id: 'wait', en: 'One moment please', de: 'Einen Moment bitte', category: 'customer' },
  { id: 'ready', en: 'Your order is ready', de: 'Ihre Bestellung ist fertig', category: 'customer' },
  { id: 'number', en: 'Your number is…', de: 'Ihre Nummer ist…', category: 'customer' },
  { id: 'cash', en: 'Cash', de: 'Bar / Bargeld', category: 'money' },
  { id: 'card', en: 'Card / PayPal', de: 'Karte / PayPal', category: 'money' },
  { id: 'change', en: 'Your change', de: 'Ihr Wechselgeld', category: 'money' },
  { id: 'receipt', en: 'Receipt', de: 'Quittung / Beleg', category: 'money' },
  { id: 'euro', en: 'Euros', de: 'Euro', category: 'money' },
  { id: 'queue', en: 'Queue / line', de: 'Schlange', category: 'stall' },
  { id: 'stall', en: 'Food stall', de: 'Essensstand / Marktstand', category: 'stall' },
  { id: 'market', en: 'Market', de: 'Markt / Flohmarkt', category: 'stall' },
  { id: 'open', en: 'We are open', de: 'Wir haben geöffnet', category: 'stall' },
  { id: 'closed', en: 'Sold out', de: 'Ausverkauft', category: 'stall' },
  { id: 'plates', en: 'Plates', de: 'Teller / Papierteller', category: 'kitchen' },
  { id: 'oil', en: 'Oil', de: 'Öl', category: 'kitchen' },
  { id: 'batter', en: 'Batter', de: 'Teig', category: 'kitchen' },
  { id: 'hot', en: 'Careful — hot', de: 'Vorsicht — heiß', category: 'kitchen' },
  { id: 'extra', en: 'Extra chutney', de: 'Extra Chutney', category: 'kitchen' },
  { id: 'noonion', en: 'No onion', de: 'Ohne Zwiebeln', category: 'kitchen' },
  { id: 'combo', en: 'Combo pack', de: 'Kombi-Paket', category: 'food' },
  { id: 'takeaway', en: 'Takeaway', de: 'Zum Mitnehmen', category: 'customer' },
  { id: 'here', en: 'To eat here', de: 'Zum Hieressen', category: 'customer' },
  { id: 'water', en: 'Water', de: 'Wasser', category: 'food' },
  { id: 'napkin', en: 'Napkin', de: 'Serviette', category: 'stall' },
  { id: 'bin', en: 'Trash bin', de: 'Mülltonne', category: 'stall' },
  { id: 'rain', en: 'Because of rain…', de: 'Wegen Regen…', category: 'stall' },
  { id: 'tomorrow', en: 'See you tomorrow', de: 'Bis morgen', category: 'customer' },
]

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
