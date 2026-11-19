import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Sparkles, Brush, Wrench, Settings2, Save, X, BedDouble, LogIn, LogOut, CircleAlert } from 'lucide-react'
import { api, friendlyError } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { unitToday, HK_LABEL } from '../../lib/units'
import { prettyDate, today } from '../../utils'
import { useDialog } from '../../components/Dialog'

const FILTERS = [
  { key: 'all', label: 'All rooms' },
  { key: 'dirty', label: 'Needs cleaning' },
  { key: 'vacant', label: 'Vacant & clean' },
  { key: 'occupied', label: 'Occupied' },
  { key: 'arriving', label: 'Arriving today' },
  { key: 'ooo', label: 'Out of order' },
]
const NEXT = { dirty: 'cleaning', cleaning: 'clean', clean: 'dirty' }
const shortDate = (iso) => prettyDate(iso).replace(/ \d{4}$/, '')

export default function Housekeeping() {
  const dialog = useDialog()
  const { units, bookings, rooms } = useOutletContext()
  const { isManager } = useAuth()
  const t = today()
  const [filter, setFilter] = useState('all')
  const [setup, setSetup] = useState(false)
  const [err, setErr] = useState('')

  const rows = useMemo(() => units.map((u) => ({ ...u, ...unitToday(u, bookings, t) })), [units, bookings, t])
  const shown = rows.filter((u) => {
    switch (filter) {
      case 'dirty': return !u.outOfOrder && u.housekeeping !== 'clean'
      case 'vacant': return !u.outOfOrder && !u.guest && u.housekeeping === 'clean'
      case 'occupied': return Boolean(u.guest)
      case 'arriving': return Boolean(u.arriving)
      case 'ooo': return u.outOfOrder
      default: return true
    }
  })
  const counts = {
    occupied: rows.filter((u) => u.guest).length,
    dirty: rows.filter((u) => !u.outOfOrder && u.housekeeping !== 'clean').length,
    vacant: rows.filter((u) => !u.outOfOrder && !u.guest && u.housekeeping === 'clean').length,
    ooo: rows.filter((u) => u.outOfOrder).length,
  }
  const types = rooms.filter((r) => r.active !== false)

  const set = async (u, changes) => {
    setErr('')
    try { await api.setHousekeeping(u.number, changes) } catch (e) { setErr(friendlyError(e)) }
  }
  const toggleOOO = async (u) => {
    if (u.outOfOrder) {
      if (await dialog.confirm({ title: `Room ${u.number} back in service?`, message: 'It can be given to guests again.', confirmLabel: 'Back in service' })) set(u, { outOfOrder: false, note: '' })
      return
    }
    const note = await dialog.prompt({
      title: `Room ${u.number} out of order`,
      message: "Guests can't be put in this room until it's back in service.",
      label: 'Reason', placeholder: 'e.g. Leaking tap', confirmLabel: 'Mark out of order', required: true,
      suggestions: ['AC repair', 'Plumbing', 'Electrical', 'Deep cleaning', 'Renovation'],
    })
    if (note) set(u, { outOfOrder: true, note })
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow">Front desk</span>
          <h1>Housekeeping</h1>
          <p>Every room by number: who's in it, and whether it's clean. Check-out marks a room dirty automatically.</p>
        </div>
        {isManager && (
          <button className="btn btn-outline btn-sm" onClick={() => setSetup((v) => !v)}>
            {setup ? <X size={16} /> : <Settings2 size={16} />} {setup ? 'Close' : 'Room numbers'}
          </button>
        )}
      </div>

      {(setup || (units.length === 0 && isManager)) && <NumberSetup types={types} units={units} />}

      {units.length === 0 ? (
        !isManager && <div className="empty"><h3>No room numbers yet</h3><p className="muted">An Admin needs to add room numbers first (Housekeeping → Room numbers).</p></div>
      ) : (
        <>
          <div className="hk-summary">
            <div><strong>{counts.occupied}</strong><span>Occupied</span></div>
            <div><strong>{counts.vacant}</strong><span>Ready to sell</span></div>
            <div className={counts.dirty ? 'is-warn' : ''}><strong>{counts.dirty}</strong><span>Need cleaning</span></div>
            <div><strong>{counts.ooo}</strong><span>Out of order</span></div>
          </div>

          <div className="admin-filters hk-filters" role="tablist" aria-label="Show">
            {FILTERS.map((f) => (
              <button key={f.key} role="tab" aria-selected={filter === f.key} className={`chip ${filter === f.key ? 'is-active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>
          {err && <p className="auth-msg auth-msg--err" role="alert">{err}</p>}

          {types.map((r) => {
            const list = shown.filter((u) => u.roomId === r.id)
            if (!list.length) return null
            return (
              <section key={r.id} className="hk-group">
                <h3><BedDouble size={17} /> {r.name} <small>{list.length} room{list.length === 1 ? '' : 's'}</small></h3>
                <div className="hk-grid">
                  {list.map((u) => (
                    <article key={u.number} className={`hk-tile hk--${u.outOfOrder ? 'ooo' : u.housekeeping} ${u.guest ? 'is-occupied' : ''}`}>
                      <header>
                        <strong className="hk-number">{u.number}</strong>
                        <span className={`hk-badge hk-badge--${u.outOfOrder ? 'ooo' : u.housekeeping}`}>
                          {u.outOfOrder ? 'Out of order' : HK_LABEL[u.housekeeping]}
                        </span>
                      </header>
                      <div className="hk-who">
                        {u.guest ? (
                          <>
                            <span className="hk-state"><span className="hk-dot is-in" /> Occupied</span>
                            <Link to={`/admin/bookings/${u.guest.ref}`}>{u.guest.guest?.firstName} {u.guest.guest?.lastName}</Link>
                            <small>{u.leavingToday ? <><LogOut size={12} /> Leaves today</> : <>until {shortDate(u.guest.checkOut)}</>}</small>
                          </>
                        ) : u.arriving ? (
                          <>
                            <span className="hk-state"><span className="hk-dot is-arriving" /> Arriving today</span>
                            <Link to={`/admin/bookings/${u.arriving.ref}`}>{u.arriving.guest?.firstName} {u.arriving.guest?.lastName}</Link>
                            {u.housekeeping !== 'clean' && !u.outOfOrder && <small className="hk-alert"><CircleAlert size={12} /> Clean before arrival</small>}
                          </>
                        ) : (
                          <>
                            <span className="hk-state"><span className="hk-dot" /> Vacant</span>
                            <small>{u.next ? <><LogIn size={12} /> Next: {shortDate(u.next.checkIn)}</> : 'No upcoming guest'}</small>
                          </>
                        )}
                        {u.outOfOrder && u.note && <small className="hk-note"><Wrench size={12} /> {u.note}</small>}
                      </div>
                      <footer>
                        {!u.outOfOrder && (
                          <button className="fd-btn fd-btn--ghost hk-cycle" onClick={() => set(u, { housekeeping: NEXT[u.housekeeping] || 'clean' })}
                            title={`Mark as ${HK_LABEL[NEXT[u.housekeeping]]}`}>
                            {u.housekeeping === 'clean' ? <Brush size={14} /> : <Sparkles size={14} />}
                            {u.housekeeping === 'dirty' ? 'Start cleaning' : u.housekeeping === 'cleaning' ? 'Mark clean' : 'Mark dirty'}
                          </button>
                        )}
                        <button className="icon-btn" title={u.outOfOrder ? 'Back in service' : 'Out of order'} aria-label={u.outOfOrder ? `Put room ${u.number} back in service` : `Mark room ${u.number} out of order`} onClick={() => toggleOOO(u)}>
                          <Wrench size={14} />
                        </button>
                      </footer>
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
          {shown.length === 0 && <p className="today-empty"><Sparkles size={16} /> No rooms here.</p>}
        </>
      )}
    </>
  )
}

/** Admin: which room numbers each room type has. */
function NumberSetup({ types, units }) {
  return (
    <section className="admin-card hk-setup">
      <h3><Settings2 size={18} /> Room numbers</h3>
      <p className="muted small">Type the numbers for each room type, separated by commas or spaces (e.g. 101, 102, 103). A type can have up to as many numbers as it has rooms.</p>
      <div className="hk-setup-list">
        {types.map((r) => <NumberRow key={r.id} room={r} current={units.filter((u) => u.roomId === r.id).map((u) => u.number)} />)}
      </div>
    </section>
  )
}

function NumberRow({ room, current }) {
  const [text, setText] = useState(current.join(', '))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const dirty = text.split(/[\s,;]+/).filter(Boolean).map((x) => x.toUpperCase()).join(',') !== current.join(',')
  const save = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const { data } = await api.setRoomNumbers(room.id, text)
      setText(data.numbers.join(', '))
      setMsg({ ok: true, text: data.missing > 0 ? `Saved. ${data.missing} more room${data.missing === 1 ? '' : 's'} still without a number.` : 'Saved.' })
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e) })
    }
    setBusy(false)
  }
  return (
    <div className="hk-setup-row">
      <div className="hk-setup-name"><strong>{room.name}</strong><small>{room.units} room{room.units === 1 ? '' : 's'} · {current.length} numbered</small></div>
      <div className="input-wrap"><input value={text} onChange={(e) => setText(e.target.value)} placeholder={room.units > 1 ? '101, 102, 103' : 'V1'} aria-label={`Room numbers for ${room.name}`} /></div>
      <button className="btn btn-gold btn-sm" onClick={save} disabled={busy || !dirty}>{busy ? <span className="spinner spinner--sm" /> : <Save size={15} />} Save</button>
      {msg && <p className={`auth-msg ${msg.ok ? '' : 'auth-msg--err'}`} role="status">{msg.text}</p>}
    </div>
  )
}
