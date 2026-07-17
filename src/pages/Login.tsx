import { LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { getAllowedUsers } from '../lib/authAllowlist'
import { useAuth } from '../context/AuthContext'
import { AmbientBackground } from '../components/AmbientBackground'

export function Login() {
  const { cloudAuth, signInWithPassword, signInLocal } = useAuth()
  const allowed = getAllowedUsers()

  const [email, setEmail] = useState(allowed[0]?.email ?? '')
  const [name, setName] = useState('Jeeva')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
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
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder={cloudAuth ? 'Your account password' : 'Team password'}
            />
          </label>

          {error && <div className="alert-item login-error">{error}</div>}

          <button className="btn login-submit" type="submit" disabled={busy}>
            <LogIn size={16} />
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="hint-inline login-foot">
            {cloudAuth
              ? 'Accounts are created by Jeeva in Supabase. Unknown emails are blocked.'
              : 'Add VITE_SUPABASE_URL + anon key on Vercel for real email login & activity logs.'}
          </p>
        </form>
      </div>
    </>
  )
}
