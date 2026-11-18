import { useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { Search, Users, Phone, Mail, XCircle, Download, Plus } from 'lucide-react'
import { api, friendlyError } from '../../lib/firebase'
import { formatLKR, prettyDate, today } from '../../utils'
import { Person } from './Avatar'
import { isLive, statusClass, statusLabel } from '../../lib/status'

const FILTERS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'inhouse', label: 'In house' },
  { key: 'today', label: 'Arriving today' },
  { key: 'past', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
]

// CSV for Excel. Cells starting with = + - @ (or tab/CR) are prefixed with ' so
// spreadsheet apps don't run guest-typed text as a formula (CSV injection).
const csvCell = (v) => {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return `"${s.replace(/"/g, '""')}"`
}

function downloadCSV(rows, name) {
  const head = ['Ref', 'Source', 'Status', 'Booked on', 'First name', 'Last name', 'Email', 'Phone', 'Country', 'Room', 'Check-in', 'Check-out', 'Nights', 'Guests', 'Arrival', 'Payment', 'Total (LKR)', 'Requests']
  const body = rows.map((b) => [
    b.ref, b.source === 'phone' ? 'Phone' : b.source === 'walk-in' ? 'Walk-in' : 'Online', b.status, b.createdAt ? b.createdAt.toISOString().slice(0, 10) : '', b.guest?.firstName, b.guest?.lastName,
    b.guest?.email, b.guest?.phone, b.guest?.country, b.roomName, b.checkIn, b.checkOut, b.nights, b.guests,
    b.guest?.arrival, b.payment === 'card' ? 'Card' : 'Pay at hotel', b.total, b.guest?.requests,
  ])
  // BOM so Excel reads Sinhala/Tamil names correctly
  const csv = '﻿' + [head, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}

export default function Bookings() {
  const { bookings } = useOutletContext()
  const [filter, setFilter] = useState('upcoming')
  const [q, setQ] = useState('')
  const [busyRef, setBusyRef] = useState(null)
  const [msg, setMsg] = useState('')
  const t = today()
  const navigate = useNavigate()

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return bookings
      .filter((b) => {
        const s = b.status
        if (filter === 'upcoming') return s === 'Confirmed' && b.checkOut > t
        if (filter === 'inhouse') return s === 'CheckedIn'
        if (filter === 'today') return (s === 'Confirmed' || s === 'CheckedIn') && b.checkIn === t
        if (filter === 'past') return s === 'CheckedOut' || (s === 'Confirmed' && b.checkOut <= t)
        if (filter === 'cancelled') return !isLive(b)
        return true
      })
      .filter((b) => !term || [b.ref, b.roomName, b.guest?.firstName, b.guest?.lastName, b.guest?.email, b.guest?.phone]
        .some((v) => (v || '').toLowerCase().includes(term)))
      .sort((a, b) => (['upcoming', 'today', 'inhouse'].includes(filter) ? a.checkIn.localeCompare(b.checkIn) : 0))
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
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow">Reservations</span>
          <h1>Bookings</h1>
          <p className="muted">{shown.length} shown · {bookings.length} total</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-outline btn-sm" onClick={() => downloadCSV(shown, `bookings-${filter}-${t}.csv`)} disabled={!shown.length}>
            <Download size={16} /> Export CSV
          </button>
          <Link to="/admin/bookings/new" className="btn btn-gold btn-sm"><Plus size={16} /> New booking</Link>
        </div>
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

      {shown.length === 0 ? (
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
                <tr key={b.ref} className={`is-clickable ${isLive(b) ? '' : 'is-cancelled'}`}
                  onClick={(e) => { if (!e.target.closest('button, a')) navigate(`/admin/bookings/${b.ref}`) }}>
                  <td data-label="Ref"><Link to={`/admin/bookings/${b.ref}`} className="mono ref-link">{b.ref}</Link>
                    <small className="muted">{b.createdAt ? b.createdAt.toLocaleDateString('en-GB') : ''}</small>
                    {b.source && b.source !== 'online' && <span className="source-tag">{b.source === 'phone' ? 'Phone' : 'Walk-in'}</span>}</td>
                  <td data-label="Guest">
                    <Person name={`${b.guest?.firstName ?? ''} ${b.guest?.lastName ?? ''}`.trim() || 'Guest'}>
                      <small><Mail size={12} /> {b.guest?.email}</small>
                      <small><Phone size={12} /> {b.guest?.phone}</small>
                      {b.guest?.requests && <small className="admin-req">"{b.guest.requests}"</small>}
                    </Person>
                  </td>
                  <td data-label="Room">{b.roomName}<small className="muted"><Users size={12} /> {b.guests} guest{b.guests > 1 ? 's' : ''}</small></td>
                  <td data-label="Stay">{prettyDate(b.checkIn)}<small className="muted">→ {prettyDate(b.checkOut)} · {b.nights}n</small>
                    {b.guest?.arrival && <small className="muted">ETA {b.guest.arrival}</small>}</td>
                  <td data-label="Total"><strong>{formatLKR(b.total)}</strong><small className="muted">{b.payment === 'card' ? 'Card' : 'Pay at hotel'}</small></td>
                  <td data-label="Status">
                    <span className={statusClass(b.status)}>{statusLabel(b.status)}</span>
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
    </>
  )
}
