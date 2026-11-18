import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Wallet, Moon, BedDouble, Tag, Trophy, CalendarDays } from 'lucide-react'
import { ColumnChart, BarList, DataTable } from './BarChart'
import { isLive } from '../../lib/status'
import { addDays, formatLKR, prettyDate, today } from '../../utils'

/*
 * Revenue report for one year.
 * Revenue is counted on the NIGHT it is earned (a 3-night stay over 31 Dec
 * is split across both years), using each night's own rate when the booking
 * has per-night prices (seasons / weekends). Totals include service charge & tax.
 * Cancelled bookings and no-shows are not counted.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] // Monday first
const dowOf = (iso) => (new Date(iso + 'T00:00:00').getDay() + 6) % 7

// 1250000 → 1.25M, 2500000 → 2.5M, 18000000 → 18M, 850000 → 850k
const short = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(n >= 1e7 ? 0 : 2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`)
const shortLKR = (n) => `LKR ${short(n)}`
/** A round axis maximum: 1, 2, 2.5 or 5 × 10^k, at least the data maximum */
const niceMax = (v) => {
  if (v <= 0) return 100000
  const p = 10 ** Math.floor(Math.log10(v))
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)
}

/** Every night of a booking with the money it earned that night. */
function nightsWithRevenue(b) {
  const out = []
  const nightly = b.price?.nightly
  const rooms = b.price?.rooms ?? b.total
  for (let i = 0; i < b.nights; i++) {
    const date = nightly?.[i]?.date || addDays(b.checkIn, i)
    const share = nightly?.length && rooms ? nightly[i].rate / rooms : 1 / b.nights
    // an early check-out still pays the locked price, but the room was empty after it
    const stayed = !(b.checkOutActual && date >= b.checkOutActual)
    out.push({ date, revenue: b.total * share, stayed })
  }
  return out
}

