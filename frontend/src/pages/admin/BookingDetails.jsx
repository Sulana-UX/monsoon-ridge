import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import {
  ChevronLeft, Printer, Mail, Phone, Globe, Clock, Users, CalendarDays, BedDouble, CreditCard,
  MessageSquare, StickyNote, Trash2, Send, CheckCircle2, XCircle, LogIn, LogOut, UserX, PlusCircle,
} from 'lucide-react'
import { useBookingNotes } from '../../lib/bookings'
import { api, friendlyError } from '../../lib/firebase'
import { statusClass, statusLabel, guestName } from '../../lib/status'
import { formatLKR, prettyDate } from '../../utils'
import { Person } from './Avatar'
import FrontDeskButtons from './FrontDesk'

const when = (d) => (d ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

export default function BookingDetails() {
  const { ref } = useParams()
  const { bookings } = useOutletContext()
  const b = bookings.find((x) => x.ref === ref)

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
  ].filter(Boolean).sort((x, y) => (x.at?.getTime?.() ?? 0) - (y.at?.getTime?.() ?? 0))

  const cancel = async () => {
    if (!window.confirm(`Cancel ${b.ref} for ${guestName(b)}? The guest will see it as cancelled by the hotel.`)) return
    try {
      await api.cancelBooking({ ref: b.ref })
    } catch (e) {
      window.alert(friendlyError(e))
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
            <li><Users size={16} /> {b.guests} guest{b.guests === 1 ? '' : 's'}</li>
            <li><CreditCard size={16} /> {b.payment === 'card' ? 'Card' : 'Pay at hotel'}</li>
          </ul>
        </section>

        <section className="admin-card admin-card--7">
          <h3 className="bd-title">Price</h3>
          <div className="price-lines bd-price">
            <div><span>{formatLKR(p.rate)} × {p.nights} night{p.nights === 1 ? '' : 's'}</span><span>{formatLKR(p.subtotal)}</span></div>
            <div><span>Service charge (10%)</span><span>{formatLKR(p.service)}</span></div>
            <div><span>Taxes (8%)</span><span>{formatLKR(p.tax)}</span></div>
            <div className="total"><span>Total</span><span>{formatLKR(p.total)}</span></div>
          </div>
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
        </section>

        <Notes refId={b.ref} />
      </div>
    </div>
  )
}

function Notes({ refId }) {
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
    if (!window.confirm('Delete this note?')) return
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
