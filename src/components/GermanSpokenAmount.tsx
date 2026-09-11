import { euroAmountDe } from '../lib/euroDeWords'

/** Line staff can read aloud to a German-speaking customer. */
export function GermanSpokenAmount({ value }: { value: number }) {
  if (!Number.isFinite(value) || value <= 0) return null
  return (
    <div className="euro-de-words" lang="de">
      {euroAmountDe(value)}
    </div>
  )
}
