import { useMemo, useState } from 'react'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import { Plus, Pencil, Users, BedDouble, EyeOff, Star } from 'lucide-react'
import { CATEGORIES } from '../../context/RoomsContext'
import { formatLKR } from '../../utils'

export default function RoomsAdmin() {
  const { rooms, bookings } = useOutletContext()
  const [cat, setCat] = useState('All')
  const flash = useLocation().state?.flash

  // Upcoming confirmed bookings per room, so staff can see what a change affects
  const upcoming = useMemo(() => {
    const t = new Date().toISOString().slice(0, 10)
    const m = {}
    for (const b of bookings) if ((b.status === 'Confirmed' || b.status === 'CheckedIn') && b.checkOut > t) m[b.roomId] = (m[b.roomId] || 0) + 1
    return m
  }, [bookings])

  const shown = cat === 'All' ? rooms : rooms.filter((r) => r.type === cat)
  const count = (c) => rooms.filter((r) => r.type === c).length

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow">Inventory</span>
          <h1>Rooms</h1>
          <p className="muted">{rooms.length} room type{rooms.length === 1 ? '' : 's'} · {rooms.reduce((s, r) => s + (r.units || 0), 0)} rooms in total</p>
        </div>
        <Link to="/admin/rooms/new" className="btn btn-gold btn-sm"><Plus size={16} /> Add room</Link>
      </div>

      {flash && <p className="auth-msg" role="status">{flash}</p>}

      <div className="admin-tools">
        <div className="admin-filters" role="tablist">
          {['All', ...CATEGORIES].map((c) => (
            <button key={c} role="tab" aria-selected={cat === c} className={`chip ${cat === c ? 'is-active' : ''}`} onClick={() => setCat(c)}>
              {c} {c !== 'All' && <span className="chip-count">{count(c)}</span>}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <BedDouble size={42} />
          <h3>No {cat === 'All' ? '' : cat.toLowerCase() + ' '}rooms yet</h3>
          <p className="muted">Add a room and it will appear on the website straight away.</p>
          <Link to="/admin/rooms/new" className="btn btn-gold"><Plus size={16} /> Add room</Link>
        </div>
      ) : (
        <div className="room-admin-grid">
          {shown.map((r) => (
            <Link key={r.id} to={`/admin/rooms/${r.id}`} className={`room-admin ${r.active === false ? 'is-hidden' : ''}`}>
              <div className="room-admin-img" style={{ backgroundImage: `url(${r.image})` }}>
                <span className="badge">{r.type}</span>
                {r.active === false && <span className="room-admin-hidden"><EyeOff size={14} /> Hidden</span>}
                {r.featured && <span className="room-admin-featured"><Star size={13} fill="currentColor" /> Featured</span>}
              </div>
              <div className="room-admin-body">
                <h3>{r.name}</h3>
                <div className="room-admin-meta">
                  <span><Users size={14} /> up to {r.guests}</span>
                  <span><BedDouble size={14} /> {r.units} room{r.units === 1 ? '' : 's'}</span>
                </div>
                <div className="room-admin-foot">
                  <strong>{formatLKR(r.price)}<small> / night</small></strong>
                  <span className="text-btn"><Pencil size={14} /> Edit</span>
                </div>
                {upcoming[r.id] > 0 && <small className="muted">{upcoming[r.id]} upcoming booking{upcoming[r.id] === 1 ? '' : 's'}</small>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
