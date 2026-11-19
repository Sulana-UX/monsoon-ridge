import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useEffect } from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Rooms from './pages/Rooms'
import RoomDetails from './pages/RoomDetails'
import Booking from './pages/Booking'
import Confirmation from './pages/Confirmation'
import MyBookings from './pages/MyBookings'
import Contact from './pages/Contact'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import AdminLayout from './pages/admin/AdminLayout'
import Overview from './pages/admin/Overview'
import AdminBookings from './pages/admin/Bookings'
import Guests from './pages/admin/Guests'
import RoomsAdmin from './pages/admin/RoomsAdmin'
import RoomEditor from './pages/admin/RoomEditor'
import BookingDetails from './pages/admin/BookingDetails'
import Calendar from './pages/admin/Calendar'
import NewBooking from './pages/admin/NewBooking'
import Blocks from './pages/admin/Blocks'
import Pricing from './pages/admin/Pricing'
import Reports from './pages/admin/Reports'
import Inbox from './pages/admin/Inbox'
import Staff from './pages/admin/Staff'
import Activity from './pages/admin/Activity'
import ManagerOnly from './pages/admin/ManagerOnly'
import Housekeeping from './pages/admin/Housekeeping'
import RequireAuth from './components/RequireAuth'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const { pathname } = useLocation()
  const { isAdmin: adminUser, loading } = useAuth()
  const isAdmin = pathname.startsWith('/admin')
  // Sign-in pages are full-screen: no menu bar or footer
  const bare = isAdmin || pathname === '/login' || pathname === '/register'

  // Staff accounts only use the dashboard: any website page sends them back to it
  if (!loading && adminUser && !isAdmin) return <Navigate to="/admin" replace />

  return (
    <>
      <ScrollToTop />
      {!bare && <Navbar />}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/rooms/:id" element={<RoomDetails />} />
          <Route path="/booking/:id" element={<RequireAuth><Booking /></RequireAuth>} />
          <Route path="/confirmation/:ref" element={<RequireAuth><Confirmation /></RequireAuth>} />
          <Route path="/my-bookings" element={<RequireAuth verified={false}><MyBookings /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth admin><AdminLayout /></RequireAuth>}>
            <Route index element={<Overview />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="bookings/new" element={<NewBooking />} />
            <Route path="bookings/:ref" element={<BookingDetails />} />
            <Route path="blocks" element={<Blocks />} />
            <Route path="pricing" element={<ManagerOnly><Pricing /></ManagerOnly>} />
            <Route path="reports" element={<ManagerOnly><Reports /></ManagerOnly>} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="staff" element={<ManagerOnly><Staff /></ManagerOnly>} />
            <Route path="activity" element={<ManagerOnly><Activity /></ManagerOnly>} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="housekeeping" element={<Housekeeping />} />
            <Route path="guests" element={<Guests />} />
            <Route path="rooms" element={<ManagerOnly><RoomsAdmin /></ManagerOnly>} />
            <Route path="rooms/new" element={<ManagerOnly><RoomEditor /></ManagerOnly>} />
            <Route path="rooms/:id" element={<ManagerOnly><RoomEditor /></ManagerOnly>} />
          </Route>
          <Route path="/login" element={<Login mode="login" />} />
          <Route path="/register" element={<Login mode="register" />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!bare && <Footer />}
    </>
  )
}
