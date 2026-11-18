import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, CalendarDays, Users, Mail, Printer, ArrowRight } from 'lucide-react'
import { useBookingByRef } from '../lib/bookings'
import { formatLKR, prettyDate } from '../utils'
import NotFound from './NotFound'

export default function Confirmation() {
  const { ref } = useParams()
  const { booking: b, loading } = useBookingByRef(ref)
  if (loading) return <div className="page-loading"><span className="spinner" /></div>
  if (!b) return <NotFound />
  const ok = b.status === 'Confirmed'

  return (
    <section className="section confirm-page">
      <div className="container confirm">
        <div className="confirm-icon"><CheckCircle2 size={56} /></div>
        <h1>{ok ? 'Booking confirmed!' : 'Booking cancelled'}</h1>
        <p className="muted">
          Thank you, {b.guest.firstName}. Your jungle escape is reserved. A confirmation has been
          sent to <strong>{b.guest.email}</strong>.
        </p>

        <div className="ticket">
          <div className="ticket-top">
            <div>
              <small>Booking reference</small>
              <strong className="ref">{b.ref}</strong>
            </div>
            <span className={`status ${ok ? 'status--ok' : 'status--bad'}`}>{b.status}</span>
          </div>
          <div className="ticket-room">
            <img src={b.image} alt="" />
            <div>
              <h3>{b.roomName}</h3>
              <p className="muted">{b.guest.firstName} {b.guest.lastName}</p>
            </div>
          </div>
          <div className="ticket-grid">
            <div><CalendarDays size={16} /><small>Check-in</small><strong>{prettyDate(b.checkIn)}</strong></div>
            <div><CalendarDays size={16} /><small>Check-out</small><strong>{prettyDate(b.checkOut)}</strong></div>
            <div><Users size={16} /><small>Guests</small><strong>{b.guests} · {b.nights} night{b.nights > 1 ? 's' : ''}</strong></div>
            <div><Mail size={16} /><small>Payment</small><strong>{b.payment === 'card' ? 'Card' : 'Pay at hotel'}</strong></div>
          </div>
          <div className="ticket-total">
            <span>Total amount</span>
            <strong>{formatLKR(b.total)}</strong>
          </div>
        </div>

        <div className="confirm-actions">
          <button className="btn btn-outline" onClick={() => window.print()}><Printer size={16} /> Print</button>
          <Link to="/my-bookings" className="btn btn-dark">My Bookings <ArrowRight size={16} /></Link>
        </div>
      </div>
    </section>
  )
}
