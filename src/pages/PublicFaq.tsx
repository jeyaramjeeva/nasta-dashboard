import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'

type Lang = 'en' | 'de'

const FAQ = [
  {
    id: 'spice',
    en: 'How spicy is the food?',
    de: 'Wie scharf ist das Essen?',
    aEn:
      'Most dishes are mild–medium. Blumenkohl 65 and some chutneys have more heat. Ask for “mild” / “weniger scharf” and we tone it down.',
    aDe:
      'Die meisten Gerichte sind mild bis mittel. Blumenkohl 65 und manche Chutneys sind schärfer. Sag „mild“ / „weniger scharf“ — wir passen an.',
  },
  {
    id: 'vegan',
    en: 'What is vegan?',
    de: 'Was ist vegan?',
    aEn:
      'Classic masala dosa (no cheese), tomato chutney, sambar, and mango lassi depends on recipe — ask staff. Cheese dosa is vegetarian, not vegan.',
    aDe:
      'Klassische Masala-Dosa (ohne Käse), Tomaten-Chutney und Sambar sind in der Regel vegan. Käse-Dosa ist vegetarisch, nicht vegan. Einfach nachfragen.',
  },
  {
    id: 'gluten',
    en: 'Gluten?',
    de: 'Gluten?',
    aEn:
      'Dosa batter is rice + urad dal (naturally gluten-free). Cross-contact in a busy stall is possible. Blumenkohl 65 batter may contain wheat — ask.',
    aDe:
      'Dosa-Teig ist Reis + Urad-Dal (von Natur aus glutenfrei). Bei starkem Betrieb ist Kreuzkontakt möglich. Blumenkohl-65-Panade kann Weizen enthalten — bitte fragen.',
  },
  {
    id: 'nuts',
    en: 'Nuts / allergens',
    de: 'Nüsse / Allergene',
    aEn:
      'We cook with oil, spices, dairy (chai, cheese, some lassi), and possible traces from shared equipment. Tell us allergies before ordering.',
    aDe:
      'Wir kochen mit Öl, Gewürzen, Milchprodukten (Chai, Käse, manches Lassi) und möglichen Spuren durch gemeinsame Geräte. Allergien bitte vor der Bestellung sagen.',
  },
  {
    id: 'chai',
    en: 'Masala chai',
    de: 'Masala-Chai',
    aEn: 'Spiced milk tea — warm, lightly sweet. Not caffeine-free.',
    aDe: 'Gewürzter Milchtee — warm, leicht süß. Enthält Koffein.',
  },
  {
    id: 'nutrition',
    en: 'Rough nutrition (per dosa)',
    de: 'Grobe Nährwerte (pro Dosa)',
    aEn:
      'A masala dosa is a filling rice–lentil crepe with potato masala — roughly a full meal. Combos add cauliflower snack + drink. Exact macros vary by batch; we cook fresh, not lab-measured.',
    aDe:
      'Eine Masala-Dosa ist eine sättigende Reis-Linsen-Crêpe mit Kartoffelmasala — etwa eine Mahlzeit. Kombis dazu Blumenkohl-Snack + Getränk. Exakte Makros variieren; frisch gekocht, nicht laborgenau.',
  },
]

export function PublicFaq() {
  const [lang, setLang] = useState<Lang>('en')
  const qrUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://nastazentrum.vercel.app/faq'
    return `${window.location.origin}/faq`
  }, [])
  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrUrl)}`

  return (
    <div className="public-lite">
      <header className="public-lite__head">
        <Link to="/order" className="public-lite__brand">
          <img src="/nasta-logo.png" alt="" width={48} height={48} />
          <span>Nasta Zentrum</span>
        </Link>
        <div className="public-order__lang" role="group">
          <button type="button" className={lang === 'de' ? 'is-active' : ''} onClick={() => setLang('de')}>
            DE
          </button>
          <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>
            EN
          </button>
        </div>
      </header>
      <main className="public-lite__main">
        <h1>{lang === 'de' ? 'Würze & FAQ' : 'Spice & nutrition FAQ'}</h1>
        <p className="hint-inline">
          {lang === 'de'
            ? 'QR am Stand → diese Seite. Kein Ersatz für medizinische Allergieberatung.'
            : 'QR at the stall → this page. Not a substitute for medical allergy advice.'}
        </p>
        <div className="faq-qr">
          <img src={qrImg} alt="QR to FAQ" width={160} height={160} />
          <div>
            <strong>{lang === 'de' ? 'Für Tischaufsteller' : 'For table tents'}</strong>
            <p className="hint-inline">{qrUrl}</p>
            <Link className="btn ghost" to="/order">
              {lang === 'de' ? 'Zur Bestellung' : 'Order food'}
            </Link>
          </div>
        </div>
        <div className="faq-cards">
          {FAQ.map((f) => (
            <article key={f.id} className="faq-card">
              <h2>{lang === 'de' ? f.de : f.en}</h2>
              <p>{lang === 'de' ? f.aDe : f.aEn}</p>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
