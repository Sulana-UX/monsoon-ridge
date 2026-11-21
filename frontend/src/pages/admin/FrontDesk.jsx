import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { LogIn, LogOut, UserX, Undo2, DoorOpen, X } from 'lucide-react'
import { api, friendlyError } from '../../lib/firebase'
import { unitOptions, typeHasUnits, HK_LABEL } from '../../lib/units'
import { today, formatLKR } from '../../utils'
import { folioTotals } from '../../lib/folio'
import { useDialog } from '../../components/Dialog'

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
  if (action !== 'check-out') return null
  const due = folioTotals(b).balance
  const owes = due > 0 ? `${b.guest?.firstName ?? 'The guest'} still owes ${formatLKR(due)} on the bill. ` : ''
  if (b.checkOut > t) return `${owes}${b.guest?.firstName ?? 'The guest'} is due to leave on ${b.checkOut}. Check out early? The unused nights will be released for sale.`
  return owes ? `${owes}Check out anyway? You can still take the payment afterwards.` : null
}

const META = {
  'check-in': { label: 'Check in', icon: LogIn, cls: 'fd-btn--primary' },
  'check-out': { label: 'Check out', icon: LogOut, cls: 'fd-btn--primary' },
  'no-show': { label: 'No-show', icon: UserX, cls: 'fd-btn--danger' },
  'undo-check-in': { label: 'Undo check-in', icon: Undo2, cls: 'fd-btn--ghost' },
}

/** A <select> of the room numbers this booking can take (clean first). */
export function UnitSelect({ booking, value, onChange, id }) {
  const { units = [], bookings = [] } = useOutletContext() || {}
  const options = unitOptions(booking, units, bookings)
  if (!options.length) return <p className="fd-err">No {booking.roomName} is free. Check the Housekeeping page.</p>
  return (
    <select id={id} className="unit-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Room number">
      <option value="">Choose room…</option>
      {options.map((u) => <option key={u.number} value={u.number}>Room {u.number}{u.housekeeping !== 'clean' ? ` (${HK_LABEL[u.housekeeping]?.toLowerCase()})` : ''}</option>)}
    </select>
  )
}

/** Buttons for the allowed actions. `only` limits which ones are shown. */
export default function FrontDeskButtons({ booking, only, compact = false, onDone }) {
  const { units = [] } = useOutletContext() || {}
  const dialog = useDialog()
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState('')
  const [picking, setPicking] = useState(false)
  const [unit, setUnit] = useState('')
  const t = today()
  let actions = actionsFor(booking, t)
  if (only) actions = actions.filter((a) => only.includes(a))
  if (!actions.length) return null

  const needsRoom = typeHasUnits(booking.roomId, units) && !booking.unit

  const run = async (action, extra) => {
    const q = confirmText(action, booking, t)
    if (q && !(await dialog.confirm({ title: action === 'no-show' ? 'Mark as no-show?' : booking.checkOut > t ? 'Check out early?' : 'Balance not paid', message: q, confirmLabel: action === 'no-show' ? 'Mark no-show' : 'Check out now', danger: action === 'no-show' }))) return
    setBusy(action)
    setErr('')
    try {
      await api.setBookingStatus(booking.ref, action, extra)
      setPicking(false)
      onDone?.(action)
    } catch (e) {
      setErr(friendlyError(e))
    }
    setBusy(null)
  }

  // Check-in for a room type with numbers, and no room chosen yet: pick one first
  if (picking) {
    return (
      <div className="fd-actions fd-pick">
        <DoorOpen size={16} className="fd-pick-icon" />
        <UnitSelect booking={booking} value={unit} onChange={setUnit} />
        <button type="button" className="fd-btn fd-btn--primary" disabled={!unit || !!busy} onClick={() => run('check-in', { unit })}>
          {busy ? <span className="spinner spinner--sm" /> : <LogIn size={14} />} Check in
        </button>
        <button type="button" className="icon-btn" aria-label="Cancel" onClick={() => { setPicking(false); setErr('') }}><X size={14} /></button>
        {err && <p className="fd-err" role="alert">{err}</p>}
      </div>
    )
  }

  return (
    <div className={`fd-actions ${compact ? 'fd-actions--compact' : ''}`}>
      {actions.map((a) => {
        const { label, icon: Icon, cls } = META[a]
        const onClick = a === 'check-in' && needsRoom ? () => setPicking(true) : () => run(a)
        return (
          <button key={a} type="button" className={`fd-btn ${cls}`} disabled={!!busy} onClick={onClick}>
            {busy === a ? <span className="spinner spinner--sm" /> : <Icon size={compact ? 14 : 16} />} {label}{a === 'check-in' && booking.unit ? ` · ${booking.unit}` : ''}
          </button>
        )
      })}
      {err && <p className="fd-err" role="alert">{err}</p>}
    </div>
  )
}
