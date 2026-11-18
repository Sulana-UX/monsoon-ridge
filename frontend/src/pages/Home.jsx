import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Star, Quote, UtensilsCrossed, Sparkles, Waves, Dumbbell,
  Plane, Wifi, Leaf, ShieldCheck, Play, Sun, Moon,
} from 'lucide-react'
import SearchBar from '../components/SearchBar'
import NightScene from '../components/NightScene'
import RoomCard from '../components/RoomCard'
import Reveal from '../components/Reveal'
import ScrollGallery from '../components/ScrollGallery'
import { images, testimonials, galleryItems } from '../data/rooms'
import { useRooms } from '../context/RoomsContext'

const facilities = [
  { icon: UtensilsCrossed, title: 'Riverside Dining', text: 'Authentic Sri Lankan and international cuisine served on the water’s edge.' },
  { icon: Sparkles, title: 'Ayurveda Spa', text: 'Ancient healing rituals and modern therapies to restore body and mind.' },
  { icon: Waves, title: 'Lagoon Pool', text: 'A freeform pool framed by palms and the limestone cliffs beyond.' },
  { icon: Dumbbell, title: 'Fitness Centre', text: 'Fully equipped, open 24/7 with sunrise yoga on the deck.' },
  { icon: Plane, title: 'Airport Transfers', text: 'Private air-conditioned pickups from Colombo airport.' },
  { icon: Wifi, title: 'High-Speed Wi-Fi', text: 'Fast, free connectivity in every corner of the property.' },
]

const stats = [
  { value: '48', label: 'Luxury Rooms' },
  { value: '4.9', label: 'Guest Rating' },
  { value: '12k+', label: 'Happy Guests' },
  { value: '15', label: 'Years of Service' },
]

