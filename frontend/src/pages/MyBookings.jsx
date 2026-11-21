import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Users, Luggage, ArrowRight, Star, FileText, CalendarClock } from 'lucide-react'
import ChangeStay from '../components/ChangeStay'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useBookings } from '../lib/bookings'
import { api, friendlyError } from '../lib/firebase'
import { images } from '../data/rooms'
import { formatLKR, prettyDate, today } from '../utils'
import { isLive, statusClass, statusLabel } from '../lib/status'
import { useDialog } from '../components/Dialog'

export default function MyBookings() {
  const dialog = useDialog()
  const { user } = useAuth()
  const { bookings, loading, error } = useBookings({ uid: user.uid })
  const [busyRef, setBusyRef] = useState(null)
  const [cancelError, setCancelError] = useState('')
  const [changing, setChanging] = useState(null)
  const [notice, setNotice] = useState('')

  const cancelBooking = async (b) => {
    if (!(await dialog.confirm({ title: 'Cancel this booking?', message: `${b.roomName}, reference ${b.ref}. This cannot be undone.`, confirmLabel: 'Cancel booking', cancelLabel: 'Keep booking', danger: true }))) return
    setBusyRef(b.ref)
    setCancelError('')
    try {
      await api.cancelBooking({ ref: b.ref })
    } catch (e) {
      setCancelError(friendlyError(e))
    }
    setBusyRef(null)
  }

  return (
    <>
      <PageHeader title="My Bookings" subtitle="View and manage your upcoming stays." image={images.lobby} />
      <section className="section">
        <div className="container narrow">
          {cancelError && <p className="auth-msg auth-msg--err" role="alert">{cancelError}</p>}
          {notice && <p className="auth-msg" role="status">{notice}</p>}
          {loading ? (
            <div className="page-loading"><span className="spinner" /></div>
          ) : error ? (
            <div className="empty">
              <h3>Couldn't load your bookings</h3>
              <p className="muted">Please check your connection and refresh the page.</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="empty">
              <Luggage size={44} />
              <h3>No bookings yet</h3>
              <p className="muted">Your reservations will appear here once you book a room.</p>
              <Link to="/rooms" className="btn btn-gold">Browse Rooms <ArrowRight size={16} /></Link>
            </div>
          ) : (
            <div className="booking-list">
              {bookings.map((b) => (
                <div key={b.ref} className="booking-wrap">
                <article className={`booking-item ${isLive(b) ? '' : 'is-cancelled'}`}>
                  <img src={b.image} alt="" />
                  <div className="bi-body">
                    <div className="bi-top">
                      <h3>{b.roomName}</h3>
                      <span className={statusClass(b.status)}>{statusLabel(b.status)}</span>
                    </div>
                    <p className="muted small">Ref: <strong>{b.ref}</strong></p>
                    <div className="bi-meta">
                      <span><CalendarDays size={15} /> {prettyDate(b.checkIn)} → {prettyDate(b.checkOut)}</span>
                      <span><Users size={15} /> {b.guests} guest{b.guests > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="bi-side">
                    <strong>{formatLKR(b.total)}</strong>
                    <small className="muted">{b.nights} night{b.nights > 1 ? 's' : ''}</small>
                    {b.status !== 'Cancelled' && (
                      <Link to={`/invoice/${b.ref}`} className="text-btn bi-invoice"><FileText size={14} /> {b.invoice?.number ? 'Invoice' : 'Booking summary'}</Link>
                    )}
                    {b.status === 'CheckedOut' && (b.review ? (
                      <span className="bi-reviewed"><Star size={14} fill="currentColor" /> You rated {b.review.rating}/5</span>
                    ) : (
                      <Link to={`/review/${b.ref}`} className="btn btn-gold btn-sm bi-review"><Star size={14} /> Write a review</Link>
                    ))}
                    {b.status === 'Confirmed' && b.checkIn > today() && changing !== b.ref && (
                      <button className="text-btn bi-change" onClick={() => { setChanging(b.ref); setNotice('') }}><CalendarClock size={14} /> Change booking</button>
                    )}
                    {b.status === 'Confirmed' && b.checkIn > today() && (
                      <button className="text-btn danger" disabled={busyRef === b.ref} onClick={() => cancelBooking(b)}>
                        {busyRef === b.ref ? 'Cancelling…' : 'Cancel booking'}
                      </button>
                    )}
                  </div>
                </article>
                {changing === b.ref && (
                  <ChangeStay booking={b} onClose={() => setChanging(null)}
                    onDone={(r) => { setChanging(null); setNotice(`Booking ${r.ref} updated. We've emailed you the new details.`) }} />
                )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
