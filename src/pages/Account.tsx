import { Check, Eye, EyeOff, KeyRound, Settings } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { MotionCard } from '../components/MotionCard'
import { useAuth } from '../context/AuthContext'

export function Account() {
  const { user, cloudAuth, changePassword, setNewPassword, needsNewPassword, clearNeedsNewPassword } =
    useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPasswordValue] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const recoveryOnly = needsNewPassword

  useEffect(() => {
    if (ok) {
      const t = window.setTimeout(() => setOk(null), 4000)
      return () => window.clearTimeout(t)
    }
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
        setOk('Password updated. You’re all set.')
      } else {
        await changePassword(currentPassword, newPassword)
        setOk('Password changed successfully.')
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
      </MotionCard>

      <MotionCard interactive={false} className="upload-panel mt-card">
        <div className="card-head">
          <h2>
            <KeyRound size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
            {recoveryOnly ? 'Set a new password' : 'Change password'}
          </h2>
        </div>

        {!cloudAuth ? (
          <p className="hint-inline" style={{ marginTop: '0.65rem' }}>
            Local mode uses one shared team password. Ask Jeeva to change{' '}
            <code>VITE_UPLOAD_PASSWORD</code> on Vercel, or use cloud email login to manage your own
            password.
          </p>
        ) : (
          <form className="account-pw-form" onSubmit={(e) => void onSubmit(e)}>
            {recoveryOnly && (
              <p className="hint-inline">
                Choose a new password for your account, then continue using the app.
              </p>
            )}

            {!recoveryOnly && (
              <label className="login-field">
                <span>Current password</span>
                <div className="pw-input">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
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

            <label className="login-field">
              <span>New password</span>
              <div className="pw-input">
                <input
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
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

            <label className="login-field">
              <span>Confirm new password</span>
              <div className="pw-input">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
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

            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : recoveryOnly ? 'Save new password' : 'Update password'}
            </button>
          </form>
        )}
      </MotionCard>
    </>
  )
}
