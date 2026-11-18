import { useState } from 'react'
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Reveal from '../components/Reveal'
import { images } from '../data/rooms'
import { api, friendlyError } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

const info = [
  { icon: MapPin, title: 'Visit us', text: '18 Cliffside Road, Ella, Sri Lanka' },
  { icon: Phone, title: 'Call us', text: '+94 11 234 5678' },
  { icon: Mail, title: 'Email us', text: 'stay@monsoonridge.lk' },
  { icon: Clock, title: 'Front desk', text: 'Open 24 hours, 7 days' },
]

export default function Contact() {
  const { user } = useAuth()
  const blank = { name: user?.displayName || '', email: user?.email || '', phone: '', subject: '', message: '', website: '' }
  const [f, setF] = useState(blank)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (f.message.trim().length < 10) return setErr('Please write a little more (at least 10 characters).')
    setBusy(true)
    setErr('')
    try {
      await api.sendContact(f)
      setSent(true)
      setF(blank)
    } catch (e2) {
      setErr(friendlyError(e2))
    }
    setBusy(false)
  }

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
                <form onSubmit={submit}>
                  <h2>Send us a message</h2>
                  <p className="muted">Questions about rooms, events or special occasions? Drop us a line.</p>
                  <div className="form-grid">
                    <label className="field field--half"><span>Name</span><div className="input-wrap input-wrap--plain"><input required maxLength={80} autoComplete="name" value={f.name} onChange={set('name')} placeholder="Your name" /></div></label>
                    <label className="field field--half"><span>Email</span><div className="input-wrap input-wrap--plain"><input type="email" required maxLength={254} autoComplete="email" value={f.email} onChange={set('email')} placeholder="you@example.com" /></div></label>
                    <label className="field field--half"><span>Phone <em>(optional)</em></span><div className="input-wrap input-wrap--plain"><input type="tel" maxLength={25} autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="+94 77 123 4567" /></div></label>
                    <label className="field field--half"><span>Subject</span><div className="input-wrap input-wrap--plain"><input maxLength={120} value={f.subject} onChange={set('subject')} placeholder="How can we help?" /></div></label>
                    <label className="field"><span>Message</span><div className="input-wrap input-wrap--plain input-wrap--area"><textarea rows={5} required maxLength={3000} value={f.message} onChange={set('message')} placeholder="Write your message..." /></div></label>
                    {/* Hidden from people; spam bots fill it in and get ignored */}
                    <label className="hp-field" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label>
                  </div>
                  {err && <p className="auth-msg auth-msg--err" role="alert">{err}</p>}
                  <button className="btn btn-gold btn-lg" disabled={busy}>{busy ? <span className="spinner spinner--sm" /> : <Send size={17} />} {busy ? 'Sending…' : 'Send Message'}</button>
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
