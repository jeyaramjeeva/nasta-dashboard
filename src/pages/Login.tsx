import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { AmbientBackground } from '../components/AmbientBackground'
import { useAuth } from '../context/AuthContext'
import { getAllowedUsers } from '../lib/authAllowlist'
import { PASSWORD_HELP_EMAIL } from '../lib/passwordHelp'

export function Login() {
  const { cloudAuth, signInWithPassword, signInLocal, requestPasswordReset } = useAuth()
  const allowed = getAllowedUsers()

  const [email, setEmail] = useState(allowed[0]?.email ?? '')
  const [name, setName] = useState('Jeeva')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [forgotBusy, setForgotBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (cloudAuth) await signInWithPassword(email, password)
      else await signInLocal(name, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  async function onForgotPassword() {
    setError(null)
    setInfo(null)
    setForgotBusy(true)
    try {
      const accountName = cloudAuth
        ? allowed.find((u) => u.email === email)?.name || 'Team member'
        : name
      const accountEmail = cloudAuth ? email : allowed.find((u) => u.name === name)?.email || ''
      await requestPasswordReset(accountName, accountEmail)
      setInfo(
        `Reset request sent to ${PASSWORD_HELP_EMAIL}. Jeeva will help you set a new password.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset request')
    } finally {
      setForgotBusy(false)
    }
  }

  return (
    <>
      <AmbientBackground />
      <div className="login-page">
        <form className="login-card glass-card" onSubmit={(e) => void onSubmit(e)}>
          <img
            className="login-logo"
            src="/nasta-logo.png"
            alt="Nasta Zentrum"
            width={64}
            height={64}
          />
          <h1>Nasta Zentrum</h1>
          <p className="hint-inline">
            Team login only — Jeeva, Sriram &amp; Sneha.
            {cloudAuth ? ' Sign in with your email.' : ' Local gate (Supabase not configured yet).'}
          </p>

          {cloudAuth ? (
            <label className="login-field">
              <span>Email</span>
              <select value={email} onChange={(e) => setEmail(e.target.value)} required>
                {allowed.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.name} — {u.email}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="login-field">
              <span>Who are you?</span>
              <select value={name} onChange={(e) => setName(e.target.value)} required>
                <option value="Jeeva">Jeeva</option>
                <option value="Sriram">Sriram</option>
                <option value="Sneha">Sneha</option>
              </select>
            </label>
          )}

          <label className="login-field">
            <span>{cloudAuth ? 'Password' : 'Team password'}</span>
            <div className="pw-input">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={cloudAuth ? 'Your account password' : 'Team password'}
              />
              <button
                type="button"
                className="pw-input__toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <div className="login-forgot-row">
            <button
              type="button"
              className="login-forgot"
              disabled={forgotBusy || busy}
              onClick={() => void onForgotPassword()}
            >
              {forgotBusy ? 'Sending…' : 'Forgot password?'}
            </button>
          </div>

          {error && <div className="alert-item login-error">{error}</div>}
          {info && <div className="alert-item login-info">{info}</div>}

          <button className="btn login-submit" type="submit" disabled={busy}>
            <LogIn size={16} />
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="hint-inline login-foot">
            Forgot password sends a reset request to {PASSWORD_HELP_EMAIL}.
          </p>
        </form>
      </div>
    </>
  )
}
