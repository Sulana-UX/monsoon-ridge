import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import VerifyEmailNotice from './VerifyEmailNotice'

/** Sends signed-out visitors to /login and brings them back afterwards. */
export default function RequireAuth({ children, admin = false, verified = true }) {
  const { user, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="page-loading"><span className="spinner" /></div>
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (verified && !user.emailVerified) return <VerifyEmailNotice />
  // UI guard only: the real protection is in Firestore rules and the functions
  if (admin && !isAdmin) return <Navigate to="/" replace />
  return children
}
