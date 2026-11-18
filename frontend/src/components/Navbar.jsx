import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, Phone, LogIn, LogOut, CalendarDays, ShieldCheck, ChevronDown } from 'lucide-react'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'

const initials = (u) =>
  (u.displayName || u.email || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

function UserMenu() {
  const { user, isAdmin, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {user.photoURL
          ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          : <span className="user-initials">{initials(user)}</span>}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-info">
            <strong>{user.displayName || 'Guest'}</strong>
            <small>{user.email}</small>
          </div>
          <Link to="/my-bookings" role="menuitem"><CalendarDays size={16} /> My Bookings</Link>
          {isAdmin && <Link to="/admin" role="menuitem"><ShieldCheck size={16} /> Admin</Link>}
          <button role="menuitem" onClick={async () => { await logout(); navigate('/') }}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

const links = [
  { to: '/', label: 'Home' },
  { to: '/rooms', label: 'Rooms & Suites' },
  { to: '/my-bookings', label: 'My Bookings' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const { user, isAdmin, loading, logout } = useAuth()
  const transparent = pathname === '/' && !scrolled && !open

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <header className={`nav ${transparent ? 'nav--clear' : 'nav--solid'}`}>
      <div className="container nav-inner">
        <Link to="/" className="nav-brand">
          <Logo />
        </Link>

        <nav className={`nav-links ${open ? 'is-open' : ''}`}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className="nav-link">
              {l.label}
            </NavLink>
          ))}
          {isAdmin && <NavLink to="/admin" className="nav-link nav-mobile-only">Admin</NavLink>}
          {!loading && (user
            ? <button className="nav-link nav-mobile-only" onClick={logout}>Sign out</button>
            : <NavLink to="/login" className="nav-link nav-mobile-only">Sign in</NavLink>)}
          <Link to="/rooms" className="btn btn-gold nav-cta-mobile">Book Your Stay</Link>
        </nav>

        <div className="nav-actions">
          <a href="tel:+94112345678" className="nav-phone">
            <Phone size={16} /> +94 11 234 5678
          </a>
          {!loading && (user
            ? <UserMenu />
            : <Link to="/login" className="nav-login"><LogIn size={16} /> Sign in</Link>)}
          <Link to="/rooms" className="btn btn-gold btn-sm">Book Now</Link>
          <button className="nav-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </header>
  )
}
