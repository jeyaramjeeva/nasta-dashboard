/** Built-in background AI: forecasts, alerts, and actionable suggestions from live stall data. */

import {
  aiDemandPrediction,
  aiSalesForecast,
  comboRecommendations,
  businessHealthScore,
} from './businessIntel'
import { germanyTodayYmd } from './germanyTime'
import { detectMidDaySalesCrash, buildSalesAiContext } from './salesAnomaly'
import {
  isLowStock,
  type FoodMadeRow,
  type MenuItem,
  type StallOrder,
  type StockItem,
  type TeamTodo,
} from './stallOps'
import { foodDaySpoilWastePct } from './stallRecipes'
import { waitMinutesSince, waitTone } from './waitTime'

export type AiTipKind = 'forecast' | 'alert' | 'suggest' | 'prep' | 'stock' | 'ops'
export type AiTipSeverity = 'info' | 'warn' | 'critical'

export interface AiTip {
  id: string
  kind: AiTipKind
  severity: AiTipSeverity
  title: string
  body: string
  href?: string
  score: number
}

export interface BackgroundAiInput {
  orders: StallOrder[]
  menu: MenuItem[]
  stock: StockItem[]
  foodMade?: Record<string, Record<string, Record<string, FoodMadeRow>>>
  teamTodos?: TeamTodo[]
  now?: Date
}

const SEV_SCORE: Record<AiTipSeverity, number> = {
  critical: 100,
  warn: 60,
  info: 30,
}

function tip(
  partial: Omit<AiTip, 'score'> & { score?: number },
): AiTip {
  return {
    ...partial,
    score: partial.score ?? SEV_SCORE[partial.severity],
  }
}

function todayFoodSpoilPct(
  foodMade: BackgroundAiInput['foodMade'],
  day: string,
): number | null {
  if (!foodMade) return null
  let made = 0
  let spoiled = 0
  for (const byDay of Object.values(foodMade)) {
    const dayLog = byDay[day]
    if (!dayLog) continue
    const pct = foodDaySpoilWastePct(dayLog)
    if (pct == null) continue
    for (const row of Object.values(dayLog)) {
      made += Number(row.made) || 0
      spoiled += Number(row.spoiled) || 0
    }
  }
  if (made <= 0) return null
  return Math.round((spoiled / made) * 1000) / 10
}

