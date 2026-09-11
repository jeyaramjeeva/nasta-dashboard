import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, Fingerprint, LogIn, WifiOff } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { springSoft } from '../lib/motion'
import { AmbientBackground } from '../components/AmbientBackground'
import { PinInput } from '../components/PinInput'
import { useAuth } from '../context/AuthContext'
import { getAllowedUsers, isDeveloperEmail } from '../lib/authAllowlist'
import { isGuestEmail, isGuestName } from '../lib/guestAuth'
import {
  biometricAvailable,
  biometricLabel,
  unlockWithBiometric,
} from '../lib/loginBiometric'
import {
  germanyHeuteLine,
  greetingsForNow,
  welcomeLineForPerson,
} from '../lib/loginGreetings'
import { resolveOpenTodayStrip } from '../lib/loginOpenToday'
import { getSupabase } from '../lib/supabase'
import {
  accountKeyFor,
  accountPinHint,
  clearPinEnrollPending,
  fetchAccountHasPin,
  hasLocalLoginPin,
  isPinSkipped,
  setPinEnrollPending,
  unlockAccountWithPin,
} from '../lib/loginPin'
import { getLastLoginPerson, setLastLoginPerson } from '../lib/loginPrefs'
import { isNativeApp } from '../lib/nativeShell'
import { PASSWORD_HELP_EMAIL } from '../lib/passwordHelp'
import { loadLocalSiteConfig } from '../lib/siteConfig'

const PEOPLE = [
  { name: 'Jeeva', chip: '#c45c26' },
  { name: 'Sriram', chip: '#2f7a45' },
  { name: 'Sneha', chip: '#b8860b' },
  { name: 'Guest', chip: '#6b7280' },
  { name: 'Developer', chip: '#4a5568' },
] as const

