import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

/*
 * Pages only the Admin role may open (rooms, prices & promos, reports, staff, activity log).
 * This only hides the page; the server and database rules refuse the data and actions too.
 */
export default function ManagerOnly({ children }) {
  const { isManager } = useAuth()
  if (isManager) return children
  return (
    <div className="empty manager-only">
      <Lock size={30} />
      <h3>Admins only</h3>
      <p className="muted">Your account has Front desk access. Ask a manager if you need this page.</p>
      <Link to="/admin" className="btn btn-outline btn-sm">Back to today</Link>
    </div>
  )
}