/** Deterministic coach tips — always available, no API key needed. */
export function buildBackgroundTips(input: BackgroundAiInput): AiTip[] {
  const now = input.now || new Date()
  const today = germanyTodayYmd(now)
  const tips: AiTip[] = []
  const { orders, menu, stock } = input

  const forecast = aiSalesForecast(orders)
  if (forecast.next7Revenue > 0 || forecast.narrative) {
    tips.push(
      tip({
        id: 'forecast-7d',
        kind: 'forecast',
        severity: forecast.vsRecentAvg < -15 ? 'warn' : 'info',
        title: '7-day sales outlook',
        body: `${forecast.narrative}${
          forecast.vsRecentAvg
            ? ` (${forecast.vsRecentAvg > 0 ? '+' : ''}${forecast.vsRecentAvg}% vs recent daily avg).`
            : ''
        }`,
        href: '/insights',
        score: SEV_SCORE.info + 5,
      }),
    )
  }

  const crash = detectMidDaySalesCrash(orders, now)
  if (crash) {
    tips.push(
      tip({
        id: 'sales-crash',
        kind: 'alert',
        severity: crash.severity === 'critical' ? 'critical' : 'warn',
        title: crash.severity === 'critical' ? 'Sales crash' : 'Sales soft',
        body: `${crash.message} Try a combo push, chai/lassi offer, or check queue wait.`,
        href: '/orders',
        score: crash.severity === 'critical' ? 120 : 80,
      }),
    )
  }

  const pending = orders.filter((o) => o.status === 'pending' && !o.voided)
  const hotWaits = pending
    .map((o) => ({ o, mins: waitMinutesSince(o.createdAt, now.getTime()) }))
    .filter((x) => waitTone(x.mins) === 'hot')
  if (hotWaits.length > 0) {
    const worst = Math.max(...hotWaits.map((x) => x.mins))
    tips.push(
      tip({
        id: 'wait-hot',
        kind: 'ops',
        severity: worst >= 35 ? 'critical' : 'warn',
        title: `${hotWaits.length} ticket${hotWaits.length > 1 ? 's' : ''} waiting ≥25m`,
        body: `Longest wait ~${worst}m. Clear kitchen queue or call numbers on Pending.`,
        href: '/orders',
        score: 90 + Math.min(worst, 40),
      }),
    )
  } else if (pending.length >= 6) {
    tips.push(
      tip({
        id: 'queue-busy',
        kind: 'ops',
        severity: 'info',
        title: `Busy queue (${pending.length} pending)`,
        body: 'Several tickets open — keep drinks and snacks flowing to cut wait.',
        href: '/orders',
      }),
    )
  }

  const low = stock.filter(isLowStock).slice(0, 5)
  if (low.length) {
    tips.push(
      tip({
        id: 'low-stock',
        kind: 'stock',
        severity: low.length >= 3 ? 'warn' : 'info',
        title: `Low stock: ${low.map((s) => s.name).slice(0, 3).join(', ')}${
          low.length > 3 ? '…' : ''
        }`,
        body: 'Restock before the next rush, or hide sold-out items on the menu.',
        href: '/stock',
        score: 50 + low.length * 8,
      }),
    )
  }

  const demand = aiDemandPrediction(orders, menu)
  const rising = demand.filter((d) => d.trend === 'up').slice(0, 3)
  if (rising.length) {
    tips.push(
      tip({
        id: 'demand-up',
        kind: 'suggest',
        severity: 'info',
        title: `Rising demand: ${rising.map((d) => d.name).join(', ')}`,
        body: 'Prep extra batches and keep these visible on the stall board.',
        href: '/food',
      }),
    )
  }
  const falling = demand.filter((d) => d.trend === 'down' && d.recentQty > 0).slice(0, 2)
  if (falling.length) {
    tips.push(
      tip({
        id: 'demand-down',
        kind: 'suggest',
        severity: 'info',
        title: `Cooling: ${falling.map((d) => d.name).join(', ')}`,
        body: 'Don’t over-prep these — push as combos or specials instead.',
        href: '/food',
        score: 28,
      }),
    )
  }

  const combos = comboRecommendations(orders).slice(0, 2)
  for (const c of combos) {
    tips.push(
      tip({
        id: `combo-${c.a}-${c.b}`,
        kind: 'suggest',
        severity: 'info',
        title: `Combo idea: ${c.a} + ${c.b}`,
        body: c.hint || `Often bought together (${c.together}×). Offer as a set.`,
        href: '/orders',
        score: 25 + Math.min(c.together, 20),
      }),
    )
  }

  const spoilPct = todayFoodSpoilPct(input.foodMade, today)
  if (spoilPct != null && spoilPct >= 12) {
    tips.push(
      tip({
        id: 'food-spoil',
        kind: 'prep',
        severity: spoilPct >= 25 ? 'warn' : 'info',
        title: `Food waste ~${spoilPct}% today`,
        body: 'Lower Made tomorrow or carry leftovers into next day. Check Food tab.',
        href: '/food',
        score: 40 + spoilPct,
      }),
    )
  }

  const openTodos = (input.teamTodos || []).filter((t) => !t.done)
  const dueSoon = openTodos.filter((t) => {
    if (!t.dueYmd) return false
    const due = new Date(`${t.dueYmd}T${t.dueTime || '23:59'}:00`).getTime()
    if (Number.isNaN(due)) return false
    const ms = due - now.getTime()
    return ms >= -2 * 60 * 60 * 1000 && ms <= 24 * 60 * 60 * 1000
  })
  if (dueSoon.length) {
    tips.push(
      tip({
        id: 'todos-due',
        kind: 'ops',
        severity: 'warn',
        title: `${dueSoon.length} to-do${dueSoon.length > 1 ? 's' : ''} due within 24h`,
        body: dueSoon
          .slice(0, 3)
          .map((t) => t.text)
          .join(' · '),
        href: '/todos',
        score: 55 + dueSoon.length * 5,
      }),
    )
  }

  try {
    const health = businessHealthScore({
      orders,
      menu,
      lowStockCount: low.length,
    })
    if (health.score < 60) {
      const top = health.factors.slice(0, 2).map((f) => f.note || f.label).join(' ')
      tips.push(
        tip({
          id: 'health-low',
          kind: 'alert',
          severity: health.score < 45 ? 'warn' : 'info',
          title: `Business health ${health.grade} (${health.score})`,
          body: top || 'Check Insights for margin and volume drivers.',
          href: '/insights',
          score: 45 + (60 - health.score),
        }),
      )
    }
  } catch {
    /* health optional if data thin */
  }

  if (!tips.length) {
    tips.push(
      tip({
        id: 'all-clear',
        kind: 'ops',
        severity: 'info',
        title: 'AI coach standing by',
        body: 'No urgent issues. Keep logging POS — forecasts improve with more sold days.',
        href: '/insights',
        score: 1,
      }),
    )
  }

  return tips.sort((a, b) => b.score - a.score).slice(0, 12)
}

export function tipsToBriefing(tips: AiTip[]): string {
  const top = tips.filter((t) => t.id !== 'all-clear').slice(0, 5)
  if (!top.length) return 'All clear — no urgent coach tips right now.'
  return top.map((t, i) => `${i + 1}. ${t.title}: ${t.body}`).join('\n')
}

/** Compact context for LLM coach enrich. */
export function buildCoachLlmContext(input: BackgroundAiInput, tips: AiTip[]): string {
  const sales = buildSalesAiContext(input.orders)
  const tipBlock = tips
    .slice(0, 8)
    .map((t) => `[${t.severity}/${t.kind}] ${t.title} — ${t.body}`)
    .join('\n')
  return `Rule tips (already computed):\n${tipBlock}\n\nSales snapshot:\n${sales.slice(0, 2500)}`
}

export function parseCoachLlmReply(text: string): { briefing: string; actions: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const actions: string[] = []
  const briefingParts: string[] = []
  for (const line of lines) {
    if (/^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      actions.push(line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, ''))
    } else {
      briefingParts.push(line)
    }
  }
  return {
    briefing: (briefingParts.join(' ') || lines[0] || text).slice(0, 600),
    actions: actions.slice(0, 5),
  }
}
