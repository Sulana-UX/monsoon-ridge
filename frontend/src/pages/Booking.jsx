import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  User, Mail, Phone, Globe, Clock, MessageSquare, CreditCard, Building, Lock,
  Check, CalendarDays, Users, ChevronLeft, ShieldCheck,
} from 'lucide-react'
import { useRooms } from '../context/RoomsContext'
import { useAvailability } from '../lib/useAvailability'
import { useBooking } from '../context/BookingContext'
import { useAuth } from '../context/AuthContext'
import { api, friendlyError } from '../lib/firebase'
import { formatLKR, nightsBetween, prettyDate, priceBreakdown } from '../utils'
import NotFound from './NotFound'

const steps = ['Choose Room', 'Guest Details', 'Confirmation']

export default function Booking() {
  const { id } = useParams()
  const { rooms, loading: roomsLoading } = useRooms()
  const room = rooms.find((r) => r.id === id)
  const { search } = useBooking()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [payment, setPayment] = useState('hotel')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [first = '', ...rest] = (user?.displayName || '').trim().split(/\s+/)
  const [form, setForm] = useState({
    firstName: first, lastName: rest.join(' '), email: user?.email || '', phone: '', country: 'Sri Lanka',
    arrival: '14:00', requests: '', agree: false,
  })

  // The free API server sleeps when idle: wake it while the guest fills in the form
  useEffect(() => { api.wake() }, [])
  const { available } = useAvailability(search.checkIn, search.checkOut)

  if (!room) return roomsLoading ? <div className="page-loading"><span className="spinner" /></div> : <NotFound />

  const nights = nightsBetween(search.checkIn, search.checkOut)
  const price = priceBreakdown(room.price, nights)
  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const validate = () => {
    const e = {}
    if (!form.firstName.trim()) e.firstName = 'Required'
    if (!form.lastName.trim()) e.lastName = 'Required'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email'
    if (form.phone.replace(/\D/g, '').length < 9) e.phone = 'Enter a valid phone number'
    if (!form.agree) e.agree = 'Please accept the terms'
    if (nights < 1) e.dates = 'Please choose valid dates'
    else if (search.guests > room.guests) e.dates = `${room.name} sleeps up to ${room.guests} guests`
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    if (submitting || !validate()) return
    setSubmitting(true)
    setServerError('')
    try {
      // The server re-checks everything and sets the price itself
      const { agree, ...guest } = form // eslint-disable-line no-unused-vars
      const { data } = await api.createBooking({
        roomId: room.id,
        checkIn: search.checkIn,
        checkOut: search.checkOut,
        guests: search.guests,
        payment,
        guest,
      })
      navigate(`/confirmation/${data.ref}`)
    } catch (err) {
      setServerError(friendlyError(err))
      setSubmitting(false)
    }
  }

  const Field = ({ name, label, icon: Icon, type = 'text', placeholder, half }) => (
    <label className={`field ${half ? 'field--half' : ''} ${errors[name] ? 'has-error' : ''}`}>
      <span>{label}</span>
      <div className="input-wrap">
        <Icon size={17} />
        <input type={type} value={form[name]} onChange={set(name)} placeholder={placeholder} />
      </div>
      {errors[name] && <small className="err">{errors[name]}</small>}
    </label>
  )

  return (
    <section className="section booking-page">
      <div className="container">
        <Link to={`/rooms/${room.id}`} className="back-link"><ChevronLeft size={16} /> Back to room</Link>

        <div className="stepper">
          {steps.map((s, i) => (
            <div key={s} className={`step ${i < 1 ? 'is-done' : ''} ${i === 1 ? 'is-current' : ''}`}>
              <span className="step-dot">{i < 1 ? <Check size={14} /> : i + 1}</span>
              <span className="step-label">{s}</span>
            </div>
          ))}
        </div>

        <div className="booking-layout">
          <form className="booking-form" onSubmit={submit} noValidate>
            <div className="card">
              <h2>Guest details</h2>
              <p className="muted">Tell us who is checking in. We will send the confirmation to your email.</p>
              <div className="form-grid">
                {Field({ name: 'firstName', label: 'First name', icon: User, placeholder: 'Kasun', half: true })}
                {Field({ name: 'lastName', label: 'Last name', icon: User, placeholder: 'Perera', half: true })}
                {Field({ name: 'email', label: 'Email address', icon: Mail, type: 'email', placeholder: 'you@example.com', half: true })}
                {Field({ name: 'phone', label: 'Phone number', icon: Phone, type: 'tel', placeholder: '+94 77 123 4567', half: true })}
                <label className="field field--half">
                  <span>Country</span>
                  <div className="input-wrap">
                    <Globe size={17} />
                    <select value={form.country} onChange={set('country')}>
                      {['Sri Lanka', 'India', 'United Kingdom', 'United States', 'Australia', 'Germany', 'Other'].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </label>
                <label className="field field--half">
                  <span>Estimated arrival</span>
                  <div className="input-wrap">
                    <Clock size={17} />
                    <input type="time" value={form.arrival} onChange={set('arrival')} />
                  </div>
                </label>
                <label className="field">
                  <span>Special requests <em>(optional)</em></span>
                  <div className="input-wrap input-wrap--area">
                    <MessageSquare size={17} />
                    <textarea rows={3} value={form.requests} onChange={set('requests')} placeholder="Early check-in, anniversary decoration, dietary needs..." />
                  </div>
                </label>
              </div>
            </div>

            <div className="card">
              <h2>Payment method</h2>
              <div className="pay-options">
                <label className={`pay ${payment === 'hotel' ? 'is-active' : ''}`}>
                  <input type="radio" name="pay" checked={payment === 'hotel'} onChange={() => setPayment('hotel')} />
                  <Building size={22} />
                  <span><strong>Pay at hotel</strong><small>No prepayment needed</small></span>
                </label>
                <label className={`pay ${payment === 'card' ? 'is-active' : ''}`}>
                  <input type="radio" name="pay" checked={payment === 'card'} onChange={() => setPayment('card')} />
                  <CreditCard size={22} />
                  <span><strong>Pay now by card</strong><small>Visa, Mastercard, Amex</small></span>
                </label>
              </div>
              {payment === 'card' && (
                <div className="card-preview">
                  <Lock size={16} /> Secure card payment will be connected with the backend. No card details are collected in this UI preview.
                </div>
              )}
            </div>

            <label className={`agree ${errors.agree ? 'has-error' : ''}`}>
              <input type="checkbox" checked={form.agree} onChange={set('agree')} />
              <span>I agree to the hotel's booking terms and cancellation policy.</span>
            </label>
            {errors.dates && <p className="err">{errors.dates}</p>}
            {available?.[room.id] === 0 && (
              <p className="auth-msg auth-msg--err" role="alert">
                Sorry, this room is sold out for these dates. <Link to="/rooms">Choose another room</Link> or change your dates.
              </p>
            )}
            {serverError && <p className="auth-msg auth-msg--err" role="alert">{serverError}</p>}

            <button type="submit" className="btn btn-gold btn-lg btn-block" disabled={submitting || available?.[room.id] === 0}>
              {submitting ? <><span className="spinner spinner--sm" /> Confirming…</> : <><ShieldCheck size={18} /> Confirm Booking · {formatLKR(price.total)}</>}
            </button>
          </form>

          <aside className="summary">
            <div className="summary-img" style={{ backgroundImage: `url(${room.image})` }}>
              <span className="badge">{room.type}</span>
            </div>
            <div className="summary-body">
              <h3>{room.name}</h3>
              <p className="muted">{room.beds} · {room.size} m²</p>
              <div className="summary-dates">
                <div><CalendarDays size={16} /><span><small>Check-in</small>{prettyDate(search.checkIn)}</span></div>
                <div><CalendarDays size={16} /><span><small>Check-out</small>{prettyDate(search.checkOut)}</span></div>
                <div><Users size={16} /><span><small>Guests</small>{search.guests} guest{search.guests > 1 ? 's' : ''} · {nights} night{nights !== 1 ? 's' : ''}</span></div>
              </div>
              <div className="price-lines">
                <div><span>{formatLKR(room.price)} × {nights}</span><span>{formatLKR(price.subtotal)}</span></div>
                <div><span>Service charge</span><span>{formatLKR(price.service)}</span></div>
                <div><span>Taxes</span><span>{formatLKR(price.tax)}</span></div>
                <div className="total"><span>Total</span><span>{formatLKR(price.total)}</span></div>
              </div>
              <div className="perk"><ShieldCheck size={16} /> Free cancellation until 48 hours before check-in</div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
