import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, Users, LogOut, BedDouble } from 'lucide-react'
import { useAllRooms } from '../../context/RoomsContext'
import Logo from '../../components/Logo'
import { useBookings } from '../../lib/bookings'
import { useAuth } from '../../context/AuthContext'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
  { to: '/admin/rooms', label: 'Rooms', icon: BedDouble },
  { to: '/admin/guests', label: 'Guests', icon: Users },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const signOut = async () => {
    await logout()
    navigate('/', { replace: true })
  }
  // One live subscription shared by every tab
  const bookingsState = useBookings({ all: true, max: 1000 })
  const roomsState = useAllRooms()
  const data = {
    bookings: bookingsState.bookings,
    rooms: roomsState.rooms,
    loading: bookingsState.loading || roomsState.loading,
    error: bookingsState.error || roomsState.error,
  }

  return (
    <section className="admin-page">
      <div className="admin-shell">
        <aside className="admin-side">
          <div className="admin-logo"><Logo light /></div>
          <div className="admin-side-head">
            <span className="eyebrow">Staff</span>
            <strong>Dashboard</strong>
            <small>{user.email}</small>
          </div>
          <nav>
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="admin-nav">
                <Icon size={18} /> {label}
              </NavLink>
            ))}
            <button className="admin-nav admin-nav--muted" onClick={signOut}><LogOut size={18} /> Sign out</button>
          </nav>
        </aside>

        <div className="admin-main">
          {data.loading ? (
            <div className="page-loading"><span className="spinner" /></div>
          ) : data.error ? (
            <div className="empty">
              <h3>Couldn't load bookings</h3>
              <p className="muted">
                {data.error.code === 'permission-denied'
                  ? 'This account does not have staff access. Sign out and in again after being added as admin.'
                  : 'Please check your connection and refresh the page.'}
              </p>
            </div>
          ) : (
            <Outlet context={data} />
          )}
        </div>
      </div>
    </section>
  )
}
