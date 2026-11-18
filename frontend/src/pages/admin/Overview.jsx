import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { CalendarDays, Wallet, Moon, XCircle, LogIn, LogOut, ArrowRight, BedDouble, Coffee } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { addDays, formatLKR, prettyDate, today } from '../../utils'
import { ColumnChart, BarList, DataTable } from './BarChart'
import { Person } from './Avatar'
import FrontDeskButtons from './FrontDesk'
import { isLive, occupies, statusClass, statusLabel, guestName } from '../../lib/status'

const PERIODS = [
  { key: 7, label: '7 days' },
  { key: 30, label: '30 days' },
  { key: 0, label: 'All time' },
]
const DAY = 86400000
const shortLKR = (n) => (n >= 1e6 ? `LKR ${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `LKR ${Math.round(n / 1e3)}k` : formatLKR(n))
const dayLabel = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })

const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Colombo' }).format(new Date()))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** Numbers for bookings MADE between `from` and `to` (ms). */
function stats(bookings, from, to) {
  const made = bookings.filter((b) => {
    const t = b.createdAt?.getTime() ?? Date.now()
    return t >= from && t < to
  })
  const ok = made.filter(isLive)
  const nights = ok.reduce((s, b) => s + b.nights, 0)
  return {
    count: ok.length,
    revenue: ok.reduce((s, b) => s + (b.total || 0), 0),
    avgStay: ok.length ? nights / ok.length : 0,
    cancelRate: made.length ? Math.round(((made.length - ok.length) / made.length) * 100) : 0,
  }
}

/** "↑ 12% vs previous 30 days" (percent change) or "↑ 0.4" (point change). */
function Delta({ now, prev, period, points = false, lowerIsBetter = false, digits = 0 }) {
  if (!period) return <div className="kpi-delta">Since the hotel opened online</div>
  const diff = now - prev
  if (!points && prev === 0) return <div className="kpi-delta">{now ? 'New this period' : 'No change'} · prev. {period} days</div>
  const value = points ? Math.abs(diff).toFixed(digits) : `${Math.round(Math.abs(diff / prev) * 100)}%`
  if (Math.abs(diff) < 1e-9) return <div className="kpi-delta">No change vs previous {period} days</div>
  const good = lowerIsBetter ? diff < 0 : diff > 0
  return (
    <div className="kpi-delta">
      <b className={good ? 'up' : 'down'}>{diff > 0 ? '↑' : '↓'} {value}{points && !digits ? ' pts' : ''}</b> vs previous {period} days
    </div>
  )
}

export default function Overview() {
  const { bookings, rooms } = useOutletContext()
  const { user } = useAuth()
  const TOTAL_UNITS = rooms.filter((r) => r.active !== false).reduce((s, r) => s + (r.units || 0), 0)
  const [period, setPeriod] = useState(30)
  const t = today()
  const live = useMemo(() => bookings.filter(isLive), [bookings])

  const { cur, prev } = useMemo(() => {
    const now = Date.now()
    if (!period) return { cur: stats(bookings, 0, Infinity), prev: null }
    return {
      cur: stats(bookings, now - period * DAY, Infinity),
      prev: stats(bookings, now - 2 * period * DAY, now - period * DAY),
    }
  }, [bookings, period])

  // Rooms occupied each night for the next 14 nights
  const occupancy = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = addDays(t, i)
    const booked = live.filter((b) => occupies(b, d)).length
    const pct = TOTAL_UNITS ? Math.round((booked / TOTAL_UNITS) * 100) : 0
    return {
      key: d, label: dayLabel(d), value: pct, booked,
      tip: { title: prettyDate(d), lines: [`${booked} of ${TOTAL_UNITS} rooms booked`, `${pct}% occupancy`] },
    }
  }), [live, t, TOTAL_UNITS])

  // Revenue by room type (confirmed, all time)
  const byRoom = useMemo(() => rooms
    .map((r) => {
      const bs = live.filter((b) => b.roomId === r.id)
      const value = bs.reduce((s, b) => s + (b.total || 0), 0)
      return {
        key: r.id, label: r.name, value, valueLabel: shortLKR(value), count: bs.length,
        tip: { title: r.name, lines: [formatLKR(value), `${bs.length} booking${bs.length === 1 ? '' : 's'}`] },
      }
    })
    .sort((a, b) => b.value - a.value), [live, rooms])

  // Front desk: who's due today, who has actually arrived / left
  const arrivals = bookings.filter((b) => b.checkIn === t && (b.status === 'Confirmed' || b.status === 'CheckedIn'))
  const departures = bookings.filter((b) => b.checkOut === t && (b.status === 'CheckedIn' || b.status === 'CheckedOut'))
  const inHouse = bookings.filter((b) => b.status === 'CheckedIn')
  const expected = bookings.filter((b) => b.status === 'Confirmed' && b.checkIn < t && b.checkOut > t)
  const recent = bookings.slice(0, 6)
  const tonight = occupancy[0]
  const first = (user.displayName || '').split(' ')[0]

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow">Overview</span>
          <h1>{greeting()}{first ? `, ${first}` : ''}</h1>
          <p>Here's how Monsoon Ridge is doing{period ? ` over the last ${period} days` : ''}.</p>
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
        <div className="kpi kpi--hero">
          <div className="kpi-top"><span className="kpi-icon"><Wallet size={20} /></span></div>
          <span className="kpi-label">Booked revenue</span>
          <span className="kpi-value">{shortLKR(cur.revenue)}</span>
          <Delta now={cur.revenue} prev={prev?.revenue} period={period} />
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-icon"><CalendarDays size={20} /></span></div>
          <span className="kpi-label">Bookings made</span>
          <span className="kpi-value">{cur.count}</span>
          <Delta now={cur.count} prev={prev?.count} period={period} />
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-icon kpi-icon--teal"><Moon size={20} /></span></div>
          <span className="kpi-label">Avg. nights per stay</span>
          <span className="kpi-value">{cur.avgStay.toFixed(1)}</span>
          <Delta now={cur.avgStay} prev={prev?.avgStay} period={period} points digits={1} />
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-icon kpi-icon--teal"><XCircle size={20} /></span></div>
          <span className="kpi-label">Cancellation rate</span>
          <span className="kpi-value">{cur.cancelRate}%</span>
          <Delta now={cur.cancelRate} prev={prev?.cancelRate} period={period} points lowerIsBetter />
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-card admin-card--wide">
          <div className="admin-card-head">
            <div>
              <h3>Occupancy, next 14 nights</h3>
              <p className="muted small">Share of all {TOTAL_UNITS} rooms booked each night</p>
            </div>
            <div className="hero-num">
              <strong>{tonight.value}%</strong>
              <span>Tonight · {tonight.booked}/{TOTAL_UNITS} rooms</span>
            </div>
          </div>
          <ColumnChart title="Occupancy for the next 14 nights" data={occupancy} format={(v) => `${v}%`} />
          <DataTable columns={['Night', 'Rooms booked', 'Occupancy']} rows={occupancy.map((o) => [prettyDate(o.key), `${o.booked} / ${TOTAL_UNITS}`, `${o.value}%`])} />
        </section>

        <section className="admin-card admin-card--7">
          <div className="admin-card-head">
            <div>
              <h3>Revenue by room</h3>
              <p className="muted small">Confirmed bookings, all time</p>
            </div>
          </div>
          <BarList title="Revenue by room type" data={byRoom} />
          <DataTable columns={['Room', 'Bookings', 'Revenue']} rows={byRoom.map((r) => [r.label, r.count, formatLKR(r.value)])} />
        </section>

        <section className="admin-card admin-card--5">
          <div className="admin-card-head">
            <div>
              <h3>Today at the hotel</h3>
              <p className="muted small">{prettyDate(t)}</p>
            </div>
          </div>
          <div className="today-cols">
            <TodayList icon={LogIn} title="Arriving" items={arrivals} empty="No arrivals today" action="check-in" doneStatus="CheckedIn" doneLabel="Arrived"
              detail={(b) => `${b.roomName}${b.guest?.arrival ? ' · ETA ' + b.guest.arrival : ''}`} />
            <TodayList icon={LogOut} title="Departing" items={departures} empty="No departures today" action="check-out" doneStatus="CheckedOut" doneLabel="Left" detail={(b) => b.roomName} />
          </div>
          <p className="today-foot"><BedDouble size={16} /> {inHouse.length} guest{inHouse.length === 1 ? '' : 's'} checked in{expected.length > 0 && <span> · {expected.length} late arrival{expected.length === 1 ? '' : 's'} not checked in yet</span>}</p>
        </section>

        <section className="admin-card admin-card--wide">
          <div className="admin-card-head">
            <div>
              <h3>Latest bookings</h3>
              <p className="muted small">The six most recent reservations</p>
            </div>
            <Link to="/admin/bookings" className="link-arrow">All bookings <ArrowRight size={15} /></Link>
          </div>
          {recent.length === 0 ? (
            <p className="today-empty"><Coffee size={16} /> No bookings yet. They'll appear here the moment a guest books.</p>
          ) : (
            <ul className="recent-list">
              {recent.map((b) => (
                <li key={b.ref} className={isLive(b) ? '' : 'is-cancelled'}>
                  <Link to={`/admin/bookings/${b.ref}`} className="recent-person"><Person name={guestName(b)} detail={b.roomName} /></Link>
                  <span className="mono small muted">{b.ref}</span>
                  <span className="small muted">{prettyDate(b.checkIn)} · {b.nights} night{b.nights === 1 ? '' : 's'}</span>
                  <span className="recent-amount">{formatLKR(b.total)}</span>
                  <span className={statusClass(b.status)}>{statusLabel(b.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}

function TodayList({ icon: Icon, title, items, empty, detail, action, doneStatus, doneLabel }) {
  return (
    <div>
      <h4><Icon size={15} /> {title} <span className="count">{items.length}</span></h4>
      {items.length === 0 ? <p className="today-empty">{empty}</p> : (
        <ul className="today-list">
          {items.map((b) => (
            <li key={b.ref} className="today-item">
              <Link to={`/admin/bookings/${b.ref}`}><Person name={guestName(b)} detail={detail(b)} /></Link>
              {b.status === doneStatus
                ? <span className="today-done">✓ {doneLabel}</span>
                : <FrontDeskButtons booking={b} only={[action]} compact />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
