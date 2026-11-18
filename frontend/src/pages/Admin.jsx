import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, CalendarDays, Users, Phone, Mail, BedDouble, Wallet, CalendarCheck, XCircle } from 'lucide-react'
import { useBookings } from '../lib/bookings'
import { api, friendlyError } from '../lib/firebase'
import { formatLKR, prettyDate, today } from '../utils'

const FILTERS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'today', label: 'Arriving today' },
  { key: 'past', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
]

export default function Admin() {
  const { bookings, loading, error } = useBookings({ all: true, max: 500 })
  const [filter, setFilter] = useState('upcoming')
  const [q, setQ] = useState('')
  const [busyRef, setBusyRef] = useState(null)
  const [msg, setMsg] = useState('')
  const t = today()

  const stats = useMemo(() => {
    const live = bookings.filter((b) => b.status === 'Confirmed')
    return {
      upcoming: live.filter((b) => b.checkOut > t).length,
      arrivals: live.filter((b) => b.checkIn === t).length,
      inHouse: live.filter((b) => b.checkIn <= t && b.checkOut > t).length,
      revenue: live.filter((b) => b.checkOut > t).reduce((s, b) => s + (b.total || 0), 0),
    }
  }, [bookings, t])

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return bookings
      .filter((b) => {
        const live = b.status === 'Confirmed'
        if (filter === 'upcoming') return live && b.checkOut > t
        if (filter === 'today') return live && b.checkIn === t
        if (filter === 'past') return live && b.checkOut <= t
        if (filter === 'cancelled') return !live
        return true
      })
      .filter((b) => !term || [b.ref, b.roomName, b.guest?.firstName, b.guest?.lastName, b.guest?.email, b.guest?.phone]
        .some((v) => (v || '').toLowerCase().includes(term)))
      .sort((a, b) => (filter === 'upcoming' || filter === 'today' ? a.checkIn.localeCompare(b.checkIn) : 0))
  }, [bookings, filter, q, t])

  const cancel = async (b) => {
    const name = `${b.guest?.firstName} ${b.guest?.lastName}`
    if (!window.confirm(`Cancel ${b.ref} for ${name}? The guest will see it as cancelled by the hotel.`)) return
    setBusyRef(b.ref)
    setMsg('')
    try {
      await api.cancelBooking({ ref: b.ref })
      setMsg(`${b.ref} cancelled.`)
    } catch (e) {
      setMsg(friendlyError(e))
    }
    setBusyRef(null)
  }

  return (
    <section className="section admin-page">
      <div className="container">
        <div className="admin-head">
          <div>
            <span className="eyebrow">Staff only</span>
            <h1>Bookings</h1>
          </div>
          <Link to="/rooms" className="btn btn-outline btn-sm">View site rooms</Link>
        </div>

        <div className="admin-stats">
          <div><CalendarDays size={20} /><strong>{stats.upcoming}</strong><span>Upcoming stays</span></div>
          <div><CalendarCheck size={20} /><strong>{stats.arrivals}</strong><span>Arriving today</span></div>
          <div><BedDouble size={20} /><strong>{stats.inHouse}</strong><span>Guests in-house</span></div>
          <div><Wallet size={20} /><strong>{formatLKR(stats.revenue)}</strong><span>Upcoming revenue</span></div>
        </div>

        <div className="admin-tools">
          <div className="admin-filters" role="tablist">
            {FILTERS.map((f) => (
              <button key={f.key} role="tab" aria-selected={filter === f.key}
                className={`chip ${filter === f.key ? 'is-active' : ''}`} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          <label className="admin-search">
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ref, guest name, email, phone…" />
          </label>
        </div>

        {msg && <p className="auth-msg" role="status">{msg}</p>}

        {loading ? (
          <div className="page-loading"><span className="spinner" /></div>
        ) : error ? (
          <div className="empty"><h3>Couldn't load bookings</h3><p className="muted">{error.code === 'permission-denied' ? 'This account does not have staff access.' : 'Please refresh the page.'}</p></div>
        ) : shown.length === 0 ? (
          <div className="empty"><h3>No bookings here</h3><p className="muted">Try another filter or search.</p></div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ref</th><th>Guest</th><th>Room</th><th>Stay</th><th>Total</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {shown.map((b) => (
                  <tr key={b.ref} className={b.status !== 'Confirmed' ? 'is-cancelled' : ''}>
                    <td data-label="Ref"><strong className="mono">{b.ref}</strong>
                      <small className="muted">{b.createdAt ? b.createdAt.toLocaleDateString('en-GB') : ''}</small></td>
                    <td data-label="Guest">
                      <strong>{b.guest?.firstName} {b.guest?.lastName}</strong>
                      <small><Mail size={12} /> {b.guest?.email}</small>
                      <small><Phone size={12} /> {b.guest?.phone}</small>
                      {b.guest?.requests && <small className="admin-req">"{b.guest.requests}"</small>}
                    </td>
                    <td data-label="Room">{b.roomName}<small className="muted"><Users size={12} /> {b.guests} guest{b.guests > 1 ? 's' : ''}</small></td>
                    <td data-label="Stay">{prettyDate(b.checkIn)}<small className="muted">→ {prettyDate(b.checkOut)} · {b.nights}n</small>
                      {b.guest?.arrival && <small className="muted">ETA {b.guest.arrival}</small>}</td>
                    <td data-label="Total"><strong>{formatLKR(b.total)}</strong><small className="muted">{b.payment === 'card' ? 'Card' : 'Pay at hotel'}</small></td>
                    <td data-label="Status">
                      <span className={`status ${b.status === 'Confirmed' ? 'status--ok' : 'status--bad'}`}>{b.status}</span>
                      {b.cancelledBy && <small className="muted">by {b.cancelledBy}</small>}
                    </td>
                    <td>
                      {b.status === 'Confirmed' && (
                        <button className="text-btn danger" disabled={busyRef === b.ref} onClick={() => cancel(b)}>
                          <XCircle size={14} /> {busyRef === b.ref ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
