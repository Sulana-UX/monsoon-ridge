import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, ArrowRight, MessageSquareHeart, LockKeyhole } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { StarPicker, Stars } from '../components/Stars'
import { useAuth } from '../context/AuthContext'
import { api, friendlyError } from '../lib/firebase'
import { images } from '../data/rooms'
import { prettyDate } from '../utils'

/**
 * /review/:ref?t=<token>  — the link from the "How was your stay?" email (no account needed),
 * or /review/:ref from My Bookings while signed in.
 */
export default function Review() {
  const { ref } = useParams()
  const [params] = useSearchParams()
  const token = params.get('t') || ''
  const { user, loading: authLoading } = useAuth()
  const [stay, setStay] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [form, setForm] = useState({ rating: Number(params.get('r')) || 0, title: '', text: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (authLoading) return
    let live = true
    api.reviewStay(ref, token)
      .then((s) => live && setStay(s))
      .catch((e) => live && setLoadErr(friendlyError(e)))
    return () => { live = false }
  }, [ref, token, authLoading, user?.uid])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    if (!form.rating) return setErr('Choose a star rating first.')
    if (form.text.trim().length < 10) return setErr('Please write a few words about your stay (at least 10 characters).')
    setBusy(true)
    setErr('')
    try {
      await api.submitReview(ref, token, { rating: form.rating, title: form.title.trim(), text: form.text.trim() })
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e2) {
      setErr(friendlyError(e2))
    }
    setBusy(false)
  }

  let content
  if (loadErr) {
    content = (
      <div className="empty review-empty">
        <LockKeyhole size={40} />
        <h3>We couldn't open this review</h3>
        <p className="muted">{loadErr}</p>
        {!user && <Link to="/login" state={{ from: `/review/${ref}` }} className="btn btn-gold">Sign in <ArrowRight size={16} /></Link>}
      </div>
    )
  } else if (!stay) {
    content = <div className="page-loading"><span className="spinner" /></div>
  } else if (done || stay.review) {
    const r = done ? form : stay.review
    content = (
      <div className="review-done">
        <span className="review-done-icon"><CheckCircle2 size={34} /></span>
        <h2>{done ? `Thank you, ${stay.firstName || 'and safe travels'}!` : 'You already reviewed this stay'}</h2>
        <p className="muted">{done ? 'Your review is now on our website. It really helps other travellers, and our team reads every one.' : 'Thank you for telling us about it.'}</p>
        <figure className="review-card review-card--mine">
          <Stars value={r.rating} size={18} />
          {r.title && <strong>{r.title}</strong>}
          <blockquote>{r.text}</blockquote>
        </figure>
        <div className="review-done-actions">
          <Link to={`/rooms/${stay.roomId}`} className="btn btn-outline">See the {stay.roomName} <ArrowRight size={16} /></Link>
          <Link to="/" className="btn btn-gold">Back to home</Link>
        </div>
      </div>
    )
  } else if (stay.problem) {
    content = (
      <div className="empty review-empty">
        <CalendarDays size={40} />
        <h3>Not quite yet</h3>
        <p className="muted">{stay.problem}</p>
        <Link to="/" className="btn btn-gold">Back to home</Link>
      </div>
    )
  } else {
    content = (
      <form className="review-form" onSubmit={submit} noValidate>
        <div className="review-stay">
          {stay.image && <img src={stay.image} alt="" />}
          <div>
            <small className="muted">Your stay</small>
            <strong>{stay.roomName}</strong>
            <span className="muted"><CalendarDays size={14} /> {prettyDate(stay.checkIn)} → {prettyDate(stay.checkOut)}</span>
          </div>
        </div>

        <div className="review-q">
          <h2>{stay.firstName ? `${stay.firstName}, how` : 'How'} was your stay?</h2>
          <StarPicker value={form.rating} onChange={(rating) => { setForm((f) => ({ ...f, rating })); setErr('') }} disabled={busy} />
        </div>

        <label className="field">
          <span>Title <small className="muted">(optional)</small></span>
          <div className="input-wrap"><input value={form.title} onChange={set('title')} maxLength={80} placeholder="e.g. Peaceful and beautiful" disabled={busy} /></div>
        </label>
        <label className="field">
          <span>Your review</span>
          <textarea className="review-text" value={form.text} onChange={set('text')} rows={6} maxLength={2000} disabled={busy}
            placeholder="What did you enjoy? The room, the food, the staff… Anything we could do better?" />
          <small className="muted review-count">{form.text.trim().length}/2000</small>
        </label>

        {err && <p className="auth-msg auth-msg--err" role="alert">{err}</p>}
        <button type="submit" className="btn btn-gold btn-lg btn-block" disabled={busy}>
          {busy ? <span className="spinner spinner--sm" /> : <MessageSquareHeart size={18} />} Post my review
        </button>
        <p className="muted small review-privacy">Shown on our website with your first name and last initial. Your email is never shown.</p>
      </form>
    )
  }

  return (
    <>
      <PageHeader title="Your review" subtitle="Tell other travellers about your stay." image={images.resort || images.hero} />
      <section className="section">
        <div className="container review-wrap">{content}</div>
      </section>
    </>
  )
}
