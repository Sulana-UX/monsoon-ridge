import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import {
  ChevronLeft, Printer, Mail, Phone, Globe, Clock, Users, CalendarDays, BedDouble, CreditCard,
  MessageSquare, StickyNote, Trash2, Send, CheckCircle2, XCircle, LogIn, LogOut, UserX, PlusCircle, MailCheck, MailWarning, History, DoorOpen, Star,
} from 'lucide-react'
import { useActivityFor, useBookingNotes } from '../../lib/bookings'
import { api, friendlyError } from '../../lib/firebase'
import { statusClass, statusLabel, guestName } from '../../lib/status'
import { prettyDate } from '../../utils'
import { Person } from './Avatar'
import PriceLines from '../../components/PriceLines'
import FrontDeskButtons, { UnitSelect } from './FrontDesk'
import { useDialog } from '../../components/Dialog'

const when = (d) => (d ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

export default function BookingDetails() {
  const { ref } = useParams()
  const { bookings } = useOutletContext()
  const b = bookings.find((x) => x.ref === ref)
  const dialog = useDialog()
  const [mailBusy, setMailBusy] = useState(false)
  const [mailMsg, setMailMsg] = useState(null)

  if (!b) {
    return (
      <div className="empty">
        <h3>Booking {ref} not found</h3>
        <Link to="/admin/bookings" className="btn btn-outline">Back to bookings</Link>
      </div>
    )
  }

  const p = b.price || { rate: b.total / b.nights, nights: b.nights, subtotal: b.total, service: 0, tax: 0, total: b.total }

  // Status history, oldest first
  const timeline = [
    {
      icon: PlusCircle,
      label: b.source === 'phone' ? 'Phone booking by staff' : b.source === 'walk-in' ? 'Walk-in booking by staff' : 'Booked online',
      at: b.createdAt, by: b.createdBy || b.accountEmail,
    },
    b.checkedInAt && { icon: LogIn, label: 'Checked in', at: b.checkedInAt },
    b.checkedOutAt && { icon: LogOut, label: b.checkOutActual && b.checkOutActual < b.checkOut ? `Checked out early (${prettyDate(b.checkOutActual)})` : 'Checked out', at: b.checkedOutAt },
    b.noShowAt && { icon: UserX, label: 'Marked as no-show', at: b.noShowAt },
    b.cancelledAt && { icon: XCircle, label: `Cancelled by ${b.cancelledBy || 'guest'}`, at: b.cancelledAt },
    b.review && { icon: Star, label: `Guest left a ${b.review.rating}★ review`, at: b.review.at?.toDate?.() ?? b.review.at },
    ...['confirmation', 'cancellation', 'review'].map((k) => {
      const e = b.emails?.[k]
      if (!e || e.status === 'skipped') return null
      return { icon: e.status === 'sent' ? MailCheck : MailWarning, label: `${{ confirmation: 'Confirmation', cancellation: 'Cancellation', review: 'Review request' }[k]} email ${e.status === 'sent' ? 'sent' : 'failed'}`, at: e.at?.toDate?.() ?? e.at, by: e.status === 'sent' ? b.guest?.email : e.error }
    }),
  ].filter(Boolean).sort((x, y) => (x.at?.getTime?.() ?? 0) - (y.at?.getTime?.() ?? 0))

  const resend = async () => {
    setMailBusy(true)
    setMailMsg(null)
    try {
      await api.resendConfirmation(b.ref)
      setMailMsg({ ok: true, text: `Confirmation sent to ${b.guest.email}.` })
    } catch (e) {
      setMailMsg({ ok: false, text: friendlyError(e) })
    }
    setMailBusy(false)
  }

  const askReview = async () => {
    setMailBusy(true)
    setMailMsg(null)
    try {
      await api.sendReviewInvite(b.ref)
      setMailMsg({ ok: true, text: `Review link sent to ${b.guest.email}.` })
    } catch (e) {
      setMailMsg({ ok: false, text: friendlyError(e) })
    }
    setMailBusy(false)
  }

  const cancel = async () => {
    if (!(await dialog.confirm({ title: `Cancel ${b.ref}?`, message: `${guestName(b)}, ${b.roomName}. The rooms go back on sale and the guest sees it as cancelled by the hotel.`, confirmLabel: 'Cancel booking', cancelLabel: 'Keep booking', danger: true }))) return
    try {
      await api.cancelBooking({ ref: b.ref })
    } catch (e) {
      dialog.alert({ title: "Couldn't cancel", message: friendlyError(e) })
    }
  }

  return (
    <div className="booking-details">
      <Link to="/admin/bookings" className="back-link no-print"><ChevronLeft size={16} /> All bookings</Link>

      <div className="admin-head">
        <div>
          <span className="eyebrow">Booking</span>
          <h1 className="mono-title">{b.ref}</h1>
          <p>Booked {when(b.createdAt)}</p>
        </div>
        <div className="bd-head-actions no-print">
          <span className={statusClass(b.status)}>{statusLabel(b.status)}</span>
          <button className="btn btn-outline btn-sm" onClick={() => window.print()}><Printer size={16} /> Print</button>
        </div>
      </div>

      <div className="bd-actionbar no-print">
        <FrontDeskButtons booking={b} />
        {b.status === 'Confirmed' && (
          <button className="fd-btn fd-btn--ghost bd-cancel" onClick={cancel}><XCircle size={16} /> Cancel booking</button>
        )}
      </div>

      <div className="admin-grid">
        <section className="admin-card admin-card--7">
          <h3 className="bd-title">Guest</h3>
          <Person name={guestName(b)} detail={b.guest?.country} />
          <ul className="bd-list">
            {b.guest?.email && <li><Mail size={16} /> <a href={`mailto:${b.guest.email}`}>{b.guest.email}</a></li>}
            <li><Phone size={16} /> <a href={`tel:${(b.guest?.phone || '').replace(/[^\d+]/g, '')}`}>{b.guest?.phone}</a></li>
            <li><Globe size={16} /> {b.guest?.country}</li>
            {b.guest?.arrival && <li><Clock size={16} /> Expected arrival {b.guest.arrival}</li>}
            {b.accountEmail && b.accountEmail !== b.guest?.email && <li className="muted small">Booked from account {b.accountEmail}</li>}
          </ul>
          {b.guest?.requests && (
            <div className="bd-requests">
              <MessageSquare size={16} />
              <div><strong>Special requests</strong><p>{b.guest.requests}</p></div>
            </div>
          )}
        </section>

        <section className="admin-card admin-card--5">
          <h3 className="bd-title">Stay</h3>
          <div className="bd-room" style={{ backgroundImage: b.image ? `url(${b.image})` : undefined }}>
            <span>{b.roomName}</span>
          </div>
          <ul className="bd-list">
            <li><CalendarDays size={16} /> {prettyDate(b.checkIn)} → {prettyDate(b.checkOut)}</li>
            <li><BedDouble size={16} /> {b.nights} night{b.nights === 1 ? '' : 's'}</li>
            <RoomNumber b={b} />
            <li><Users size={16} /> {b.guests} guest{b.guests === 1 ? '' : 's'}</li>
            <li><CreditCard size={16} /> {b.payment === 'card' ? 'Card' : 'Pay at hotel'}</li>
          </ul>
        </section>

        <section className="admin-card admin-card--7">
          <h3 className="bd-title">Price</h3>
          <PriceLines price={p} className="price-lines bd-price" />
          <p className="muted small">Price locked at the time of booking.</p>
        </section>

        <section className="admin-card admin-card--5">
          <h3 className="bd-title">History</h3>
          <ol className="bd-timeline">
            {timeline.map((e, i) => (
              <li key={i}>
                <span className="bd-dot"><e.icon size={14} /></span>
                <div><strong>{e.label}</strong><small>{when(e.at)}{e.by ? ` · ${e.by}` : ''}</small></div>
              </li>
            ))}
            {b.statusBy && <li className="bd-by"><CheckCircle2 size={14} /> Last front-desk change by {b.statusBy}</li>}
          </ol>
          {b.guest?.email && b.status !== 'Cancelled' && (
            <div className="bd-mail no-print">
              <button className="btn btn-outline btn-sm" onClick={resend} disabled={mailBusy}>
                {mailBusy ? <span className="spinner spinner--sm" /> : <Mail size={15} />} {b.emails?.confirmation?.status === 'sent' ? 'Resend confirmation email' : 'Send confirmation email'}
              </button>
              {b.status === 'CheckedOut' && !b.review && (
                <button className="btn btn-outline btn-sm" onClick={askReview} disabled={mailBusy}>
                  <Star size={15} /> {b.emails?.review?.status === 'sent' ? 'Send review link again' : 'Ask for a review'}
                </button>
              )}
              {b.review && <Link to="/admin/reviews" className="btn btn-outline btn-sm"><Star size={15} fill="currentColor" /> Rated {b.review.rating}/5 · see review</Link>}
              {mailMsg && <p className={`auth-msg ${mailMsg.ok ? '' : 'auth-msg--err'}`} role="status">{mailMsg.text}</p>}
            </div>
          )}
        </section>

        <BookingActivity refId={b.ref} />
        <Notes refId={b.ref} />
      </div>
    </div>
  )
}

/** Room number: show it, and let staff assign / change it for upcoming or current stays. */
function RoomNumber({ b }) {
  const { units = [] } = useOutletContext()
  const [editing, setEditing] = useState(false)
  const [unit, setUnit] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const hasNumbers = units.some((u) => u.roomId === b.roomId)
  const live = b.status === 'Confirmed' || b.status === 'CheckedIn'
  if (!hasNumbers && !b.unit) return null

  const save = async (value) => {
    setBusy(true)
    setErr('')
    try {
      await api.assignRoom(b.ref, value || null)
      setEditing(false)
      setUnit('')
    } catch (e) {
      setErr(friendlyError(e))
    }
    setBusy(false)
  }

  return (
    <li className="bd-unit">
      <DoorOpen size={16} />
      {editing ? (
        <span className="bd-unit-edit no-print">
          <UnitSelect booking={b} value={unit} onChange={setUnit} />
          <button className="btn btn-gold btn-sm" disabled={!unit || busy} onClick={() => save(unit)}>Save</button>
          <button className="text-btn" onClick={() => setEditing(false)}>Cancel</button>
        </span>
      ) : (
        <span>
          {b.unit ? <strong>Room {b.unit}</strong> : <span className="muted">No room number yet</span>}
          {live && (
            <span className="no-print">
              {' · '}<button className="text-btn" onClick={() => setEditing(true)}>{b.unit ? 'Change' : 'Assign room'}</button>
              {b.unit && b.status === 'Confirmed' && <>{' · '}<button className="text-btn" disabled={busy} onClick={() => save(null)}>Remove</button></>}
            </span>
          )}
        </span>
      )}
      {err && <small className="fd-err">{err}</small>}
    </li>
  )
}

/** Everything the activity log recorded for this booking (who cancelled, checked in, …). */
function BookingActivity({ refId }) {
  const { entries, error } = useActivityFor(refId)
  if (error || entries.length === 0) return null
  return (
    <section className="admin-card admin-card--wide no-print">
      <div className="admin-card-head">
        <div>
          <h3><History size={18} /> Activity</h3>
          <p className="muted small">From the activity log. Can't be edited.</p>
        </div>
        <Link to="/admin/activity" className="link-arrow">Full log</Link>
      </div>
      <ol className="activity-list activity-list--compact">
        {entries.map((e) => (
          <li key={e.id} className="activity-row">
            <div className="activity-main">
              <p>{e.summary}</p>
              <small>{e.role === 'guest' ? 'Guest' : 'Staff'} · {e.by}</small>
            </div>
            <time>{when(e.at)}</time>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Notes({ refId }) {
  const dialog = useDialog()
  const { notes, loading, error } = useBookingNotes(refId)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const add = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setErr('')
    try {
      await api.addNote(refId, text.trim())
      setText('')
    } catch (e2) {
      setErr(friendlyError(e2))
    }
    setBusy(false)
  }

  const remove = async (id) => {
    if (!(await dialog.confirm({ title: 'Delete this note?', message: 'Other staff will no longer see it.', confirmLabel: 'Delete note', danger: true }))) return
    try {
      await api.deleteNote(refId, id)
    } catch (e) {
      setErr(friendlyError(e))
    }
  }

  return (
    <section className="admin-card admin-card--wide bd-notes">
      <div className="admin-card-head">
        <div>
          <h3><StickyNote size={18} /> Staff notes</h3>
          <p className="muted small">Only staff can see these. The guest never does.</p>
        </div>
      </div>
      <form className="bd-note-form no-print" onSubmit={add}>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000}
          placeholder="e.g. VIP guest, wants extra pillows. Airport pickup at 2 pm." />
        <button className="btn btn-gold btn-sm" disabled={busy || !text.trim()}>
          {busy ? <span className="spinner spinner--sm" /> : <Send size={15} />} Add note
        </button>
      </form>
      {err && <p className="auth-msg auth-msg--err">{err}</p>}
      {loading ? <p className="muted small">Loading notes…</p>
        : error ? <p className="muted small">Couldn't load notes. Make sure the latest database rules are deployed.</p>
        : notes.length === 0 ? <p className="muted small">No notes yet.</p>
        : (
          <ul className="bd-note-list">
            {notes.map((n) => (
              <li key={n.id}>
                <p>{n.text}</p>
                <small>{n.by} · {when(n.at) || 'just now'}</small>
                <button className="icon-btn no-print" title="Delete note" onClick={() => remove(n.id)}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
    </section>
  )
}
