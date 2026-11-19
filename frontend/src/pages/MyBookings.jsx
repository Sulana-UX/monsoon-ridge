import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Users, Luggage, ArrowRight } from 'lucide-react'
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
                <article key={b.ref} className={`booking-item ${isLive(b) ? '' : 'is-cancelled'}`}>
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
                    {b.status === 'Confirmed' && b.checkIn > today() && (
                      <button className="text-btn danger" disabled={busyRef === b.ref} onClick={() => cancelBooking(b)}>
                        {busyRef === b.ref ? 'Cancelling…' : 'Cancel booking'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
