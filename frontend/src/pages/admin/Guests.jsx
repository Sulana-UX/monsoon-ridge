import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Search, Mail, Phone } from 'lucide-react'
import { formatLKR, prettyDate, today } from '../../utils'
import { Person } from './Avatar'
import { isLive } from '../../lib/status'

export default function Guests() {
  const { bookings } = useOutletContext()
  const [q, setQ] = useState('')
  const t = today()

  // One row per guest email, built from their bookings
  const guests = useMemo(() => {
    const map = new Map()
    for (const b of bookings) {
      const email = (b.guest?.email || b.accountEmail || '').toLowerCase()
      if (!email) continue
      const g = map.get(email) || {
        email, name: `${b.guest?.firstName ?? ''} ${b.guest?.lastName ?? ''}`.trim(), phone: b.guest?.phone,
        country: b.guest?.country, stays: 0, nights: 0, spent: 0, cancelled: 0, last: null, next: null,
      }
      if (isLive(b)) {
        g.stays += 1
        g.nights += b.nights
        g.spent += b.total || 0
        if (b.checkOut <= t && (!g.last || b.checkIn > g.last)) g.last = b.checkIn
        if (b.checkOut > t && (!g.next || b.checkIn < g.next)) g.next = b.checkIn
      } else g.cancelled += 1
      map.set(email, g)
    }
    return [...map.values()].sort((a, b) => b.spent - a.spent)
  }, [bookings, t])

  const term = q.trim().toLowerCase()
  const shown = term
    ? guests.filter((g) => [g.name, g.email, g.phone, g.country].some((v) => (v || '').toLowerCase().includes(term)))
    : guests

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow">People</span>
          <h1>Guests</h1>
          <p className="muted">{guests.length} guest{guests.length === 1 ? '' : 's'} · sorted by total spend</p>
        </div>
        <label className="admin-search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone, country…" />
        </label>
      </div>

      {shown.length === 0 ? (
        <div className="empty"><h3>No guests found</h3><p className="muted">Guests appear here after their first booking.</p></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Guest</th><th>Country</th><th>Stays</th><th>Nights</th><th>Total spend</th><th>Last stay</th><th>Next stay</th></tr>
            </thead>
            <tbody>
              {shown.map((g) => (
                <tr key={g.email}>
                  <td data-label="Guest">
                    <Person name={g.name || g.email}>
                      <small><Mail size={12} /> <a href={`mailto:${g.email}`}>{g.email}</a></small>
                      {g.phone && <small><Phone size={12} /> <a href={`tel:${g.phone.replace(/[^\d+]/g, '')}`}>{g.phone}</a></small>}
                    </Person>
                  </td>
                  <td data-label="Country">{g.country || '—'}</td>
                  <td data-label="Stays">{g.stays}{g.cancelled > 0 && <small className="muted">{g.cancelled} cancelled</small>}</td>
                  <td data-label="Nights">{g.nights}</td>
                  <td data-label="Total spend"><strong>{formatLKR(g.spent)}</strong></td>
                  <td data-label="Last stay">{g.last ? prettyDate(g.last) : '—'}</td>
                  <td data-label="Next stay">{g.next ? prettyDate(g.next) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
