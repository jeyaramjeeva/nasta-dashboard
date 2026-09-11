import { germanyParts } from './germanyTime'

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night'

export function germanyDayPart(now = new Date()): DayPart {
  const h = germanyParts(now).hour
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 22) return 'evening'
  return 'night'
}

/** Soft multilingual greetings — rotate by language for the current day-part. */
const BY_PART: Record<DayPart, { lang: string; text: string }[]> = {
  morning: [
    { lang: 'en', text: 'Good morning' },
    { lang: 'de', text: 'Guten Morgen' },
    { lang: 'ta', text: 'காலை வணக்கம்' },
    { lang: 'kn', text: 'ಶುಭೋದಯ' },
  ],
  afternoon: [
    { lang: 'en', text: 'Good afternoon' },
    { lang: 'de', text: 'Guten Tag' },
    { lang: 'ta', text: 'மதிய வணக்கம்' },
    { lang: 'kn', text: 'ಶುಭ ಮಧ್ಯಾಹ್ನ' },
  ],
  evening: [
    { lang: 'en', text: 'Good evening' },
    { lang: 'de', text: 'Guten Abend' },
    { lang: 'ta', text: 'மாலை வணக்கம்' },
    { lang: 'kn', text: 'ಶುಭ ಸಂಜೆ' },
  ],
  night: [
    { lang: 'en', text: 'Welcome back' },
    { lang: 'de', text: 'Willkommen zurück' },
    { lang: 'ta', text: 'மீண்டும் வருக' },
    { lang: 'kn', text: 'ಮರಳಿ ಸ್ವಾಗತ' },
  ],
}

export function greetingsForNow(now = new Date()) {
  return BY_PART[germanyDayPart(now)]
}

const WELCOME_TEMPLATES = [
  'Hi {Name}! Ready for the market?',
  "Welcome back, {Name}! Let's make today delicious.",
  'Good to see you, {Name}! Time to serve smiles.',
  "Hey {Name}! Let's make some amazing dosas.",
  'Welcome, {Name}! The griddle is waiting.',
  'Hi {Name}! Another great food day starts now.',
  "Glad you're here, {Name}! Let's get cooking.",
  "Welcome aboard, {Name}! Let's keep customers happy.",
  'Hey {Name}! Ready to roll some crispy dosas?',
  "Hi {Name}! Let's have a fantastic shift.",
  'Welcome back, Chef {Name}!',
  "Hi {Name}! Let's turn batter into happiness.",
  'Hello {Name}! Fresh dosas, happy faces.',
  'Welcome, {Name}! Time to create great flavors.',
  "Hey {Name}! Let's make today unforgettable.",
  'Hi {Name}! Ready for another busy market?',
  "Welcome back, {Name}! Let's fire up the tawa.",
  "Great to see you, {Name}! Let's get started.",
  "Hello {Name}! Let's serve with a smile.",
  'Hi {Name}! Your team is ready.',
  "Welcome, {Name}! Let's make every order perfect.",
  'Hey {Name}! Another day, another crispy dosa.',
  "Hi {Name}! Let's make customers come back for more.",
  'Welcome back, {Name}! Time to shine.',
  "Hello {Name}! Let's cook with passion.",
  'Hi {Name}! Every great stall starts with a great team.',
  "Welcome, {Name}! Let's keep the queue moving.",
  "Hey {Name}! Let's make every bite memorable.",
  "Hi {Name}! Hope you're hungry for success.",
  "Welcome back, {Name}! Let's make magic on the tawa.",
  'Hello {Name}! Ready to serve authentic flavors?',
  "Hi {Name}! Let's bring smiles, one dosa at a time.",
  'Welcome, {Name}! Fresh batter, fresh start.',
  "Hey {Name}! Let's make today extra crispy.",
  'Hi {Name}! Customers are waiting for your best.',
  "Welcome back, {Name}! Let's have some fun today.",
  'Hello {Name}! Ready to serve with energy?',
  "Hi {Name}! Let's keep the aroma flowing.",
  'Welcome, {Name}! Every order counts.',
  "Hey {Name}! Let's make this shift awesome.",
  'Hi {Name}! Another opportunity to impress.',
  "Welcome back, {Name}! Let's cook, serve, and smile.",
  "Hello {Name}! Let's make today delicious together.",
  'Hi {Name}! Thanks for being part of the team.',
  'Welcome, {Name}! Great food starts with great people.',
  "Hey {Name}! Let's keep the customers smiling.",
  "Hi {Name}! Let's make this market our best yet.",
  'Welcome back, {Name}! Time to create happy memories.',
  "Hello {Name}! Let's serve something special today.",
  "Hi {Name}! Ready to make someone's day with a dosa?",
]

const LAST_WELCOME_KEY = 'nasta-login-welcome-last-v1'

/** Random welcome line; avoids repeating the previous pick when possible. */
export function welcomeLineForPerson(name: string): string {
  const display = name.trim() || 'there'
  let last = ''
  try {
    last = sessionStorage.getItem(LAST_WELCOME_KEY) || ''
  } catch {
    /* ignore */
  }
  const filled = WELCOME_TEMPLATES.map((t) => t.replaceAll('{Name}', display))
  const pool = filled.filter((t) => t !== last)
  const pick = pool[Math.floor(Math.random() * pool.length)] ?? filled[0]!
  try {
    sessionStorage.setItem(LAST_WELCOME_KEY, pick)
  } catch {
    /* ignore */
  }
  return pick
}

export function germanyHeuteLine(now = new Date()): string {
  const formatted = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(now)
  return `Heute · Berlin · ${formatted}`
}
