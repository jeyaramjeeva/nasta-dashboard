/** Offline / fallback answers for the team AI helper (no code edits). */

export interface HelperReply {
  answer: string
  source: 'kb' | 'llm'
}

const FAQS: { keys: string[]; answer: string }[] = [
  {
    keys: ['order', 'new order', 'pos', 'ticket', 'pending', 'sell'],
    answer:
      'Orders → New order: pick the stall (Event menu). Prices & dishes follow the event type (Flohmarkt / Streetfood Festival / Gourmet). Add combos (chai/lassi) or singles → Submit. Pending shows oldest first; Delivered asks Cash or PayPal.',
  },
  {
    keys: ['menu', 'price', 'flohmarkt', 'gourmet', 'streetfood', 'event type'],
    answer:
      'Orders → Menu prices (not in Stall mode). Pick Event type, edit that type’s menu only. Gourmet = Gourmet Festival; Streetfood Festival = Street Festival. New order uses the selected stall’s type automatically.',
  },
  {
    keys: ['excel', 'upload', 'history', 'download'],
    answer:
      'Only Jeeva: Upload → choose file → Merge (usual) or Replace → Publish. Upload history: Excel downloads a rebuilt sheet from that version; Restore puts it live. Excel does not erase POS orders, stock, or menus.',
  },
  {
    keys: ['stock', 'inventory', 'pack'],
    answer:
      'Stock: buy/use warehouse items. Pack for event reserves qty per stall. Low-stock badges show when remaining ≤ threshold.',
  },
  {
    keys: ['todo', 'task', 'reminder', 'email'],
    answer:
      'To-dos: add task, assignee (Sriram/Sneha/Jeeva), due date/time. Funny email reminders ~24h and ~2h before. Jeeva sets inboxes under Account → Notification emails.',
  },
  {
    keys: ['goal', 'milestone'],
    answer: 'Goals: set main target €/note and milestones. Track where you are now vs the target.',
  },
  {
    keys: ['paypal', 'qr', 'cash', 'pay'],
    answer:
      'On Delivered pick Cash (enter paid + tip) or PayPal (shows QR). Developer can upload a custom PayPal QR in Studio.',
  },
  {
    keys: ['review', 'feedback', 'customer review'],
    answer:
      'Reviews → share the customer QR. Guests open /review (form only). Answers land in Reviews for the team.',
  },
  {
    keys: ['calendar', 'diwali', 'karneval', 'seasonal', 'special'],
    answer:
      'Calendar shows stalls + India/Germany seasonal specials (Diwali, Holi, Karneval/Rosenmontag, Weihnachten, …) with stall tips for that day.',
  },
  {
    keys: ['guest', 'stall mode', 'lock'],
    answer:
      'Guest login is stall-only (Orders, Stock, Calendar, Training). On stall days, team login opens Orders in Stall mode. Unlock with PIN 9987 to use the full site. Orders → Train 5 min uses last Saturday’s menu with fake tickets.',
  },
  {
    keys: ['password', 'login', 'forgot'],
    answer:
      'Login with your team name. Forgot password sends a request to Jeeva’s help email. After a recovery link, set a new password on Account.',
  },
  {
    keys: ['participant', 'who worked', 'events'],
    answer: 'Events cards: tick who worked (Sriram / Sneha / Jeeva) — saved per event.',
  },
  {
    keys: ['ai', 'code', 'change', 'cursor'],
    answer:
      'Use the AI helper button (bottom right) for how-to questions. Only Developer has AI Code Agent — that can edit the GitHub repo and open a PR. You review before merge.',
  },
  {
    keys: ['weather', 'rain'],
    answer: 'Calendar pulls live weather for stall days. Use tags Go / Caution / Skip for planning.',
  },
]

function normalize(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Keyword FAQ matcher — always available without API keys. */
export function answerFromKnowledgeBase(question: string): HelperReply {
  const q = normalize(question)
  if (!q) {
    return {
      answer: 'Ask anything about Orders, Menu prices, Stock, Upload, To-dos, Calendar, or PayPal.',
      source: 'kb',
    }
  }

  let best: { score: number; answer: string } | null = null
  for (const faq of FAQS) {
    let score = 0
    for (const key of faq.keys) {
      if (q.includes(key)) score += key.length
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { score, answer: faq.answer }
    }
  }

  if (best) return { answer: best.answer, source: 'kb' }

  return {
    answer:
      'I’m not sure. Try asking about: New order / event menu, Menu prices by type, Stock pack, To-dos & emails, PayPal QR, or Calendar specials. For Upload Excel or code changes, ask Developer (Studio / AI Code).',
    source: 'kb',
  }
}
