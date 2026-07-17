import { useEffect, useState } from 'react'
import { Money } from '../components/Money'
import { useLocale } from '../context/LocaleContext'
import {
  EMPTY_DISPLAY,
  subscribeDisplay,
  type PosDisplayState,
} from '../lib/displaySync'

/** Full-screen second display for customers at the stall. */
export function CustomerDisplay() {
  const { tr } = useLocale()
  const [state, setState] = useState<PosDisplayState>(EMPTY_DISPLAY)

  useEffect(() => subscribeDisplay(setState), [])

  const bigNum =
    state.ticketNumber != null
      ? String(state.ticketNumber)
      : state.ticketLabel.replace(/^Customer\s+/i, '') || '—'

  return (
    <div className={`cust-display cust-display--${state.phase}`}>
      <div className="cust-display__brand">Nasta Zentrum</div>
      <div className="cust-display__tag">Frisch · Gesund · Authentisch</div>

      {state.phase === 'idle' && (
        <div className="cust-display__idle">
          <p>{tr('bitteWarten')}</p>
          <p className="cust-display__sub">{tr('pleaseWait')}</p>
        </div>
      )}

      {state.phase === 'ordering' && (
        <>
          <div className="cust-display__label">{tr('yourTotal')}</div>
          <div className="cust-display__total">
            <Money value={state.total} />
          </div>
          {state.lineSummary && (
            <p className="cust-display__lines">{state.lineSummary}</p>
          )}
        </>
      )}

      {(state.phase === 'waiting' || state.phase === 'ready') && (
        <>
          <div className="cust-display__label">
            {state.phase === 'ready' ? tr('thankYou') : tr('nowServing')}
          </div>
          <div className="cust-display__ticket">{bigNum}</div>
          <div className="cust-display__wait">
            {state.phase === 'waiting' ? (
              <>
                <strong>{tr('bitteWarten')}</strong>
                <span>{tr('pleaseWait')}</span>
              </>
            ) : (
              <strong>{tr('thankYou')}</strong>
            )}
          </div>
          {state.total > 0 && (
            <div className="cust-display__total cust-display__total--sm">
              <Money value={state.total} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
