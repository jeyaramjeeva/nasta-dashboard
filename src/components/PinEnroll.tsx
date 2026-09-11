import { useEffect, useState } from 'react'
import { PinInput } from './PinInput'
import {
  LOGIN_PIN_DIGITS,
  clearPinEnrollPending,
  peekPinEnrollPending,
  saveLoginPin,
  skipPinEnroll,
  type PinEnrollPending,
} from '../lib/loginPin'
import {
  biometricAvailable,
  biometricLabel,
  saveBiometricSecret,
} from '../lib/loginBiometric'

export function PinEnroll({ onDone }: { onDone: () => void }) {
  const [pending] = useState(() => peekPinEnrollPending())
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [step, setStep] = useState<'create' | 'confirm'>('create')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [bioOffer, setBioOffer] = useState(false)
  const [bioName, setBioName] = useState('Biometrics')

  useEffect(() => {
    if (!pending) onDone()
  }, [pending, onDone])

  if (!pending) return null

  async function finish(digits: string, p: PinEnrollPending) {
    setBusy(true)
    setError(null)
    try {
      await saveLoginPin(p.accountKey, digits, p.password)
      clearPinEnrollPending()
      const canBio = await biometricAvailable()
      if (canBio) {
        setBioName(await biometricLabel())
        setBioOffer(true)
        return
      }
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save PIN')
    } finally {
      setBusy(false)
    }
  }

  async function onContinue() {
    setError(null)
    const digits = (step === 'create' ? pin : confirm).replace(/\D/g, '')
    if (step === 'create') {
      if (digits.length !== LOGIN_PIN_DIGITS) {
        setError(`Choose a ${LOGIN_PIN_DIGITS}-digit PIN.`)
        return
      }
      setStep('confirm')
      setConfirm('')
      return
    }
    if (digits !== pin.replace(/\D/g, '')) {
      setError('PINs do not match. Try again.')
      setStep('create')
      setPin('')
      setConfirm('')
      return
    }
    await finish(digits, pending as PinEnrollPending)
  }

  if (bioOffer) {
    return (
      <div className="login-page">
        <div className="login-card glass-card login-card--wide">
          <h2 className="login-enroll-title">Use {bioName} next time?</h2>
          <p className="hint-inline">
            Unlock with Face / fingerprint on this phone, then you’re in — no typing.
          </p>
          <div className="login-enroll-actions">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  try {
                    await saveBiometricSecret(pending.accountKey, pin.replace(/\D/g, ''))
                  } catch {
                    /* continue anyway */
                  }
                  onDone()
                })()
              }}
            >
              Enable {bioName}
            </button>
            <button type="button" className="btn ghost" disabled={busy} onClick={onDone}>
              Not now
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card glass-card login-card--wide">
        <h2 className="login-enroll-title">
          {step === 'create' ? 'Set your 4-digit PIN' : 'Confirm your PIN'}
        </h2>
        <p className="hint-inline">
          For <strong>{pending.name}</strong> — saved on your account, not this computer. Next time
          any stall PC will ask for this PIN instead of the password.
        </p>
        <label className="login-field">
          <span>{step === 'create' ? 'New PIN (4 digits)' : 'Type PIN again'}</span>
          <PinInput
            value={step === 'create' ? pin : confirm}
            onChange={(v) => {
              if (step === 'create') setPin(v)
              else setConfirm(v)
            }}
            autoFocus
          />
        </label>
        {error && <div className="alert-item login-error">{error}</div>}
        <button
          type="button"
          className="btn login-submit"
          disabled={busy}
          onClick={() => void onContinue()}
        >
          {busy ? 'Saving…' : step === 'create' ? 'Continue' : 'Save PIN'}
        </button>
        <button
          type="button"
          className="login-forgot"
          style={{ marginTop: 8 }}
          onClick={() => {
            clearPinEnrollPending()
            skipPinEnroll(pending.accountKey)
            onDone()
          }}
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
