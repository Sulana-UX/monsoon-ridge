import { useState } from 'react'
import { MailCheck, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { friendlyError } from '../lib/firebase'

export default function VerifyEmailNotice() {
  const { user, resendVerification, refreshUser, logout } = useAuth()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const check = async () => {
    setBusy(true)
    const u = await refreshUser().catch(() => null)
    setBusy(false)
    if (!u?.emailVerified) setMsg('Not verified yet. Please click the link in the email, then try again.')
  }

  const resend = async () => {
    setBusy(true)
    try {
      await resendVerification()
      setMsg('Verification email sent again. Check your inbox and spam folder.')
    } catch (e) {
      setMsg(friendlyError(e))
    }
    setBusy(false)
  }

  return (
    <section className="section auth-page">
      <div className="auth-card">
        <div className="auth-icon"><MailCheck size={30} /></div>
        <h1>Verify your email</h1>
        <p className="muted">
          We sent a link to <strong>{user.email}</strong>. Please open it to confirm your email,
          then come back here.
        </p>
        {msg && <p className="auth-msg">{msg}</p>}
        <button className="btn btn-gold btn-block" onClick={check} disabled={busy}>
          <RefreshCw size={16} /> I've verified, continue
        </button>
        <div className="auth-links">
          <button className="text-btn" onClick={resend} disabled={busy}>Resend email</button>
          <button className="text-btn" onClick={logout}>Use a different account</button>
        </div>
      </div>
    </section>
  )
}