export default function Reports() {
  const { bookings, rooms } = useOutletContext()
  const t = today()
  const thisYear = Number(t.slice(0, 4))
  const years = useMemo(() => {
    const ys = new Set([thisYear])
    bookings.forEach((b) => ys.add(Number(b.checkIn.slice(0, 4))))
    return [...ys].sort()
  }, [bookings, thisYear])
  const [year, setYear] = useState(thisYear)

  const units = rooms.filter((r) => r.active !== false).reduce((s, r) => s + (r.units || 0), 0)

  const r = useMemo(() => {
    const y = String(year)
    const months = MONTHS.map((label, i) => ({ key: label, label, i, revenue: 0, nights: 0, bookings: new Set() }))
    const byRoom = {}
    const dow = DOW.map((label) => ({ label, nights: 0 }))
    const byDate = {}
    let revenue = 0
    let roomNights = 0
    let discount = 0
    let promoCount = 0
    const counted = new Set()

    for (const b of bookings) {
      if (!isLive(b)) continue
      for (const n of nightsWithRevenue(b)) {
        if (!n.date.startsWith(y)) continue
        const m = months[Number(n.date.slice(5, 7)) - 1]
        m.revenue += n.revenue
        m.bookings.add(b.ref)
        revenue += n.revenue
        const room = (byRoom[b.roomId] ||= { key: b.roomId, label: b.roomName, revenue: 0, nights: 0, bookings: new Set() })
        room.revenue += n.revenue
        room.bookings.add(b.ref)
        if (n.stayed) {
          m.nights++
          room.nights++
          roomNights++
          dow[dowOf(n.date)].nights++
          byDate[n.date] = (byDate[n.date] || 0) + 1
        }
        if (!counted.has(b.ref)) {
          counted.add(b.ref)
          if (b.price?.discount > 0) { discount += b.price.discount; promoCount++ }
        }
      }
    }

    // How many of each weekday the year has, for a fair occupancy %
    const dowDays = Array(7).fill(0)
    const daysInYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365
    for (let i = 0, d = `${y}-01-01`; i < daysInYear; i++, d = addDays(d, 1)) dowDays[dowOf(d)]++

    return {
      months,
      rooms: Object.values(byRoom).sort((a, b) => b.revenue - a.revenue),
      dow: dow.map((d, i) => ({ ...d, occ: units ? Math.round((d.nights / (units * dowDays[i])) * 100) : 0 })),
      busiest: Object.entries(byDate).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5),
      revenue, roomNights, discount, promoCount,
      adr: roomNights ? revenue / roomNights : 0,
      occupancy: units ? (roomNights / (units * daysInYear)) * 100 : 0,
      bookings: counted.size,
      daysInYear,
    }
  }, [bookings, year, units])

  const max = niceMax(Math.max(...r.months.map((m) => m.revenue)))
  const best = r.months.reduce((a, m) => (m.revenue > a.revenue ? m : a), r.months[0])
  const dowMax = Math.max(25, Math.ceil(Math.max(...r.dow.map((d) => d.occ)) / 25) * 25)
  const topDow = r.dow.reduce((a, d) => (d.occ > a.occ ? d : a), r.dow[0])

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow">Reports</span>
          <h1>Revenue report</h1>
          <p>Money earned on each night of {year}, including service charge and tax. Cancellations and no-shows are left out.</p>
        </div>
        <div className="admin-filters" role="tablist" aria-label="Year">
          {years.map((y) => (
            <button key={y} role="tab" aria-selected={year === y} className={`chip ${year === y ? 'is-active' : ''}`} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>
      </div>

      <div className="admin-stats">
        <div className="kpi kpi--hero">
          <div className="kpi-top"><span className="kpi-icon"><Wallet size={20} /></span></div>
          <span className="kpi-label">Revenue {year}</span>
          <span className="kpi-value">{shortLKR(r.revenue)}</span>
          <div className="kpi-delta">{r.bookings} booking{r.bookings === 1 ? '' : 's'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-icon"><Moon size={20} /></span></div>
          <span className="kpi-label">Room-nights sold</span>
          <span className="kpi-value">{r.roomNights}</span>
          <div className="kpi-delta">{r.occupancy.toFixed(1)}% of all {units} rooms × {r.daysInYear} nights</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-icon kpi-icon--teal"><BedDouble size={20} /></span></div>
          <span className="kpi-label">Average per room-night</span>
          <span className="kpi-value">{shortLKR(r.adr)}</span>
          <div className="kpi-delta">Revenue ÷ room-nights</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-icon kpi-icon--teal"><Tag size={20} /></span></div>
          <span className="kpi-label">Promo discounts</span>
          <span className="kpi-value">{shortLKR(r.discount)}</span>
          <div className="kpi-delta">{r.promoCount} booking{r.promoCount === 1 ? '' : 's'} used a code</div>
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-card admin-card--wide">
          <div className="admin-card-head">
            <div>
              <h3>Revenue per month</h3>
              <p className="muted small">LKR earned on nights in each month of {year}</p>
            </div>
            {best.revenue > 0 && (
              <div className="hero-num">
                <strong>{shortLKR(best.revenue)}</strong>
                <span>Best month · {best.label}</span>
              </div>
            )}
          </div>
          <ColumnChart
            title={`Revenue per month, ${year}`}
            max={max} ticks={[0, max / 2, max]} format={short} height={220}
            data={r.months.map((m) => ({
              key: m.key, label: m.label, value: m.revenue,
              tip: { title: `${m.label} ${year}`, lines: [formatLKR(m.revenue), `${m.nights} room-night${m.nights === 1 ? '' : 's'} · ${m.bookings.size} booking${m.bookings.size === 1 ? '' : 's'}`] },
            }))}
          />
          <DataTable columns={['Month', 'Revenue', 'Room-nights', 'Bookings']}
            rows={r.months.map((m) => [`${m.label} ${year}`, formatLKR(m.revenue), m.nights, m.bookings.size])} />
        </section>

        <section className="admin-card admin-card--7">
          <div className="admin-card-head">
            <div>
              <h3><Trophy size={18} /> Best room types</h3>
              <p className="muted small">Ranked by revenue in {year}</p>
            </div>
          </div>
          {r.rooms.length === 0 ? <p className="today-empty">No stays in {year} yet.</p> : (
            <BarList title={`Revenue by room type, ${year}`} data={r.rooms.map((x) => ({
              key: x.key, label: x.label, value: x.revenue, valueLabel: shortLKR(x.revenue),
              tip: { title: x.label, lines: [formatLKR(x.revenue), `${x.nights} room-nights · ${x.bookings.size} bookings`, `Avg ${formatLKR(x.nights ? x.revenue / x.nights : 0)} / night`] },
            }))} />
          )}
          <DataTable columns={['Room', 'Revenue', 'Room-nights', 'Bookings', 'Avg / night']}
            rows={r.rooms.map((x) => [x.label, formatLKR(x.revenue), x.nights, x.bookings.size, formatLKR(x.nights ? x.revenue / x.nights : 0)])} />
        </section>

        <section className="admin-card admin-card--5">
          <div className="admin-card-head">
            <div>
              <h3><CalendarDays size={18} /> Busiest days</h3>
              <p className="muted small">Average occupancy by night of the week</p>
            </div>
            {topDow.occ > 0 && <div className="hero-num"><strong>{topDow.occ}%</strong><span>{topDow.label} nights</span></div>}
          </div>
          <ColumnChart
            title={`Occupancy by night of the week, ${year}`}
            max={dowMax} ticks={[0, dowMax / 2, dowMax]} format={(v) => `${v}%`} height={180}
            data={r.dow.map((d) => ({ key: d.label, label: d.label, value: d.occ, tip: { title: `${d.label} nights`, lines: [`${d.occ}% occupied`, `${d.nights} room-nights in ${year}`] } }))}
          />
          {r.busiest.length > 0 && (
            <>
              <h4 className="report-sub">Busiest dates</h4>
              <ol className="busiest-list">
                {r.busiest.map(([d, n]) => (
                  <li key={d}><span>{prettyDate(d)}</span><span className="muted small">{n} / {units} rooms</span></li>
                ))}
              </ol>
            </>
          )}
          <DataTable columns={['Night', 'Occupancy', 'Room-nights']} rows={r.dow.map((d) => [d.label, `${d.occ}%`, d.nights])} />
        </section>
      </div>
    </>
  )
}
