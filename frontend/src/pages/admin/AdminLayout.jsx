import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, CalendarRange, CalendarOff, Users, LogOut, BedDouble, Menu, ChevronRight } from 'lucide-react'
import { useBookings, useBlocks } from '../../lib/bookings'
import { useAuth } from '../../context/AuthContext'
import { useAllRooms } from '../../context/RoomsContext'
import { prettyDate, today } from '../../utils'
import Avatar from './Avatar'
import './admin.css'
import './frontdesk.css'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarDays, count: 'upcoming' },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarRange },
  { to: '/admin/rooms', label: 'Rooms', icon: BedDouble },
  { to: '/admin/blocks', label: 'Blocked dates', icon: CalendarOff },
  { to: '/admin/guests', label: 'Guests', icon: Users },
]

const MountainMark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 19 9 8l4 6 3-4 6 9" />
    <path d="M9 4v2M5.5 5.5l1 1M12.5 5.5l-1 1" />
  </svg>
)

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // One live subscription each, shared by every tab
  const bookingsState = useBookings({ all: true, max: 1000 })
  const roomsState = useAllRooms()
  // Blocks are optional data: if the rules aren't deployed yet, the dashboard still works
  const { blocks } = useBlocks()
  const data = {
    bookings: bookingsState.bookings,
    rooms: roomsState.rooms,
    blocks,
    loading: bookingsState.loading || roomsState.loading,
    error: bookingsState.error || roomsState.error,
  }

  const t = today()
  const counts = useMemo(() => ({
    upcoming: bookingsState.bookings.filter((b) => b.status === 'Confirmed' && b.checkOut > t).length,
  }), [bookingsState.bookings, t])

  useEffect(() => setMenuOpen(false), [pathname])

  const section = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))?.label ?? 'Overview'
  const name = user.displayName || user.email.split('@')[0]

  const signOut = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className={`admin-page ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="admin-side">
        <div className="admin-brand">
          <span className="admin-brand-mark"><MountainMark /></span>
          <div>
            <strong>Monsoon Ridge</strong>
            <small>Staff dashboard</small>
          </div>
        </div>

        <div className="admin-nav-label">Manage</div>
        <nav>
          {NAV.map(({ to, label, icon: Icon, end, count }) => (
            <NavLink key={to} to={to} end={end} className="admin-nav">
              <Icon size={18} /> {label}
              {count && counts[count] > 0 && <span className="nav-count">{counts[count]}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="admin-user">
          <Avatar name={name} />
          <div>
            <strong>{name}</strong>
            <small>{user.email}</small>
          </div>
          <button className="admin-signout" onClick={signOut} title="Sign out" aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {menuOpen && <div className="admin-scrim" onClick={() => setMenuOpen(false)} />}

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-crumbs">
            <button className="admin-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
            <span>Dashboard</span> <ChevronRight size={14} /> <strong>{section}</strong>
          </div>
          <div className="admin-topbar-right">
            <span className="admin-topbar-date">{prettyDate(t)}</span>
            <span className="live-dot" title="Updates automatically">Live</span>
          </div>
        </header>

        {data.loading ? (
          <div className="page-loading"><span className="spinner" /></div>
        ) : data.error ? (
          <div className="empty">
            <h3>Couldn't load the dashboard</h3>
            <p className="muted">
              {data.error.code === 'permission-denied'
                ? 'This account does not have staff access. Sign out and in again after being added as admin.'
                : 'Please check your connection and refresh the page.'}
            </p>
          </div>
        ) : (
          <Outlet context={data} />
        )}
      </main>
    </div>
  )
}
