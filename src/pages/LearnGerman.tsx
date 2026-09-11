import { useMemo, useState } from 'react'
import { BookOpen, RotateCcw } from 'lucide-react'
import { MotionCard } from '../components/MotionCard'
import { LEARN_CARDS, shuffle, type LearnCard } from '../lib/learnGerman'

type Mode = 'en-de' | 'de-en'

export function LearnGerman() {
  const [mode, setMode] = useState<Mode>('en-de')
  const [cat, setCat] = useState<'all' | LearnCard['category']>('all')
  const [deck, setDeck] = useState(() => shuffle(LEARN_CARDS))
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState(0)
  const [again, setAgain] = useState(0)

  const filtered = useMemo(
    () => (cat === 'all' ? deck : deck.filter((c) => c.category === cat)),
    [deck, cat],
  )
  const card = filtered[i % Math.max(1, filtered.length)]

  function reshuffle() {
    setDeck(shuffle(LEARN_CARDS))
    setI(0)
    setFlipped(false)
    setKnown(0)
    setAgain(0)
  }

  function next(ok: boolean) {
    if (ok) setKnown((n) => n + 1)
    else setAgain((n) => n + 1)
    setFlipped(false)
    setI((n) => n + 1)
  }

  if (!card) {
    return (
      <MotionCard interactive={false}>
        <p>No cards in this category.</p>
      </MotionCard>
    )
  }

  const front = mode === 'en-de' ? card.en : card.de
  const back = mode === 'en-de' ? card.de : card.en

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <BookOpen size={22} style={{ verticalAlign: -3, marginRight: 8 }} />
            Learn German — stall talk
          </h1>
          <p className="hint-inline">
            English speakers on the stall: practise food & customer phrases in German. Tap the card to
            flip.
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={reshuffle}>
          <RotateCcw size={14} /> Shuffle
        </button>
      </div>

      <div className="filters" style={{ marginBottom: '0.85rem' }}>
        <select value={mode} onChange={(e) => { setMode(e.target.value as Mode); setFlipped(false) }}>
          <option value="en-de">English → German</option>
          <option value="de-en">German → English</option>
        </select>
        <select
          value={cat}
          onChange={(e) => {
            setCat(e.target.value as typeof cat)
            setI(0)
            setFlipped(false)
          }}
        >
          <option value="all">All</option>
          <option value="food">Food</option>
          <option value="customer">Customer</option>
          <option value="money">Money</option>
          <option value="stall">Stall</option>
          <option value="kitchen">Kitchen</option>
        </select>
        <span className="badge ok">Know {known}</span>
        <span className="badge warn">Again {again}</span>
      </div>

      <MotionCard interactive={false} className="learn-card-wrap">
        <button
          type="button"
          className={`learn-flash${flipped ? ' is-flipped' : ''}`}
          onClick={() => setFlipped((f) => !f)}
        >
          <span className="learn-flash__side">{flipped ? back : front}</span>
          {flipped && card.hint ? (
            <span className="hint-inline" style={{ marginTop: 8 }}>
              {card.hint}
            </span>
          ) : (
            <span className="hint-inline" style={{ marginTop: 8 }}>
              Tap to reveal
            </span>
          )}
        </button>
        <div className="chip-row" style={{ marginTop: '0.85rem', justifyContent: 'center' }}>
          <button type="button" className="btn ghost" onClick={() => next(false)}>
            Again
          </button>
          <button type="button" className="btn" onClick={() => next(true)}>
            Got it
          </button>
        </div>
        <p className="hint-inline" style={{ textAlign: 'center', marginTop: 8 }}>
          Card {(i % filtered.length) + 1} / {filtered.length} · {card.category}
        </p>
      </MotionCard>
    </>
  )
}
