import { demoStorageKey } from './demoMode'
import { germanyTodayYmd, germanyYmd } from './germanyTime'
import { soldCounts, type StallOrder } from './stallOps'

export interface AchievementDef {
  id: string
  title: string
  description: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_sale', title: 'First sale', description: 'Complete your first ticket today' },
  { id: 'plates_10', title: '10 plates', description: 'Sell 10 plates in a day' },
  { id: 'plates_50', title: '50 plates', description: 'Sell 50 plates in a day' },
  { id: 'plates_100', title: 'Century', description: 'Sell 100 plates in a day' },
  { id: 'tickets_10', title: 'Busy stall', description: '10 tickets completed today' },
  { id: 'tickets_25', title: 'Rush hour', description: '25 tickets completed today' },
  { id: 'first_tip', title: 'Tip jar', description: 'Receive your first tip today' },
  { id: 'exact_pay', title: 'Exact change', description: 'Customer paid exact amount' },
]

const KEY = 'nasta-achievements-v1'

type Store = Record<string, string[]> // dayYmd → unlocked ids

function storageKey(): string {
  return demoStorageKey(KEY)
}

function load(): Store {
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return {}
    return JSON.parse(raw) as Store
  } catch {
    return {}
  }
}

function save(store: Store) {
  localStorage.setItem(storageKey(), JSON.stringify(store))
}

export function unlockedToday(now = new Date()): string[] {
  return load()[germanyTodayYmd(now)] || []
}

function dayOf(o: StallOrder): string {
  return germanyYmd(new Date(o.completedAt || o.createdAt))
}

function plateCountToday(orders: StallOrder[], today: string): number {
  const sold = soldCounts(
    orders.filter((o) => o.status === 'completed' && !o.voided && dayOf(o) === today),
  )
  return sold.reduce((s, r) => s + r.qty, 0)
}

function ticketsToday(orders: StallOrder[], today: string): number {
  return orders.filter((o) => o.status === 'completed' && !o.voided && dayOf(o) === today)
    .length
}

/** Evaluate after a sale; returns newly unlocked achievements. */
export function evaluateAchievements(
  orders: StallOrder[],
  justCompleted?: StallOrder | null,
  now = new Date(),
): AchievementDef[] {
  const today = germanyTodayYmd(now)
  const store = load()
  const have = new Set(store[today] || [])
  const freshly: AchievementDef[] = []

  const plates = plateCountToday(orders, today)
  const tickets = ticketsToday(orders, today)
  const tipsToday = orders.some(
    (o) => o.status === 'completed' && !o.voided && (o.tip || 0) > 0 && dayOf(o) === today,
  )

  const checks: [string, boolean][] = [
    ['first_sale', tickets >= 1],
    ['plates_10', plates >= 10],
    ['plates_50', plates >= 50],
    ['plates_100', plates >= 100],
    ['tickets_10', tickets >= 10],
    ['tickets_25', tickets >= 25],
    ['first_tip', tipsToday],
    [
      'exact_pay',
      Boolean(
        justCompleted &&
          justCompleted.paid != null &&
          Math.abs((justCompleted.change ?? 0)) < 0.001,
      ),
    ],
  ]

  for (const [id, ok] of checks) {
    if (!ok || have.has(id)) continue
    have.add(id)
    const def = ACHIEVEMENTS.find((a) => a.id === id)
    if (def) freshly.push(def)
  }

  if (freshly.length) {
    store[today] = [...have]
    save(store)
  }
  return freshly
}

export function allUnlockedForDay(now = new Date()): AchievementDef[] {
  const ids = new Set(unlockedToday(now))
  return ACHIEVEMENTS.filter((a) => ids.has(a.id))
}
