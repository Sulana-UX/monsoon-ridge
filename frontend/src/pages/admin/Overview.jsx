import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { CalendarDays, Wallet, BedDouble, XCircle, LogIn, LogOut, ArrowRight } from 'lucide-react'
import { addDays, formatLKR, prettyDate, today } from '../../utils'
import { ColumnChart, BarList, DataTable } from './BarChart'

const PERIODS = [
  { key: 7, label: 'Last 7 days' },
  { key: 30, label: 'Last 30 days' },
  { key: 0, label: 'All time' },
]
const shortLKR = (n) => (n >= 1e6 ? `LKR ${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `LKR ${Math.round(n / 1e3)}k` : formatLKR(n))
const dayLabel = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
const guestName = (b) => `${b.guest?.firstName ?? ''} ${b.guest?.lastName ?? ''}`.trim()

export default function Overview() {
  const { bookings, rooms } = useOutletContext()
  const TOTAL_UNITS = rooms.filter((r) => r.active !== false).reduce((s, r) => s + (r.units || 0), 0)
  const [period, setPeriod] = useState(30)
  const t = today()
  const live = useMemo(() => bookings.filter((b) => b.status === 'Confirmed'), [bookings])

  // Headline numbers for bookings MADE in the chosen period
  const kpi = useMemo(() => {
    const since = period ? Date.now() - period * 86400000 : 0
    const made = bookings.filter((b) => (b.createdAt?.getTime() ?? Date.now()) >= since)
    const ok = made.filter((b) => b.status === 'Confirmed')
    const nights = ok.reduce((s, b) => s + b.nights, 0)
    return {
      count: ok.length,
      revenue: ok.reduce((s, b) => s + (b.total || 0), 0),
      avgStay: ok.length ? nights / ok.length : 0,
      cancelRate: made.length ? Math.round(((made.length - ok.length) / made.length) * 100) : 0,
    }
  }, [bookings, period])

  // Rooms occupied each night for the next 14 nights
  const occupancy = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(t, i)
      const booked = live.filter((b) => b.checkIn <= d && b.checkOut > d).length
      const pct = TOTAL_UNITS ? Math.round((booked / TOTAL_UNITS) * 100) : 0
      return {
        key: d, label: dayLabel(d), value: pct, booked,
        tip: { title: prettyDate(d), lines: [`${booked} of ${TOTAL_UNITS} rooms booked`, `${pct}% occupancy`] },
      }
    })
  }, [live, t, TOTAL_UNITS])

  // Revenue by room type (confirmed, all time)
  const byRoom = useMemo(() => {
    return rooms
      .map((r) => {
        const bs = live.filter((b) => b.roomId === r.id)
        const value = bs.reduce((s, b) => s + (b.total || 0), 0)
        return {
          key: r.id, label: r.name, value, valueLabel: shortLKR(value), count: bs.length,
          tip: { title: r.name, lines: [formatLKR(value), `${bs.length} booking${bs.length === 1 ? '' : 's'}`] },
        }
      })
      .sort((a, b) => b.value - a.value)
  }, [live, rooms])

  const arrivals = live.filter((b) => b.checkIn === t)
  const departures = live.filter((b) => b.checkOut === t)
  const inHouse = live.filter((b) => b.checkIn <= t && b.checkOut > t)
  const recent = bookings.slice(0, 6)
  const tonight = occupancy[0]

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Overview</h1>
          <p className="muted">{prettyDate(t)}</p>
        </div>
        <div className="admin-filters" role="tablist" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.key} role="tab" aria-selected={period === p.key}
              className={`chip ${period === p.key ? 'is-active' : ''}`} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-stats">
        <div><CalendarDays size={20} /><strong>{kpi.count}</strong><span>Bookings made</span></div>
        <div><Wallet size={20} /><strong>{shortLKR(kpi.revenue)}</strong><span>Booked revenue</span></div>
        <div><BedDouble size={20} /><strong>{kpi.avgStay.toFixed(1)}</strong><span>Avg. nights per stay</span></div>
        <div><XCircle size={20} /><strong>{kpi.cancelRate}%</strong><span>Cancellation rate</span></div>
      </div>

      <div className="admin-grid">
        <div className="admin-card admin-card--wide">
          <div className="admin-card-head">
            <div>
              <h3>Occupancy, next 14 nights</h3>
              <p className="muted small">Share of all {TOTAL_UNITS} rooms booked each night</p>
            </div>
            <div className="hero-num">
              <strong>{tonight.value}%</strong>
              <span>tonight · {tonight.booked}/{TOTAL_UNITS} rooms</span>
            </div>
          </div>
          <ColumnChart title="Occupancy for the next 14 nights" data={occupancy} format={(v) => `${v}%`} />
          <DataTable columns={['Night', 'Rooms booked', 'Occupancy']} rows={occupancy.map((o) => [prettyDate(o.key), `${o.booked} / ${TOTAL_UNITS}`, `${o.value}%`])} />
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <div>
              <h3>Revenue by room</h3>
              <p className="muted small">Confirmed bookings, all time</p>
            </div>
          </div>
          <BarList title="Revenue by room type" data={byRoom} />
          <DataTable columns={['Room', 'Bookings', 'Revenue']} rows={byRoom.map((r) => [r.label, r.count, formatLKR(r.value)])} />
        </div>

        <div className="admin-card">
          <div className="admin-card-head"><h3>Today</h3></div>
          <div className="today-cols">
            <TodayList icon={LogIn} title="Arriving" items={arrivals} empty="No arrivals today" detail={(b) => `${b.roomName} · ${b.guest?.arrival ? 'ETA ' + b.guest.arrival : ''}`} />
            <TodayList icon={LogOut} title="Departing" items={departures} empty="No departures today" detail={(b) => b.roomName} />
          </div>
          <p className="muted small today-foot"><BedDouble size={14} /> {inHouse.length} stay{inHouse.length === 1 ? '' : 's'} in-house tonight</p>
        </div>

        <div className="admin-card admin-card--wide">
          <div className="admin-card-head">
            <h3>Latest bookings</h3>
            <Link to="/admin/bookings" className="link-arrow">All bookings <ArrowRight size={15} /></Link>
          </div>
          {recent.length === 0 ? (
            <p className="muted">No bookings yet.</p>
          ) : (
            <ul className="recent-list">
              {recent.map((b) => (
                <li key={b.ref} className={b.status !== 'Confirmed' ? 'is-cancelled' : ''}>
                  <span className="mono">{b.ref}</span>
                  <span><strong>{guestName(b)}</strong><small className="muted">{b.roomName}</small></span>
                  <span className="muted small">{prettyDate(b.checkIn)} · {b.nights}n</span>
                  <strong>{formatLKR(b.total)}</strong>
                  <span className={`status ${b.status === 'Confirmed' ? 'status--ok' : 'status--bad'}`}>{b.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

function TodayList({ icon: Icon, title, items, empty, detail }) {
  return (
    <div>
      <h4><Icon size={15} /> {title} <span className="count">{items.length}</span></h4>
      {items.length === 0 ? <p className="muted small">{empty}</p> : (
        <ul className="today-list">
          {items.map((b) => (
            <li key={b.ref}><strong>{guestName(b)}</strong><small className="muted">{detail(b)}</small></li>
          ))}
        </ul>
      )}
    </div>
  )
}
