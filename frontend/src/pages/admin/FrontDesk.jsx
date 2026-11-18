import { useState } from 'react'
import { LogIn, LogOut, UserX, Undo2 } from 'lucide-react'
import { api, friendlyError } from '../../lib/firebase'
import { today } from '../../utils'

/** Which front-desk actions make sense for this booking today (the server re-checks). */
export function actionsFor(b, t = today()) {
  const a = []
  if (b.status === 'Confirmed' && b.checkIn <= t && t < b.checkOut) a.push('check-in')
  if (b.status === 'Confirmed' && b.checkIn <= t) a.push('no-show')
  if (b.status === 'CheckedIn') a.push('check-out', 'undo-check-in')
  return a
}

/** Confirmation question for actions that free rooms; null = no question. */
function confirmText(action, b, t) {
  if (action === 'no-show') return 'Mark this guest as a no-show? Their remaining nights will be released for sale.'
  if (action === 'check-out' && b.checkOut > t) {
    return `${b.guest?.firstName ?? 'The guest'} is due to leave on ${b.checkOut}. Check out early? The unused nights will be released for sale.`
  }
  return null
}

const META = {
  'check-in': { label: 'Check in', icon: LogIn, cls: 'fd-btn--primary' },
  'check-out': { label: 'Check out', icon: LogOut, cls: 'fd-btn--primary' },
  'no-show': { label: 'No-show', icon: UserX, cls: 'fd-btn--danger' },
  'undo-check-in': { label: 'Undo check-in', icon: Undo2, cls: 'fd-btn--ghost' },
}

/** Buttons for the allowed actions. `only` limits which ones are shown. */
export default function FrontDeskButtons({ booking, only, compact = false, onDone }) {
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState('')
  const t = today()
  let actions = actionsFor(booking, t)
  if (only) actions = actions.filter((a) => only.includes(a))
  if (!actions.length) return null

  const run = async (action) => {
    const q = confirmText(action, booking, t)
    if (q && !window.confirm(q)) return
    setBusy(action)
    setErr('')
    try {
      await api.setBookingStatus(booking.ref, action)
      onDone?.(action)
    } catch (e) {
      setErr(friendlyError(e))
    }
    setBusy(null)
  }

  return (
    <div className={`fd-actions ${compact ? 'fd-actions--compact' : ''}`}>
      {actions.map((a) => {
        const { label, icon: Icon, cls } = META[a]
        return (
          <button key={a} type="button" className={`fd-btn ${cls}`} disabled={!!busy} onClick={() => run(a)}>
            {busy === a ? <span className="spinner spinner--sm" /> : <Icon size={compact ? 14 : 16} />} {label}
          </button>
        )
      })}
      {err && <p className="fd-err" role="alert">{err}</p>}
    </div>
  )
}
