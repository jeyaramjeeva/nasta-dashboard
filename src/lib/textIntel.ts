/** Lightweight language detection + sentiment (no API required). */

export type DetectedLang = 'en' | 'de' | 'ta' | 'ka' | 'other'

const DE_WORDS =
  /\b(und|der|die|das|nicht|ich|wir|sehr|gut|lecker|danke|bitte|mit|für|schmeckt|essen|freundlich)\b/i
const EN_WORDS =
  /\b(the|and|was|were|very|good|great|delicious|thanks|please|with|food|friendly|love|amazing)\b/i
const TA_CHARS = /[\u0B80-\u0BFF]/
const KA_CHARS = /[\u0C80-\u0CFF]/

export function detectLanguage(text: string): DetectedLang {
  const t = (text || '').trim()
  if (!t) return 'other'
  if (TA_CHARS.test(t)) return 'ta'
  if (KA_CHARS.test(t)) return 'ka'
  const de = (t.match(DE_WORDS) || []).length
  const en = (t.match(EN_WORDS) || []).length
  if (de >= 2 && de > en) return 'de'
  if (en >= 2 && en > de) return 'en'
  if (de > en) return 'de'
  if (en > de) return 'en'
  // umlauts → likely German
  if (/[äöüßÄÖÜ]/.test(t)) return 'de'
  return 'other'
}

export function langLabel(lang: DetectedLang): string {
  switch (lang) {
    case 'en':
      return 'English'
    case 'de':
      return 'Deutsch'
    case 'ta':
      return 'தமிழ்'
    case 'ka':
      return 'ಕನ್ನಡ'
    default:
      return 'Other'
  }
}

export type SentimentLabel = 'positive' | 'neutral' | 'negative'

export interface SentimentResult {
  label: SentimentLabel
  score: number // -1 … 1
  reasons: string[]
}

const POS =
  /\b(love|great|amazing|delicious|excellent|perfect|friendly|yummy|lecker|super|toll|freundlich|perfekt|wunderbar|best)\b/i
const NEG =
  /\b(bad|cold|slow|rude|terrible|awful|bland|dry|overpriced|schrecklich|kalt|langsam|unfreundlich|teuer|trocken)\b/i

/** Sentiment from free text + optional star rating (1–5). */
export function analyzeSentiment(
  text: string,
  overallRating?: number,
): SentimentResult {
  const reasons: string[] = []
  let score = 0
  const t = (text || '').trim()
  const posHits = t.match(POS) || []
  const negHits = t.match(NEG) || []
  score += posHits.length * 0.25
  score -= negHits.length * 0.3
  if (posHits.length) reasons.push(`Positive words (${posHits.length})`)
  if (negHits.length) reasons.push(`Negative words (${negHits.length})`)

  if (overallRating != null && overallRating > 0) {
    const r = (overallRating - 3) / 2 // -1 … 1
    score += r * 0.7
    reasons.push(`${overallRating}★ rating`)
  }

  score = Math.max(-1, Math.min(1, score))
  const label: SentimentLabel =
    score >= 0.25 ? 'positive' : score <= -0.25 ? 'negative' : 'neutral'
  if (!reasons.length) reasons.push('Neutral / little text')
  return { label, score: Math.round(score * 100) / 100, reasons }
}
