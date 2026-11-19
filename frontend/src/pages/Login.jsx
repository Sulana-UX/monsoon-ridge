import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, KeyRound, ChevronLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { friendlyError } from '../lib/firebase'
import Logo from '../components/Logo'
import { images } from '../data/rooms'

// Only follow redirects inside this site (blocks //evil.com style open redirects)
const safePath = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : '/')

const passwordProblem = (p) => {
  if (p.length < 8) return 'At least 8 characters'
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use both letters and numbers'
  return ''
}

/** 0–4: length 8+, letters + numbers, upper + lower case, 12+ chars or a symbol */
const strength = (p) => !p ? 0 : [p.length >= 8, /[A-Za-z]/.test(p) && /\d/.test(p), /[a-z]/.test(p) && /[A-Z]/.test(p), p.length >= 12 || /[^A-Za-z0-9]/.test(p)].filter(Boolean).length
const STRENGTH = ['', 'Weak', 'Okay', 'Good', 'Strong']

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
)

export default function Login({ mode: initialMode = 'login' }) {
  const { user, isAdmin, loading, signIn, signUp, signInWithGoogle, resetPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = safePath(location.state?.from)

  const [mode, setMode] = useState(initialMode) // login | register | reset
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => setMode(initialMode), [initialMode])
  useEffect(() => {
    setError('')
    setInfo('')
  }, [mode])

  // Already signed in (or just signed in): go back to where they came from
  useEffect(() => {
    // Staff go straight to the dashboard; guests go back to where they were
    if (!loading && user) navigate(isAdmin ? '/admin' : from, { replace: true })
  }, [user, isAdmin, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(friendlyError(e))
    }
    setBusy(false)
  }

  const submit = (e) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('Please enter a valid email address.')

    if (mode === 'reset') {
      return run(async () => {
        await resetPassword(form.email)
        // Same message whether or not the account exists (no account probing)
        setInfo('If an account exists for this email, a reset link is on its way. Check your inbox and spam folder.')
      })
    }
    if (mode === 'register') {
      if (form.name.trim().length < 2) return setError('Please enter your name.')
      const p = passwordProblem(form.password)
      if (p) return setError(`Password: ${p.toLowerCase()}.`)
      return run(() => signUp(form.name, form.email, form.password))
    }
    if (!form.password) return setError('Please enter your password.')
    return run(() => signIn(form.email, form.password))
  }

  const titles = {
    login: ['Welcome back', 'Sign in to book rooms and manage your stays.'],
    register: ['Create your account', 'Book faster and see all your stays in one place.'],
    reset: ['Reset password', "Enter your email and we'll send you a reset link."],
  }

  const pw = strength(form.password)

  return (
    <section className="auth-full" style={{ backgroundImage: `url(${images.hero})` }}>
      <header className="auth-full-top">
        <Link to="/" aria-label="Monsoon Ridge home"><Logo light /></Link>
        <Link to="/" className="auth-full-back"><ChevronLeft size={16} /> Back to site</Link>
      </header>

      <div className="auth-glass">
        {mode === 'reset' && <div className="auth-icon auth-icon--sm"><KeyRound size={22} /></div>}
        <h1>{titles[mode][0]}</h1>
        <p className="auth-sub">{titles[mode][1]}</p>

        {mode !== 'reset' && (
          <>
            <button type="button" className="btn btn-google btn-block" disabled={busy} onClick={() => run(signInWithGoogle)}>
              <GoogleIcon /> Continue with Google
            </button>
            <div className="auth-divider"><span>or</span></div>
          </>
        )}

        <form onSubmit={submit} noValidate className="auth-form">
          {mode === 'register' && (
            <div className="input-wrap">
              <User size={17} />
              <input value={form.name} onChange={set('name')} autoComplete="name" maxLength={80} placeholder="Full name" aria-label="Full name" />
            </div>
          )}
          <div className="input-wrap">
            <Mail size={17} />
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" maxLength={254} placeholder="Email address" aria-label="Email address" />
          </div>
          {mode !== 'reset' && (
            <div>
              <div className="input-wrap">
                <Lock size={17} />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  maxLength={128}
                  placeholder={mode === 'register' ? 'Password (8+ characters)' : 'Password'}
                  aria-label="Password"
                />
                <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {mode === 'register' && form.password && (
                <div className={`pw-meter pw-meter--${pw}`} aria-live="polite">
                  <div className="pw-bars">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= pw ? 'on' : ''} />)}</div>
                  <small>{passwordProblem(form.password) || `${STRENGTH[pw]} password`}</small>
                </div>
              )}
              {mode === 'login' && <button type="button" className="text-btn auth-forgot" onClick={() => setMode('reset')}>Forgot password?</button>}
            </div>
          )}

          {error && <p className="auth-msg auth-msg--err" role="alert">{error}</p>}
          {info && <p className="auth-msg" role="status">{info}</p>}

          <button type="submit" className="btn btn-gold btn-block auth-submit" disabled={busy}>
            {busy ? <span className="spinner spinner--sm" /> : null}
            {mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'}
            {!busy && mode !== 'reset' && <ArrowRight size={17} />}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' && <>New here? <button className="text-btn" onClick={() => setMode('register')}>Create an account</button></>}
          {mode === 'register' && <>Have an account? <button className="text-btn" onClick={() => setMode('login')}>Sign in</button></>}
          {mode === 'reset' && <button className="text-btn" onClick={() => setMode('login')}>Back to sign in</button>}
        </p>
      </div>

      <p className="auth-full-foot">Monsoon Ridge Jungle Resort &amp; Spa · Ella, Sri Lanka</p>
    </section>
  )
}
