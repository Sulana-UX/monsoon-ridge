import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { EyeOff, Eye, MessageSquareReply, Pencil, Trash2, ExternalLink, MessageSquareQuote, Send, X } from 'lucide-react'
import { useAllReviews, summarize, stayMonth } from '../../lib/reviews'
import { api, friendlyError } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { useDialog } from '../../components/Dialog'
import { Stars } from '../../components/Stars'

const FILTERS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'reply', label: 'Needs a reply', test: (r) => !r.reply?.text && r.status === 'published' },
  { key: 'low', label: '1–3 stars', test: (r) => r.rating <= 3 },
  { key: 'hidden', label: 'Hidden', test: (r) => r.status === 'hidden' },
]
const day = (d) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'just now')

export default function Reviews() {
  const { rooms } = useOutletContext()
  const { reviews, loading, error } = useAllReviews()
  const [filter, setFilter] = useState('all')
  const [room, setRoom] = useState('')

  const published = useMemo(() => reviews.filter((r) => r.status === 'published'), [reviews])
  const sum = summarize(room ? published.filter((r) => r.roomId === room) : published)
  const scoped = room ? reviews.filter((r) => r.roomId === room) : reviews
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, scoped.filter(f.test).length]))
  const list = scoped.filter(FILTERS.find((f) => f.key === filter).test)
  const fiveStar = sum.count ? Math.round((sum.bars[0].n / sum.count) * 100) : 0

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow">Guests</span>
          <h1>Reviews</h1>
          <p>Reviews from guests who stayed. Each guest gets a review link by email when they check out.</p>
        </div>
        <select className="admin-select" value={room} onChange={(e) => setRoom(e.target.value)} aria-label="Room">
          <option value="">All rooms</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {error ? (
        <div className="empty"><h3>Couldn't load reviews</h3><p className="muted">Deploy the latest database rules and indexes (firebase deploy --only firestore), then refresh.</p></div>
      ) : loading ? (
        <div className="page-loading"><span className="spinner" /></div>
      ) : (
        <>
          <div className="hk-summary rv-admin-summary">
            <div><strong>{sum.avg?.toFixed(1) ?? '–'}</strong><span>{sum.avg ? <Stars value={sum.avg} size={13} /> : 'Average rating'}</span></div>
            <div><strong>{sum.count}</strong><span>On the website</span></div>
            <div><strong>{fiveStar}%</strong><span>5-star reviews</span></div>
            <div className={counts.reply ? 'is-warn' : ''}><strong>{counts.reply}</strong><span>Waiting for a reply</span></div>
          </div>

          <div className="admin-filters" role="tablist" aria-label="Show">
            {FILTERS.map((f) => (
              <button key={f.key} role="tab" aria-selected={filter === f.key} className={`chip ${filter === f.key ? 'is-active' : ''}`} onClick={() => setFilter(f.key)}>
                {f.label}{counts[f.key] > 0 && <span className="chip-count">{counts[f.key]}</span>}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <p className="today-empty"><MessageSquareQuote size={16} /> {reviews.length === 0 ? 'No reviews yet. They arrive after guests check out.' : 'No reviews here.'}</p>
          ) : (
            <ul className="rv-admin-list">
              {list.map((r) => <ReviewRow key={r.id} review={r} />)}
            </ul>
          )}
        </>
      )}
    </>
  )
}

function ReviewRow({ review: r }) {
  const { isManager } = useAuth()
  const dialog = useDialog()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(r.reply?.text || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const run = async (fn) => {
    setBusy(true)
    setErr('')
    try { await fn(); return true } catch (e) { setErr(friendlyError(e)); return false } finally { setBusy(false) }
  }
  const saveReply = async (e) => {
    e.preventDefault()
    if (await run(() => api.replyReview(r.id, text.trim()))) setEditing(false)
  }
  const removeReply = async () => {
    if (await dialog.confirm({ title: 'Remove your reply?', message: 'It disappears from the website.', confirmLabel: 'Remove reply', danger: true })) run(() => api.replyReview(r.id, ''))
  }
  const toggle = async () => {
    const hide = r.status === 'published'
    const ok = await dialog.confirm(hide
      ? { title: 'Hide this review?', message: `${r.name}'s ${r.rating}★ review is removed from the website and the room rating. Hide only reviews that break the rules (abuse, personal details, spam), not bad ones.`, confirmLabel: 'Hide review', danger: true }
      : { title: 'Show this review again?', message: 'It goes back on the website and counts in the room rating.', confirmLabel: 'Show review' })
    if (ok) run(() => api.setReviewStatus(r.id, hide ? 'hidden' : 'published'))
  }

  return (
    <li className={`admin-card rv-admin ${r.status === 'hidden' ? 'is-hidden' : ''} ${r.rating <= 2 ? 'is-low' : ''}`}>
      <header>
        <Stars value={r.rating} size={16} />
        <strong>{r.name}</strong>
        <span className="muted small">{r.roomName} · stayed {stayMonth(r.stayMonth)} · {day(r.createdAt)}</span>
        {r.status === 'hidden' && <span className="status status--out"><EyeOff size={12} /> Hidden</span>}
        <Link to={`/admin/bookings/${r.ref}`} className="rv-admin-ref">{r.ref} <ExternalLink size={12} /></Link>
      </header>
      {r.title && <strong className="rv-title">{r.title}</strong>}
      <p className="rv-admin-text">{r.text}</p>

      {editing ? (
        <form className="rv-admin-replyform" onSubmit={saveReply}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} autoFocus disabled={busy}
            placeholder={`Thank ${r.name.split(' ')[0]} for staying, and answer anything they raised. Shown publicly under the review.`} />
          <div className="rv-admin-actions">
            <button type="submit" className="btn btn-gold btn-sm" disabled={busy || !text.trim()}>{busy ? <span className="spinner spinner--sm" /> : <Send size={14} />} Post reply</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditing(false); setText(r.reply?.text || ''); setErr('') }}><X size={14} /> Cancel</button>
          </div>
        </form>
      ) : r.reply?.text ? (
        <div className="rv-reply">
          <strong>Your response <small className="muted">· {day(r.reply.at)}</small></strong>
          <p>{r.reply.text}</p>
        </div>
      ) : null}

      {err && <p className="auth-msg auth-msg--err" role="alert">{err}</p>}
      {!editing && (
        <div className="rv-admin-actions">
          {r.reply?.text ? (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)} disabled={busy}><Pencil size={14} /> Edit reply</button>
              <button className="btn btn-outline btn-sm" onClick={removeReply} disabled={busy}><Trash2 size={14} /> Remove reply</button>
            </>
          ) : (
            <button className="btn btn-gold btn-sm" onClick={() => setEditing(true)} disabled={busy}><MessageSquareReply size={14} /> Reply publicly</button>
          )}
          {isManager && (
            <button className="btn btn-outline btn-sm rv-admin-hide" onClick={toggle} disabled={busy}>
              {r.status === 'hidden' ? <><Eye size={14} /> Show on website</> : <><EyeOff size={14} /> Hide</>}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