export function Login() {
  const { cloudAuth, signInWithPassword, signInLocal, requestPasswordReset } = useAuth()
  const allowed = getAllowedUsers()
  const brand = loadLocalSiteConfig().text

  const initialName = (() => {
    const last = getLastLoginPerson()
    if (last && PEOPLE.some((p) => p.name === last)) return last
    return allowed[0]?.name || 'Sriram'
  })()

  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(
    () => allowed.find((u) => u.name === initialName)?.email ?? allowed[0]?.email ?? '',
  )
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [accountHasPin, setAccountHasPin] = useState<boolean | null>(() =>
    accountPinHint(
      accountKeyFor({
        cloud: cloudAuth,
        email: allowed.find((u) => u.name === initialName)?.email ?? '',
        name: initialName,
      }),
    ),
  )
  const [pinLookup, setPinLookup] = useState(() => accountHasPin === null)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [forgotBusy, setForgotBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [online, setOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine,
  )
  const [greetIdx, setGreetIdx] = useState(0)
  const [openToday, setOpenToday] = useState<string | null>(null)
  const [bioOk, setBioOk] = useState(false)
  const [bioLabel, setBioLabel] = useState('Biometrics')
  const [heute, setHeute] = useState(() => germanyHeuteLine())
  const [welcome, setWelcome] = useState(() => welcomeLineForPerson(initialName))

  const greetings = useMemo(() => greetingsForNow(), [])
  const greet = greetings[greetIdx % greetings.length]!

  useEffect(() => {
    setWelcome(welcomeLineForPerson(name))
  }, [name])

  const accountKey = accountKeyFor({ cloud: cloudAuth, email, name })
  const pickingGuest = cloudAuth ? isGuestEmail(email) : isGuestName(name)
  const pickingDeveloper = cloudAuth
    ? isDeveloperEmail(email)
    : name.trim().toLowerCase() === 'developer'
  const pinReady = accountHasPin === true && !usePassword
  const pinChecking = accountHasPin === null && !usePassword && !pickingGuest
  const showPinField = !usePassword && (pinReady || pinChecking)

  useEffect(() => {
    let cancelled = false
    const hint = accountPinHint(accountKey)
    setAccountHasPin(hint)
    setPinLookup(hint === null)
    void fetchAccountHasPin(accountKey).then((has) => {
      if (cancelled) return
      if (has === true) setAccountHasPin(true)
      else if (has === false) setAccountHasPin(false)
      else if (hint !== null) setAccountHasPin(hint)
      else setAccountHasPin(hasLocalLoginPin(accountKey) || !pickingGuest)
      setPinLookup(false)
    })
    return () => {
      cancelled = true
    }
  }, [accountKey, pickingGuest])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    const t = window.setInterval(() => setGreetIdx((i) => i + 1), 4000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const t = window.setInterval(() => setHeute(germanyHeuteLine()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    void resolveOpenTodayStrip().then(setOpenToday)
  }, [])

  useEffect(() => {
    void (async () => {
      const ok = await biometricAvailable()
      setBioOk(ok)
      if (ok) setBioLabel(await biometricLabel())
    })()
  }, [])

  useEffect(() => {
    setPin('')
    setPassword('')
    setUsePassword(false)
    setError(null)
  }, [accountKey])

  function selectPerson(personName: string) {
    setName(personName)
    const hit = allowed.find((u) => u.name === personName)
    if (hit) setEmail(hit.email)
  }

  async function signInWithSecret(secret: string) {
    if (cloudAuth) await signInWithPassword(email, secret)
    else await signInLocal(name, secret)
    setLastLoginPerson(name)
  }

  async function finishPinUnlock(
    unlocked: { password?: string; access_token?: string; refresh_token?: string },
  ) {
    if (unlocked.access_token && unlocked.refresh_token) {
      const sb = getSupabase()
      if (!sb) throw new Error('Cloud login is not configured.')
      const { error } = await sb.auth.setSession({
        access_token: unlocked.access_token,
        refresh_token: unlocked.refresh_token,
      })
      if (error) throw error
      setLastLoginPerson(name)
      return
    }
    if (unlocked.password) {
      await signInWithSecret(unlocked.password)
      return
    }
    throw new Error('Wrong PIN.')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (pinReady) {
        const unlocked = await unlockAccountWithPin(accountKey, pin)
        await finishPinUnlock(unlocked)
      } else {
        const hasPin = await fetchAccountHasPin(accountKey)
        if (hasPin !== true && !isPinSkipped(accountKey)) {
          setPinEnrollPending({
            accountKey,
            name,
            password,
            cloud: cloudAuth,
            email,
          })
        }
        try {
          await signInWithSecret(password)
        } catch (err) {
          clearPinEnrollPending()
          throw err
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  async function onBiometric() {
    setError(null)
    setBusy(true)
    try {
      const unlocked = await unlockWithBiometric()
      if (!unlocked) {
        setError(`${bioLabel} cancelled or unavailable.`)
        return
      }
      const match = allowed.find(
        (u) =>
          accountKeyFor({ cloud: cloudAuth, email: u.email, name: u.name }) ===
          unlocked.accountKey,
      )
      if (match) {
        setName(match.name)
        setEmail(match.email)
      }
      const key = unlocked.accountKey
      let secret = unlocked.secret
      if ((hasLocalLoginPin(key) || accountHasPin) && /^\d{4}$/.test(secret)) {
        const pinUnlock = await unlockAccountWithPin(key, secret)
        if (pinUnlock.access_token && pinUnlock.refresh_token && cloudAuth) {
          await finishPinUnlock(pinUnlock)
          return
        }
        if (!pinUnlock.password) throw new Error('Wrong PIN.')
        secret = pinUnlock.password
      }
      if (cloudAuth) {
        const em =
          match?.email ||
          allowed.find((u) => accountKeyFor({ cloud: true, email: u.email, name: u.name }) === key)
            ?.email
        if (!em) throw new Error('Saved biometric account not found.')
        await signInWithPassword(em, secret)
        setLastLoginPerson(match?.name || name)
      } else {
        const nm =
          match?.name ||
          (key.startsWith('local:') ? key.slice(6) : name)
        await signInLocal(nm, secret)
        setLastLoginPerson(nm)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  async function onForgotPassword() {
    setError(null)
    setInfo(null)
    if (pickingGuest) {
      setInfo(`Ask Jeeva to reset the Guest password (email ${PASSWORD_HELP_EMAIL}).`)
      return
    }
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

  const showTabletTip =
    isNativeApp() ||
    (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px) and (pointer: coarse)').matches)

  return (
    <>
      <AmbientBackground />
      <div className="login-page">
      <div className="login-shell">
        {!online && (
          <div className="login-offline" role="status">
            <WifiOff size={16} />
            You’re offline — local sign-in still works
          </div>
        )}

        {openToday && (
          <div className="login-open-today" role="status">
            <span className="login-live-dot" />
            {openToday}
          </div>
        )}

        <form className="login-card glass-card login-card--wide" onSubmit={(e) => void onSubmit(e)}>
          <img
            className="login-logo"
            src="/nasta-logo.png"
            alt=""
            width={72}
            height={72}
          />
          <p className="login-greet" key={greet.lang} lang={greet.lang}>
            {greet.text}
          </p>
          <h1 className="login-wordmark">{brand.brandName || 'Nasta Zentrum'}</h1>
          <p className="login-welcome">{welcome}</p>

          <div className="login-people" role="listbox" aria-label="Who are you?">
            {PEOPLE.map((p) => {
              const selected = name === p.name
              return (
                <button
                  key={p.name}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`login-person${selected ? ' is-selected' : ''}`}
                  onClick={() => selectPerson(p.name)}
                >
                  <span className="login-person__chip" style={{ background: p.chip }}>
                    {p.name.slice(0, 1)}
                  </span>
                  <span className="login-person__name">{p.name}</span>
                </button>
              )
            })}
          </div>

          <AnimatePresence mode="wait" initial={false}>
          {showPinField ? (
            <motion.label
              key="pin"
              className="login-field"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={springSoft}
            >
              <span>PIN</span>
              <PinInput
                value={pin}
                onChange={setPin}
                required={!pinChecking}
                autoFocus={!pinChecking}
              />
              {!pinChecking && (
                <button
                  type="button"
                  className="login-forgot"
                  style={{ alignSelf: 'flex-start', marginTop: 6 }}
                  onClick={() => setUsePassword(true)}
                >
                  Use password instead
                </button>
              )}
            </motion.label>
          ) : (
            <motion.label
              key="pw"
              className={`login-field float-field${password ? ' is-filled' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={springSoft}
            >
              <span>
                {pickingGuest
                  ? 'Guest password'
                  : pickingDeveloper || !cloudAuth
                    ? 'Team password'
                    : 'Password'}
              </span>
              <div className="pw-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder=" "
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
              {accountHasPin === true && usePassword && (
                <button
                  type="button"
                  className="login-forgot"
                  style={{ alignSelf: 'flex-start', marginTop: 6 }}
                  onClick={() => setUsePassword(false)}
                >
                  Use PIN instead
                </button>
              )}
            </motion.label>
          )}
          </AnimatePresence>

          {!showPinField && (
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
          )}

          {error && <div className="alert-item login-error">{error}</div>}
          {info && <div className="alert-item login-info">{info}</div>}

          <button
            className={`btn login-submit${busy || pinChecking ? ' action-morph is-busy' : ''}`}
            type="submit"
            disabled={busy || pinChecking}
          >
            <LogIn size={16} />
            {busy
              ? 'Signing in…'
              : pinChecking || pinLookup
                ? 'Checking…'
                : pinReady
                  ? 'Unlock with PIN'
                  : 'Sign in'}
          </button>

          {bioOk && (
            <button
              type="button"
              className="btn ghost login-bio"
              disabled={busy}
              onClick={() => void onBiometric()}
            >
              <Fingerprint size={16} />
              {bioLabel}
            </button>
          )}

          {showTabletTip && (
            <p className="login-orient-tip">
              Tip: lock tablet orientation in system settings so the stall screen doesn’t rotate mid-order.
            </p>
          )}
        </form>

        <p className="login-heute">{heute}</p>
      </div>
      </div>
    </>
  )
}
