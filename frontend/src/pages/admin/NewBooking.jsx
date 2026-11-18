import { useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { ChevronLeft, Footprints, PhoneCall, Save, CheckCircle2, AlertTriangle, Tag } from 'lucide-react'
import { api, friendlyError } from '../../lib/firebase'
import { useAvailability } from '../../lib/useAvailability'
import { addDays, formatLKR, nightsBetween, today } from '../../utils'
import { useQuote } from '../../lib/useQuote'
import PriceLines from '../../components/PriceLines'

const COUNTRIES = ['Sri Lanka', 'India', 'United Kingdom', 'United States', 'Australia', 'Germany', 'Other']

export default function NewBooking() {
  const { rooms } = useOutletContext()
  const navigate = useNavigate()
  const t = today()
  const bookable = useMemo(() => rooms.filter((r) => r.active !== false && r.units > 0), [rooms])

  const [f, setF] = useState({
    source: 'walk-in', roomId: bookable[0]?.id || '', checkIn: t, checkOut: addDays(t, 1), guests: 2,
    firstName: '', lastName: '', phone: '', email: '', country: 'Sri Lanka', arrival: '', requests: '',
    payment: 'hotel', checkInNow: true, promo: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const room = rooms.find((r) => r.id === f.roomId)
  const nights = nightsBetween(f.checkIn, f.checkOut)
  const { quote: price, promoError, loading: quoting } = useQuote(room, f.checkIn, f.checkOut, f.promo)
  const { available, loading: availLoading } = useAvailability(f.checkIn, f.checkOut)
  const left = available?.[f.roomId]
  const startsToday = f.checkIn === t
  const tooMany = room && Number(f.guests) > room.guests

  const problem =
    !room ? 'Choose a room.'
      : nights < 1 ? 'Check-out must be after check-in.'
        : tooMany ? `${room.name} sleeps up to ${room.guests} guests.`
          : left === 0 ? `${room.name} is sold out for these dates.`
            : f.promo && promoError && !quoting ? promoError
            : ''

  const submit = async (e) => {
    e.preventDefault()
    if (problem) return setErr(problem)
    if (!f.firstName.trim() || !f.lastName.trim()) return setErr("Enter the guest's first and last name.")
    if (f.phone.replace(/\D/g, '').length < 9) return setErr('Enter a valid phone number.')
    setBusy(true)
    setErr('')
    try {
      const { data } = await api.createStaffBooking({
        source: f.source,
        roomId: f.roomId, checkIn: f.checkIn, checkOut: f.checkOut, guests: Number(f.guests), payment: f.payment,
        ...(f.promo && { promo: f.promo }),
        checkInNow: f.source === 'walk-in' && startsToday && f.checkInNow,
        guest: {
          firstName: f.firstName, lastName: f.lastName, phone: f.phone, email: f.email.trim(),
          country: f.country, arrival: f.arrival, requests: f.requests,
        },
      })
      navigate(`/admin/bookings/${data.ref}`, { replace: true })
    } catch (e2) {
      setErr(friendlyError(e2))
      setBusy(false)
    }
  }

  return (
    <form className="room-editor new-booking" onSubmit={submit} noValidate>
      <Link to="/admin/bookings" className="back-link"><ChevronLeft size={16} /> All bookings</Link>
      <div className="admin-head">
        <div>
          <span className="eyebrow">Front desk</span>
          <h1>New booking</h1>
          <p>For a guest who walks in or calls. They don't need an account.</p>
        </div>
      </div>

      <div className="editor-grid">
        <div className="editor-main">
          <section className="admin-card">
            <h3>How did the guest book?</h3>
            <div className="source-pick">
              {[['walk-in', Footprints, 'Walk-in', 'At the front desk'], ['phone', PhoneCall, 'Phone', 'Called the hotel']].map(([v, Icon, label, sub]) => (
                <label key={v} className={`source-opt ${f.source === v ? 'is-on' : ''}`}>
                  <input type="radio" name="source" value={v} checked={f.source === v} onChange={set('source')} />
                  <Icon size={22} /><span><strong>{label}</strong><small>{sub}</small></span>
                </label>
              ))}
            </div>
          </section>

          <section className="admin-card">
            <h3>Stay</h3>
            <div className="form-grid">
              <label className="field"><span>Room</span>
                <div className="input-wrap">
                  <select value={f.roomId} onChange={set('roomId')}>
                    {bookable.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.type} · {formatLKR(r.price)}/night</option>)}
                  </select>
                </div>
              </label>
              <label className="field field--half"><span>Check-in</span>
                <div className="input-wrap"><input type="date" min={t} value={f.checkIn}
                  onChange={(e) => setF((x) => ({ ...x, checkIn: e.target.value, checkOut: nightsBetween(e.target.value, x.checkOut) < 1 ? addDays(e.target.value, 1) : x.checkOut }))} /></div>
              </label>
              <label className="field field--half"><span>Check-out</span>
                <div className="input-wrap"><input type="date" min={addDays(f.checkIn, 1)} value={f.checkOut} onChange={set('checkOut')} /></div>
              </label>
              <label className="field field--half"><span>Guests</span>
                <div className="input-wrap"><input type="number" min={1} max={12} value={f.guests} onChange={set('guests')} /></div>
              </label>
              <div className="field field--half avail-box">
                <span>Availability</span>
                {availLoading ? <p className="muted small">Checking…</p>
                  : left == null ? <p className="muted small">Couldn't check. The server re-checks on save.</p>
                  : left === 0 ? <p className="avail-bad"><AlertTriangle size={16} /> Sold out</p>
                  : <p className="avail-good"><CheckCircle2 size={16} /> {left} of {room?.units} free</p>}
              </div>
            </div>
          </section>

          <section className="admin-card">
            <h3>Guest</h3>
            <div className="form-grid">
              <label className="field field--half"><span>First name</span>
                <div className="input-wrap"><input value={f.firstName} onChange={set('firstName')} maxLength={60} autoComplete="off" /></div></label>
              <label className="field field--half"><span>Last name</span>
                <div className="input-wrap"><input value={f.lastName} onChange={set('lastName')} maxLength={60} autoComplete="off" /></div></label>
              <label className="field field--half"><span>Phone</span>
                <div className="input-wrap"><input type="tel" value={f.phone} onChange={set('phone')} maxLength={25} placeholder="+94 77 123 4567" /></div></label>
              <label className="field field--half"><span>Email <em>(optional)</em></span>
                <div className="input-wrap"><input type="email" value={f.email} onChange={set('email')} maxLength={254} /></div></label>
              <label className="field field--half"><span>Country</span>
                <div className="input-wrap"><select value={f.country} onChange={set('country')}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></div></label>
              <label className="field field--half"><span>Arrival time <em>(optional)</em></span>
                <div className="input-wrap"><input type="time" value={f.arrival} onChange={set('arrival')} /></div></label>
              <label className="field"><span>Special requests <em>(optional)</em></span>
                <div className="input-wrap input-wrap--area"><textarea rows={2} value={f.requests} onChange={set('requests')} maxLength={500} /></div></label>
            </div>
          </section>
        </div>

        <aside className="editor-side">
          <section className="admin-card">
            <h3>Summary</h3>
            {price ? <PriceLines price={price} /> : <p className="muted small">Choose a room and dates.</p>}
            <label className="field nb-pay"><span><Tag size={14} /> Promo code <em>(optional)</em></span>
              <div className="input-wrap"><input value={f.promo} placeholder="e.g. MONSOON10" autoComplete="off"
                onChange={(e) => setF((x) => ({ ...x, promo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20) }))} /></div>
              {f.promo && !quoting && !promoError && price?.promo && <small className="promo-ok">{price.promo.percent}% off applied</small>}
            </label>
            <label className="field nb-pay"><span>Payment</span>
              <div className="input-wrap"><select value={f.payment} onChange={set('payment')}>
                <option value="hotel">Pay at hotel</option>
                <option value="card">Card</option>
              </select></div>
            </label>
            {f.source === 'walk-in' && startsToday && (
              <label className="switch-row">
                <input type="checkbox" checked={f.checkInNow} onChange={set('checkInNow')} />
                <span><strong>Check in now</strong><small>The guest is at the desk and gets the key now</small></span>
              </label>
            )}
          </section>

          {(err || problem) && <p className="auth-msg auth-msg--err" role="alert">{err || problem}</p>}
          <button type="submit" className="btn btn-gold btn-block" disabled={busy || !!problem}>
            {busy ? <span className="spinner spinner--sm" /> : <Save size={17} />} Create booking
          </button>
          <p className="muted small nb-note">Price and availability are checked again by the server when you save.</p>
        </aside>
      </div>
    </form>
  )
}