export default function Home() {
  const { rooms } = useRooms()
  const featured = rooms.filter((r) => r.featured)
  const [night, setNight] = useState(false)
  const [ready, setReady] = useState(false)

  // Once the photo is in, let visitors enjoy daylight briefly, then evening falls
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => setNight(true), 2200)
    return () => clearTimeout(t)
  }, [ready])

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <NightScene image={images.hero} night={night} onReady={() => setReady(true)} />
        <button className="scene-toggle" onClick={() => setNight((n) => !n)}>
          {night ? <Sun size={16} /> : <Moon size={16} />}
          <span>{night ? 'Day view' : 'Evening view'}</span>
        </button>
        <div className="container hero-content">
          <span className="eyebrow eyebrow--light">Welcome to Monsoon Ridge</span>
          <h1>
            Where the mist <br />
            meets <em>serenity</em>
          </h1>
          <p>
            A boutique jungle resort beneath the limestone cliffs of Sri Lanka. Thatched cabanas,
            soulful cuisine and the gentle rhythm of the rain, all waiting for you.
          </p>
          <div className="hero-buttons">
            <Link to="/rooms" className="btn btn-gold btn-lg">
              Explore Rooms <ArrowRight size={18} />
            </Link>
            <a href="#about" className="btn btn-glass btn-lg">
              <Play size={16} fill="currentColor" /> Discover More
            </a>
          </div>
        </div>
        <div className="container hero-search">
          <SearchBar />
        </div>
      </section>

      {/* STATS */}
      <section className="stats">
        <div className="container stats-grid">
          {stats.map((s, i) => (
            <Reveal key={s.label} className="stat" delay={i * 120}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="section">
        <div className="container about">
          <div className="about-images">
            <Reveal variant="wipe" className="about-main">
              <img src={images.exterior} alt="The hotel beneath limestone cliffs" />
            </Reveal>
            <Reveal variant="left" delay={350} className="about-small">
              <img src={images.lobby} alt="Sunlit garden pavilion" />
            </Reveal>
            <Reveal variant="zoom" delay={700} className="about-badge">
              <strong>15</strong>
              <span>Years of<br />Excellence</span>
            </Reveal>
          </div>
          <div className="about-text">
            <Reveal><span className="eyebrow">About Us</span></Reveal>
            <Reveal delay={100}><h2>A timeless retreat, crafted for unhurried moments</h2></Reveal>
            <Reveal delay={200}>
              <p>
                Tucked between limestone cliffs and a quiet bend of the river, Monsoon Ridge blends
                traditional tropical architecture with contemporary comfort. Every room is designed
                to bring the jungle in, with natural materials, soft light and views that change
                with the hours.
              </p>
            </Reveal>
            <ul className="checklist">
              <Reveal as="li" variant="left" delay={300}><Leaf size={18} /> Eco-conscious, locally sourced everything</Reveal>
              <Reveal as="li" variant="left" delay={420}><ShieldCheck size={18} /> Best price guarantee when you book direct</Reveal>
              <Reveal as="li" variant="left" delay={540}><Star size={18} /> Award-winning hospitality since 2011</Reveal>
            </ul>
            <Reveal delay={600}>
              <Link to="/contact" className="btn btn-dark">
                Get in Touch <ArrowRight size={16} />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FEATURED ROOMS */}
      <section className="section section--tint">
        <div className="container">
          <Reveal className="section-head">
            <div>
              <span className="eyebrow">Rooms &amp; Suites</span>
              <h2>Find your perfect space</h2>
            </div>
            <Link to="/rooms" className="link-arrow">
              View all rooms <ArrowRight size={16} />
            </Link>
          </Reveal>
          <div className="room-grid">
            {featured.slice(0, 3).map((r, i) => (
              <Reveal key={r.id} variant="left" delay={i * 160}>
                <RoomCard room={r} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SCROLL GALLERY */}
      <ScrollGallery eyebrow="Gallery" title="A glimpse of life at Monsoon Ridge" items={galleryItems} />

      {/* FACILITIES */}
      <section className="section">
        <div className="container">
          <Reveal className="section-head section-head--center">
            <span className="eyebrow">Facilities</span>
            <h2>Everything you need, and a little more</h2>
            <p className="muted">Thoughtful touches that turn a stay into a story worth telling.</p>
          </Reveal>
          <div className="facility-grid">
            {facilities.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={(i % 3) * 140}>
                <div className="facility">
                  <span className="facility-icon"><Icon size={26} /></span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PARALLAX BANNER */}
      <section className="banner" style={{ backgroundImage: `url(${images.resort})` }}>
        <div className="banner-overlay" />
        <Reveal variant="zoom" className="container banner-content">
          <span className="eyebrow eyebrow--light">Limited Offer</span>
          <h2>Stay 3 nights, pay for 2</h2>
          <p>Book direct this season and enjoy a complimentary night, breakfast and a sunset boat ride.</p>
          <Link to="/rooms" className="btn btn-gold btn-lg">Claim This Offer <ArrowRight size={18} /></Link>
        </Reveal>
      </section>

      {/* EXPERIENCES */}
      <section className="section">
        <div className="container">
          <Reveal className="section-head section-head--center">
            <span className="eyebrow">Experiences</span>
            <h2>Moments you will remember</h2>
          </Reveal>
          <div className="exp-grid">
            <Reveal variant="wipe" className="exp exp--tall" style={{ backgroundImage: `url(${images.pool})` }}>
              <div><h3>Lagoon Pool</h3><p>Swim beneath the palms</p></div>
            </Reveal>
            <Reveal variant="wipe" delay={150} className="exp" style={{ backgroundImage: `url(${images.dining})` }}>
              <div><h3>Riverside Dining</h3><p>Flavours of the island</p></div>
            </Reveal>
            <Reveal variant="wipe" delay={300} className="exp" style={{ backgroundImage: `url(${images.spa})` }}>
              <div><h3>Garden Spa</h3><p>Heal, relax, renew</p></div>
            </Reveal>
            <Reveal variant="wipe" delay={450} className="exp exp--wide" style={{ backgroundImage: `url(${images.boats})` }}>
              <div><h3>Longtail Boat Trips</h3><p>Glide past the limestone islands</p></div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section section--dark">
        <div className="container">
          <Reveal className="section-head section-head--center">
            <span className="eyebrow eyebrow--light">Testimonials</span>
            <h2>What our guests say</h2>
          </Reveal>
          <div className="testi-grid">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 150}>
              <figure className="testi">
                <Quote size={32} className="testi-quote" />
                <div className="stars">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={16} fill="currentColor" />
                  ))}
                </div>
                <blockquote>{t.text}</blockquote>
                <figcaption>
                  <span className="avatar">{t.name.split(' ').map((n) => n[0]).join('')}</span>
                  <span>
                    <strong>{t.name}</strong>
                    <small>{t.from}</small>
                  </span>
                </figcaption>
              </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container">
          <Reveal variant="zoom" className="cta">
            <div>
              <h2>Ready for your jungle escape?</h2>
              <p>Book directly with us for the best rates, free cancellation and exclusive perks.</p>
            </div>
            <Link to="/rooms" className="btn btn-gold btn-lg">Book Your Stay <ArrowRight size={18} /></Link>
          </Reveal>
        </div>
      </section>
    </>
  )
}
