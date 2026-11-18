import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CalendarDays, X, Wrench } from 'lucide-react'
import { occupies, statusClass, statusLabel, guestName } from '../../lib/status'
import { prettyDate, today } from '../../utils'
import { Person } from './Avatar'

/*
 * Month grid: room types × nights. Each cell = rooms booked / rooms of that type.
 * Colour = sequential single-hue gold ramp (light → dark = quiet → busy).
 * Identity is never colour-only: every cell also prints its number, and full
 * nights get an outline + "Full" in the tooltip.
 */
const STEPS = [
  { max: 0, cls: 'lv0', label: 'Empty' },
  { max: 0.25, cls: 'lv1', label: '1–25%' },
  { max: 0.5, cls: 'lv2', label: '26–50%' },
  { max: 0.75, cls: 'lv3', label: '51–75%' },
  { max: 0.999, cls: 'lv4', label: '76–99%' },
  { max: Infinity, cls: 'lv5', label: 'Full' },
]
const level = (booked, units) => {
  if (!units) return 'lv-na'
  const r = booked / units
  return STEPS.find((s) => r <= s.max).cls
}

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export default function Calendar() {
  const { bookings, rooms, blocks = [] } = useOutletContext()
  const t = today()
  const [ym, setYm] = useState(() => ({ y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 }))
  const [picked, setPicked] = useState(null) // { roomId, date }

  const days = useMemo(() => {
    const n = new Date(ym.y, ym.m + 1, 0).getDate()
    return Array.from({ length: n }, (_, i) => {
      const date = iso(ym.y, ym.m, i + 1)
      const dow = new Date(ym.y, ym.m, i + 1).getDay()
      return { date, d: i + 1, wk: 'SMTWTFS'[dow], weekend: dow === 0 || dow === 6 }
    })
  }, [ym])

  const activeRooms = rooms.filter((r) => r.active !== false)
  const totalUnits = activeRooms.reduce((s, r) => s + (r.units || 0), 0)

  // booked[roomId][date] = count
  const grid = useMemo(() => {
    const g = {}
    for (const r of activeRooms) g[r.id] = {}
    for (const b of bookings) {
      if (!g[b.roomId]) continue
      for (const day of days) if (occupies(b, day.date)) g[b.roomId][day.date] = (g[b.roomId][day.date] || 0) + 1
    }
    return g
  }, [bookings, activeRooms, days])

  // blocked[roomId][date] = rooms taken out of sale (maintenance / events)
  const blocked = useMemo(() => {
    const g = {}
    for (const bl of blocks) {
      for (const day of days) {
        if (day.date >= bl.from && day.date < bl.to) {
          g[bl.roomId] = g[bl.roomId] || {}
          g[bl.roomId][day.date] = (g[bl.roomId][day.date] || 0) + bl.units
        }
      }
    }
    return g
  }, [blocks, days])

  const totals = days.map((day) => activeRooms.reduce((s, r) => s + (grid[r.id]?.[day.date] || 0) + (blocked[r.id]?.[day.date] || 0), 0))
  const monthName = new Date(ym.y, ym.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const shift = (n) => {
    setPicked(null)
    setYm(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }))
  }

  const pickedRoom = picked && rooms.find((r) => r.id === picked.roomId)
  const pickedGuests = picked
    ? bookings.filter((b) => (picked.roomId === 'all' || b.roomId === picked.roomId) && occupies(b, picked.date))
    : []
  const pickedBlocks = picked
    ? blocks.filter((bl) => (picked.roomId === 'all' || bl.roomId === picked.roomId) && picked.date >= bl.from && picked.date < bl.to)
    : []

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow">Occupancy</span>
          <h1>Calendar</h1>
          <p>Rooms booked each night, by room type. Click a cell to see who's staying.</p>
        </div>
        <div className="cal-nav">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <strong>{monthName}</strong>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={18} /></button>
          <button className="btn btn-outline btn-sm" onClick={() => { setPicked(null); setYm({ y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 }) }}>
            <CalendarDays size={15} /> Today
          </button>
        </div>
      </div>

      <section className="admin-card cal-card">
        <div className="cal-scroll">
          <table className="cal">
            <thead>
              <tr>
                <th className="cal-room">Room type</th>
                {days.map((day) => (
                  <th key={day.date} className={`${day.weekend ? 'is-weekend' : ''} ${day.date === t ? 'is-today' : ''}`}>
                    <span>{day.wk}</span>{day.d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeRooms.map((r) => (
                <tr key={r.id}>
                  <th className="cal-room" scope="row">
                    <strong>{r.name}</strong>
                    <small>{r.type} · {r.units} room{r.units === 1 ? '' : 's'}</small>
                  </th>
                  {days.map((day) => {
                    const booked = grid[r.id]?.[day.date] || 0
                    const blk = blocked[r.id]?.[day.date] || 0
                    const n = booked + blk
                    const isPicked = picked?.roomId === r.id && picked.date === day.date
                    return (
                      <td key={day.date} className={`${day.date === t ? 'is-today' : ''} ${day.date < t ? 'is-past' : ''}`}>
                        <button
                          className={`cal-cell ${level(n, r.units)} ${blk ? 'is-blocked' : ''} ${isPicked ? 'is-picked' : ''}`}
                          title={`${r.name} · ${prettyDate(day.date)} · ${booked} booked${blk ? ` + ${blk} blocked` : ''} of ${r.units}${n >= r.units && r.units ? ' (Full)' : ''}`}
                          onClick={() => setPicked(isPicked ? null : { roomId: r.id, date: day.date })}
                        >
                          {n || ''}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="cal-total">
                <th className="cal-room" scope="row"><strong>All rooms</strong><small>{totalUnits} rooms</small></th>
                {days.map((day, i) => (
                  <td key={day.date} className={day.date === t ? 'is-today' : ''}>
                    <button className={`cal-cell cal-cell--total ${level(totals[i], totalUnits)}`}
                      title={`All rooms · ${prettyDate(day.date)} · ${totals[i]} of ${totalUnits} booked`}
                      onClick={() => setPicked({ roomId: 'all', date: day.date })}>
                      {totalUnits ? `${Math.round((totals[i] / totalUnits) * 100)}` : ''}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="cal-legend" aria-label="Legend">
          <span className="muted small">Rooms booked:</span>
          {STEPS.map((s) => <span key={s.cls} className="cal-key"><i className={`cal-swatch ${s.cls}`} /> {s.label}</span>)}
          <span className="cal-key"><i className="cal-swatch lv2 is-blocked" /> Includes blocked rooms</span>
          <span className="muted small cal-legend-note">Bottom row = % of all rooms</span>
        </div>
      </section>

      {picked && (
        <section className="admin-card cal-detail">
          <div className="admin-card-head">
            <div>
              <h3>{picked.roomId === 'all' ? 'All rooms' : pickedRoom?.name} · {prettyDate(picked.date)}</h3>
              <p className="muted small">{pickedGuests.length} stay{pickedGuests.length === 1 ? '' : 's'} that night</p>
            </div>
            <button className="icon-btn" onClick={() => setPicked(null)} aria-label="Close"><X size={16} /></button>
          </div>
          {pickedBlocks.map((bl) => (
            <p key={bl.id} className="cal-block-note"><Wrench size={15} /> {bl.units} × {bl.roomName} blocked: {bl.reason} ({prettyDate(bl.from)} → {prettyDate(bl.to)}) · <Link to="/admin/blocks">Manage</Link></p>
          ))}
          {pickedGuests.length === 0 ? (
            <p className="today-empty">No guests booked this night.</p>
          ) : (
            <ul className="recent-list">
              {pickedGuests.map((b) => (
                <li key={b.ref}>
                  <Person name={guestName(b)} detail={b.roomName} />
                  <span className="mono small muted">{b.ref}</span>
                  <span className="small muted">{prettyDate(b.checkIn)} → {prettyDate(b.checkOut)}</span>
                  <Link to={`/admin/bookings/${b.ref}`} className="link-arrow">Open</Link>
                  <span className={statusClass(b.status)}>{statusLabel(b.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}
