import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Star, Users, Maximize, BedDouble, Eye, ChevronRight, Clock, Ban, PawPrint,
  CigaretteOff, ShieldCheck, ArrowRight,
} from 'lucide-react'
import Amenity from '../components/Amenity'
import RoomCard from '../components/RoomCard'
import Reveal from '../components/Reveal'
import { rooms } from '../data/rooms'
import { useBooking } from '../context/BookingContext'
import { addDays, formatLKR, nightsBetween, priceBreakdown, today } from '../utils'
import NotFound from './NotFound'

export default function RoomDetails() {
  const { id } = useParams()
  const room = rooms.find((r) => r.id === id)
  const { search, setSearch } = useBooking()
  const [active, setActive] = useState(0)
  const navigate = useNavigate()

  if (!room) return <NotFound />

  const nights = nightsBetween(search.checkIn, search.checkOut)
  const price = priceBreakdown(room.price, nights)
  const tooMany = search.guests > room.guests
  const others = rooms.filter((r) => r.id !== room.id).slice(0, 3)

  const update = (key, value) => {
    const next = { ...search, [key]: value }
    if (key === 'checkIn' && nightsBetween(value, next.checkOut) < 1) next.checkOut = addDays(value, 1)
    setSearch(next)
  }

  return (
    <>
      <div className="detail-top" />
      <section className="section section--tight">
        <div className="container">
          <div className="crumbs crumbs--dark">
            <Link to="/">Home</Link> <ChevronRight size={14} />
            <Link to="/rooms">Rooms</Link> <ChevronRight size={14} />
            <span>{room.name}</span>
          </div>

          <div className="detail-title">
            <div>
              <span className="badge badge--static">{room.type}</span>
              <h1>{room.name}</h1>
              <div className="detail-sub">
                <span className="rating"><Star size={15} fill="currentColor" /> {room.rating.toFixed(1)}</span>
                <span className="muted">({room.reviews} reviews)</span>
                <span className="dot" />
                <span className="muted">{room.view}</span>
              </div>
            </div>
            <div className="detail-price">
              <strong>{formatLKR(room.price)}</strong>
              <span>per night</span>
            </div>
          </div>

          <div className="gallery">
            <Reveal variant="wipe" className="gallery-main">
              <img key={active} src={room.gallery[active]} alt={room.name} />
            </Reveal>
            <div className="gallery-thumbs">
              {room.gallery.map((g, i) => (
                <button key={i} className={i === active ? 'is-active' : ''} onClick={() => setActive(i)}>
                  <img src={g} alt="" />
                </button>
              ))}
            </div>
          </div>

          <div className="detail-layout">
            <div className="detail-main">
              <div className="spec-row">
                <div className="spec"><Maximize size={22} /><span>Size</span><strong>{room.size} m²</strong></div>
                <div className="spec"><Users size={22} /><span>Guests</span><strong>Up to {room.guests}</strong></div>
                <div className="spec"><BedDouble size={22} /><span>Bed</span><strong>{room.beds}</strong></div>
                <div className="spec"><Eye size={22} /><span>View</span><strong>{room.view}</strong></div>
              </div>

              <div className="detail-block">
                <h2>About this room</h2>
                <p>{room.description}</p>
                <p>
                  Every stay includes daily housekeeping, evening turndown service, premium toiletries
                  and access to the infinity pool, fitness centre and riverside gardens.
                </p>
              </div>

              <div className="detail-block">
                <h2>Room amenities</h2>
                <div className="amenity-grid">
                  {room.amenities.map((a) => <Amenity key={a} id={a} />)}
                </div>
              </div>

              <div className="detail-block">
                <h2>House rules</h2>
                <div className="rules">
                  <div><Clock size={18} /><span>Check-in from <strong>2:00 PM</strong></span></div>
                  <div><Clock size={18} /><span>Check-out by <strong>12:00 PM</strong></span></div>
                  <div><CigaretteOff size={18} /><span>Non-smoking room</span></div>
                  <div><PawPrint size={18} /><span>Pets not allowed</span></div>
                  <div><Ban size={18} /><span>No parties or events</span></div>
                  <div><ShieldCheck size={18} /><span>Free cancellation up to 48h</span></div>
                </div>
              </div>
            </div>

            <aside className="booking-widget">
              <div className="bw-head">
                <strong>{formatLKR(room.price)}</strong> <span>/ night</span>
              </div>
              <div className="bw-dates">
                <label>
                  <span>Check-in</span>
                  <input type="date" min={today()} value={search.checkIn} onChange={(e) => update('checkIn', e.target.value)} />
                </label>
                <label>
                  <span>Check-out</span>
                  <input type="date" min={addDays(search.checkIn, 1)} value={search.checkOut} onChange={(e) => update('checkOut', e.target.value)} />
                </label>
                <label className="bw-full">
                  <span>Guests</span>
                  <select value={search.guests} onChange={(e) => update('guests', Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>)}
                  </select>
                </label>
              </div>

              {tooMany && <p className="warn">This room fits up to {room.guests} guests.</p>}

              <button
                className="btn btn-gold btn-block btn-lg"
                disabled={nights < 1 || tooMany}
                onClick={() => navigate(`/booking/${room.id}`)}
              >
                Reserve Now <ArrowRight size={18} />
              </button>
              <p className="bw-note">You won't be charged yet</p>

              {nights > 0 && (
                <div className="price-lines">
                  <div><span>{formatLKR(room.price)} × {nights} night{nights > 1 ? 's' : ''}</span><span>{formatLKR(price.subtotal)}</span></div>
                  <div><span>Service charge (10%)</span><span>{formatLKR(price.service)}</span></div>
                  <div><span>Taxes (8%)</span><span>{formatLKR(price.tax)}</span></div>
                  <div className="total"><span>Total</span><span>{formatLKR(price.total)}</span></div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </section>

      <section className="section section--tint">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">You may also like</span>
              <h2>Other rooms</h2>
            </div>
          </div>
          <div className="room-grid">
            {others.map((r, i) => (
              <Reveal key={r.id} variant="left" delay={i * 160}>
                <RoomCard room={r} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
