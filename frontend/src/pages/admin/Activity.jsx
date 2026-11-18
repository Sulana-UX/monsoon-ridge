import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays, BedDouble, Tag, CalendarOff, ShieldCheck, Inbox, Search, History, User, Lock,
} from 'lucide-react'
import { useActivity } from '../../lib/bookings'

const CATS = {
  booking: { label: 'Bookings', icon: CalendarDays },
  room: { label: 'Rooms', icon: BedDouble },
  pricing: { label: 'Prices & promos', icon: Tag },
  promo: { label: 'Prices & promos', icon: Tag },
  block: { label: 'Blocked dates', icon: CalendarOff },
  staff: { label: 'Staff', icon: ShieldCheck },
  inbox: { label: 'Inbox', icon: Inbox },
}
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'booking', label: 'Bookings' },
  { key: 'cancel', label: 'Cancellations' },
  { key: 'price', label: 'Prices & promos' },
  { key: 'room', label: 'Rooms' },
  { key: 'staff', label: 'Staff' },
  { key: 'other', label: 'Other' },
]
const match = (e, f) => {
  switch (f) {
    case 'all': return true
    case 'booking': return e.category === 'booking'
    case 'cancel': return e.action === 'booking.cancelled'
    case 'price': return e.category === 'pricing' || e.category === 'promo' || (e.action === 'room.updated' && /price/.test(e.summary))
    case 'room': return e.category === 'room'
    case 'staff': return e.category === 'staff'
    default: return e.category === 'block' || e.category === 'inbox'
  }
}

const linkFor = (t) => {
  if (!t) return null
  if (t.type === 'booking') return `/admin/bookings/${t.id}`
  if (t.type === 'room') return `/admin/rooms/${t.id}`
  if (t.type === 'promo' || t.type === 'pricing') return '/admin/pricing'
  if (t.type === 'block') return '/admin/blocks'
  if (t.type === 'staff') return '/admin/staff'
  return null
}

const dayLabel = (d) => {
  if (!d) return 'Just now'
  const today = new Date()
  const y = new Date(today); y.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
const time = (d) => (d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')

export default function Activity() {
  const [max, setMax] = useState(200)
  const { entries, loading, error } = useActivity(max)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase()
    const out = []
    for (const e of entries) {
      if (!match(e, filter)) continue
      if (s && ![e.summary, e.by, e.details, e.target?.label].some((v) => (v || '').toLowerCase().includes(s))) continue
      const label = dayLabel(e.at)
      if (out.at(-1)?.label !== label) out.push({ label, items: [] })
      out.at(-1).items.push(e)
    }
    return out
  }, [entries, filter, q])

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>Activity log</h1>
          <p>Who did what, and when. Entries are written by the server and can't be edited or deleted.</p>
        </div>
      </div>

      <section className="admin-card admin-card--wide activity-card">
        <div className="activity-tools">
          <div className="admin-filters" role="tablist" aria-label="Filter">
            {FILTERS.map((f) => (
              <button key={f.key} role="tab" aria-selected={filter === f.key} className={`chip ${filter === f.key ? 'is-active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>
          <label className="inbox-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: name, reference, email…" aria-label="Search activity" /></label>
        </div>

        {loading ? <p className="muted small">Loading…</p>
          : error ? <p className="muted small">Couldn't load the log. Deploy the latest database rules (firebase deploy --only firestore), then refresh.</p>
          : groups.length === 0 ? <p className="today-empty"><History size={16} /> {entries.length ? 'Nothing matches.' : 'No activity yet. Changes made from now on appear here.'}</p>
          : groups.map((g) => (
            <div key={g.label} className="activity-day">
              <h4 className="report-sub">{g.label}</h4>
              <ol className="activity-list">
                {g.items.map((e) => {
                  const cat = CATS[e.category] || { icon: History }
                  const href = linkFor(e.target)
                  const danger = /cancelled|deleted|removed|no-show/.test(e.action)
                  return (
                    <li key={e.id} className={`activity-row ${danger ? 'is-danger' : ''}`}>
                      <span className="activity-icon"><cat.icon size={15} /></span>
                      <div className="activity-main">
                        <p>{e.summary}</p>
                        {e.details && <details><summary>Details</summary><p className="activity-details">{e.details}</p></details>}
                        <small>
                          {e.role === 'guest' ? <User size={12} /> : <Lock size={12} />}
                          {e.role === 'guest' ? 'Guest' : 'Staff'} · {e.by}
                          {href && <> · <Link to={href}>{e.target.type === 'booking' ? `Open ${e.target.label}` : 'Open'}</Link></>}
                        </small>
                      </div>
                      <time>{time(e.at)}</time>
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}
        {entries.length >= max && (
          <button className="btn btn-outline btn-sm activity-more" onClick={() => setMax((m) => m + 200)}>Load older entries</button>
        )}
      </section>
    </>
  )
}
