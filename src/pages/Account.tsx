import { AnimatePresence, motion } from 'framer-motion'
import { Check, Eye, EyeOff, KeyRound, Pencil, Settings, Wifi } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { springSoft } from '../lib/motion'
import { MotionCard } from '../components/MotionCard'
import { PinInput } from '../components/PinInput'
import { useAuth } from '../context/AuthContext'
import { canDevelop, getAllowedUsers } from '../lib/authAllowlist'
import { isDataSaverOn, setDataSaver } from '../lib/dataSaver'
import {
  LOGIN_PIN_DIGITS,
  accountKeyFor,
  clearAccountPin,
  fetchAccountHasPin,
  fetchTeamPinStatus,
  saveLoginPin,
} from '../lib/loginPin'
import { isCloudConfigured } from '../lib/supabase'
import { Link } from 'react-router-dom'

export function Account() {
  const { user, cloudAuth, changePassword, setNewPassword, needsNewPassword, clearNeedsNewPassword } =
    useAuth()
  const isDev = canDevelop(user)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPasswordValue] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [dataSaver, setDataSaverState] = useState(() => isDataSaverOn())
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinPassword, setPinPassword] = useState('')
  const [pinBusy, setPinBusy] = useState(false)
  const [pinHas, setPinHas] = useState(false)
  const [pinRemovePassword, setPinRemovePassword] = useState('')
  const [teamPins, setTeamPins] = useState<Record<string, boolean>>({})
  const [editOpen, setEditOpen] = useState<'pin' | 'password' | null>(
    needsNewPassword ? 'password' : null,
  )

  const recoveryOnly = needsNewPassword
  const pinKey =
    user &&
    accountKeyFor({
      cloud: isCloudConfigured(),
      email: user.email,
      name: user.name,
    })

  useEffect(() => {
    if (!pinKey) return
    void fetchAccountHasPin(pinKey).then((has) => setPinHas(has === true))
    void fetchTeamPinStatus().then(setTeamPins)
  }, [pinKey])

  useEffect(() => {
    if (recoveryOnly) setEditOpen('password')
  }, [recoveryOnly])

  useEffect(() => {
    if (!ok) return
    const t = window.setTimeout(() => setOk(null), 4000)
    return () => window.clearTimeout(t)
  }, [ok])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }

    setBusy(true)
    try {
      if (recoveryOnly) {
        await setNewPassword(newPassword)
        clearNeedsNewPassword()
        if (pinKey) {
          await clearAccountPin(pinKey, newPassword).catch(() => undefined)
          setPinHas(false)
        }
        setOk('Password updated. Set a new 4-digit PIN below.')
      } else {
        await changePassword(currentPassword, newPassword)
        if (pinKey) {
          await clearAccountPin(pinKey, newPassword).catch(() => undefined)
          setPinHas(false)
        }
        setOk('Password changed. Set a new 4-digit PIN below.')
      }
      setCurrentPassword('')
      setNewPasswordValue('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <Settings size={22} style={{ verticalAlign: -3, marginRight: 8 }} />
            Account
          </h1>
        </div>
      </div>

      <MotionCard interactive={false} className="upload-panel">
        <div className="card-head">
          <h2>Signed in</h2>
        </div>
        <p style={{ margin: '0.35rem 0 0' }}>
          <strong>{user?.name}</strong>
          <span className="hint-inline" style={{ display: 'block', marginTop: 4 }}>
            {user?.email}
            {cloudAuth ? ' · Cloud login' : ' · Local team gate'}
          </span>
        </p>
        {isDev && (
          <p className="hint-inline" style={{ marginTop: 10 }}>
            Site tools live in <Link to="/studio">Developer Studio</Link> (text, UI, tabs, PayPal,
            emails, review form).
          </p>
        )}
        <div className="page-actions" style={{ marginTop: '0.85rem' }}>
          <button
            type="button"
            className={`btn ghost${editOpen === 'pin' ? ' is-on' : ''}`}
            onClick={() => setEditOpen((s) => (s === 'pin' ? null : 'pin'))}
          >
            <KeyRound size={14} /> {editOpen === 'pin' ? 'Hide PIN' : 'Edit PIN'}
          </button>
          {cloudAuth && (
            <button
              type="button"
              className={`btn${editOpen === 'password' ? '' : ' ghost'}`}
              onClick={() => setEditOpen((s) => (s === 'password' ? null : 'password'))}
            >
              <Pencil size={14} />
              {editOpen === 'password'
                ? 'Hide password'
                : recoveryOnly
                  ? 'Set a new password'
                  : 'Change password'}
            </button>
          )}
        </div>
      </MotionCard>

      <AnimatePresence initial={false}>
      {editOpen === 'pin' && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={springSoft}
      >
      <MotionCard interactive={false} className="upload-panel mt-card">
        <div className="card-head">
          <h2>
            <KeyRound size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
            Your login PIN
          </h2>
        </div>
        <p className="hint-inline" style={{ marginTop: '0.65rem' }}>
          4 digits, saved on <strong>your account</strong> — any computer will ask for this PIN
          next time (same idea as the password).
        </p>
        {pinHas ? (
          <form
            className="account-pw-form"
            style={{ marginTop: 12 }}
            onSubmit={(e) => {
              e.preventDefault()
              if (!user || !pinKey) return
              setPinBusy(true)
              setError(null)
                void clearAccountPin(pinKey, pinRemovePassword)
                  .then(() => {
                    setPinHas(false)
                    setPinRemovePassword('')
                    setOk('PIN removed from your account.')
                    void fetchTeamPinStatus().then(setTeamPins)
                  })
                .catch((err) =>
                  setError(err instanceof Error ? err.message : 'Could not remove PIN'),
                )
                .finally(() => setPinBusy(false))
            }}
          >
            <p style={{ margin: 0 }}>PIN is set on your account.</p>
            <label className="login-field">
              <span>Account password to remove PIN</span>
              <input
                type="password"
                autoComplete="current-password"
                value={pinRemovePassword}
                onChange={(e) => setPinRemovePassword(e.target.value)}
                required
              />
            </label>
            <button className="btn ghost" type="submit" disabled={pinBusy}>
              {pinBusy ? 'Removing…' : 'Remove PIN'}
            </button>
          </form>
        ) : (
          <form
            className="account-pw-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (!user || !pinKey) return
              const digits = pin.replace(/\D/g, '')
              if (digits.length !== LOGIN_PIN_DIGITS) {
                setError(`PIN must be ${LOGIN_PIN_DIGITS} digits.`)
                return
              }
              if (digits !== pinConfirm.replace(/\D/g, '')) {
                setError('PINs do not match.')
                return
              }
              setPinBusy(true)
              setError(null)
              void saveLoginPin(pinKey, digits, pinPassword)
                .then(() => {
                  setPinHas(true)
                  setPin('')
                  setPinConfirm('')
                  setPinPassword('')
                  setOk('PIN saved to your account.')
                  void fetchTeamPinStatus().then(setTeamPins)
                })
                .catch((err) =>
                  setError(err instanceof Error ? err.message : 'Could not save PIN'),
                )
                .finally(() => setPinBusy(false))
            }}
          >
            <label className="login-field">
              <span>Account password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={pinPassword}
                onChange={(e) => setPinPassword(e.target.value)}
                required
              />
            </label>
            <label className="login-field">
              <span>New PIN (4 digits)</span>
              <PinInput value={pin} onChange={setPin} required autoComplete="new-password" />
            </label>
            <label className="login-field">
              <span>Confirm PIN</span>
              <PinInput
                value={pinConfirm}
                onChange={setPinConfirm}
                required
                autoComplete="new-password"
              />
            </label>
            <button className="btn" type="submit" disabled={pinBusy}>
              {pinBusy ? 'Saving…' : 'Save PIN'}
            </button>
          </form>
        )}
      </MotionCard>
      </motion.div>
      )}
      </AnimatePresence>

      <MotionCard interactive={false} className="upload-panel mt-card">
        <div className="card-head">
          <h2>Who has a PIN</h2>
        </div>
        <p className="hint-inline" style={{ marginTop: '0.65rem' }}>
          Each person sets their own 4-digit PIN after password login. It follows them to every PC.
        </p>
        <ul style={{ margin: '12px 0 0', paddingLeft: '1.15rem' }}>
          {getAllowedUsers().map((u) => {
            const set = teamPins[u.email.toLowerCase()] === true
            return (
              <li key={u.email}>
                <strong>{u.name}</strong>
                {u.email === user?.email ? ' (you)' : ''} — {set ? 'PIN set' : 'not set yet'}
              </li>
            )
          })}
        </ul>
      </MotionCard>

      <MotionCard interactive={false} className="upload-panel mt-card">
        <div className="card-head">
          <h2>
            <Wifi size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
            Event day · Data saver
          </h2>
        </div>
        <p className="hint-inline" style={{ marginTop: '0.65rem' }}>
          Prefer <strong>Stall mode</strong> on event day — that turns this on automatically and{' '}
          <strong>hides team chat + AI</strong> (biggest background GB). You can also toggle here.
          Sync is slower (~45s orders) and pauses when the tab is hidden. Turn off after the event if
          you want faster chat badges.
        </p>
        <label className="saver-switch">
          <input
            type="checkbox"
            checked={dataSaver}
            onChange={(e) => {
              const on = e.target.checked
              setDataSaver(on)
              setDataSaverState(on)
            }}
          />
          <span className="saver-switch__track" />
          Data saver {dataSaver ? 'ON' : 'OFF'}
        </label>
        <p className="hint-inline" style={{ marginTop: 10 }}>
          Also: keep <strong>one Orders tab</strong> open on the stall phone/tablet. Close extra
          laptop tabs of the dashboard — each open tab downloads data.
        </p>
      </MotionCard>

      <AnimatePresence initial={false}>
      {editOpen === 'password' && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={springSoft}
      >
      <MotionCard interactive={false} className="upload-panel mt-card">
        <div className="card-head">
          <h2>
            <KeyRound size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
            {recoveryOnly ? 'Set a new password' : 'Change password'}
          </h2>
        </div>

        {!cloudAuth ? (
          <p className="hint-inline" style={{ marginTop: '0.65rem' }}>
            Local mode uses one shared team password. Ask Developer to change{' '}
            <code>VITE_UPLOAD_PASSWORD</code> on Vercel, or use cloud email login to manage your own
            password.
          </p>
        ) : (
          <form className="account-pw-form" onSubmit={(e) => void onSubmit(e)}>
            <p className="hint-inline">
              This updates only <strong>your</strong> login ({user?.email}).
            </p>
            {recoveryOnly && (
              <p className="hint-inline">
                Choose a new password for your account, then continue using the app.
              </p>
            )}

            {!recoveryOnly && (
              <label className={`login-field float-field${currentPassword ? ' is-filled' : ''}`}>
                <span>Current password</span>
                <div className="pw-input">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder=" "
                  />
                  <button
                    type="button"
                    className="pw-input__toggle"
                    aria-label={showCurrent ? 'Hide password' : 'Show password'}
                    onClick={() => setShowCurrent((v) => !v)}
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            )}

            <label className={`login-field float-field${newPassword ? ' is-filled' : ''}`}>
              <span>New password</span>
              <div className="pw-input">
                <input
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  required
                  minLength={8}
                  placeholder=" "
                />
                <button
                  type="button"
                  className="pw-input__toggle"
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                  onClick={() => setShowNew((v) => !v)}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className={`login-field float-field${confirmPassword ? ' is-filled' : ''}`}>
              <span>Confirm new password</span>
              <div className="pw-input">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder=" "
                />
                <button
                  type="button"
                  className="pw-input__toggle"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {error && <div className="alert-item login-error">{error}</div>}
            {ok && (
              <div className="alert-item" style={{ color: 'var(--ok)' }}>
                <Check size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                {ok}
              </div>
            )}

            <button className={`btn${busy ? ' action-morph is-busy' : ''}`} type="submit" disabled={busy}>
              {busy ? 'Saving…' : recoveryOnly ? 'Save new password' : 'Update password'}
            </button>
          </form>
        )}
      </MotionCard>
      </motion.div>
      )}
      </AnimatePresence>
    </>
  )
}
