import { useState } from 'react'
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Reveal from '../components/Reveal'
import { images } from '../data/rooms'

const info = [
  { icon: MapPin, title: 'Visit us', text: '18 Cliffside Road, Ella, Sri Lanka' },
  { icon: Phone, title: 'Call us', text: '+94 11 234 5678' },
  { icon: Mail, title: 'Email us', text: 'stay@monsoonridge.lk' },
  { icon: Clock, title: 'Front desk', text: 'Open 24 hours, 7 days' },
]

export default function Contact() {
  const [sent, setSent] = useState(false)

  return (
    <>
      <PageHeader title="Contact Us" subtitle="We would love to help you plan your stay." image={images.exterior} />
      <section className="section">
        <div className="container">
          <div className="info-grid">
            {info.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} variant="left" delay={i * 120} className="info-card">
                <span className="facility-icon"><Icon size={22} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </Reveal>
            ))}
          </div>

          <div className="contact-layout">
            <div className="card">
              {sent ? (
                <div className="sent">
                  <CheckCircle2 size={48} />
                  <h2>Message sent!</h2>
                  <p className="muted">Our team will get back to you within 24 hours.</p>
                  <button className="btn btn-outline" onClick={() => setSent(false)}>Send another</button>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); setSent(true) }}>
                  <h2>Send us a message</h2>
                  <p className="muted">Questions about rooms, events or special occasions? Drop us a line.</p>
                  <div className="form-grid">
                    <label className="field field--half"><span>Name</span><div className="input-wrap input-wrap--plain"><input required placeholder="Your name" /></div></label>
                    <label className="field field--half"><span>Email</span><div className="input-wrap input-wrap--plain"><input type="email" required placeholder="you@example.com" /></div></label>
                    <label className="field"><span>Subject</span><div className="input-wrap input-wrap--plain"><input placeholder="How can we help?" /></div></label>
                    <label className="field"><span>Message</span><div className="input-wrap input-wrap--plain input-wrap--area"><textarea rows={5} required placeholder="Write your message..." /></div></label>
                  </div>
                  <button className="btn btn-gold btn-lg"><Send size={17} /> Send Message</button>
                </form>
              )}
            </div>
            <div className="map">
              <iframe
                title="Map"
                src="https://maps.google.com/maps?q=Ella%20Sri%20Lanka&z=12&output=embed"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
