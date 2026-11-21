import { useEffect, useRef, useState } from 'react'
import { CalendarClock, X, Check, ArrowRight, Info } from 'lucide-react'
import { api, friendlyError } from '../lib/firebase'
import { useRooms } from '../context/RoomsContext'
import { folioTotals } from '../lib/folio'
import { addDays, formatLKR, nightsBetween, prettyDate, today } from '../utils'

/**
 * Change dates, room type or guests. The server checks availability and prices it (preview)
 * before anything is saved. staff = dashboard (also extends a checked-in stay).
 */
export default function ChangeStay({ booking: b, staff = false, onClose, onDone }) {
  const { rooms } = useRooms()
  const inHouse = b.status === 'CheckedIn'
  const [f, setF] = useState({ roomId: b.roomId, checkIn: b.checkIn, checkOut: b.checkOut, guests: b.guests })
  const [preview, setPreview] = useState(null)
  const [checking, setChecking] = useState(false)
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  const changed = f.roomId !== b.roomId || f.checkIn !== b.checkIn || f.checkOut !== b.checkOut || Number(f.guests) !== b.guests
  const nights = nightsBetween(f.checkIn, f.checkOut)
  const room = rooms.find((r) => r.id === f.roomId)
  const maxGuests = room?.guests ?? b.guests

  // Ask the server for the new price whenever the form changes (debounced; old answers are ignored)
  useEffect(() => {
    setPreview(null)
    setProblem('')
    if (!changed) return
    if (nights < 1) return setProblem('Check-out must be after check-in.')
    const n = ++seq.current
    setChecking(true)
    const t = setTimeout(async () => {
      try {
        const { data } = await api.previewChange(b.ref, { ...f, guests: Number(f.guests) }, staff)
        if (n === seq.current) setPreview(data)
      } catch (e) {
        if (n === seq.current) setProblem(friendlyError(e))
      }
      if (n === seq.current) setChecking(false)
    }, 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.roomId, f.checkIn, f.checkOut, f.guests])

  const set = (k) => (e) => {
    const v = e.target.value
    setF((x) => {
      const next = { ...x, [k]: v }
      if (k === 'checkIn' && nightsBetween(v, next.checkOut) < 1) next.checkOut = addDays(v, Math.max(1, b.nights))
      if (k === 'roomId') {
        const r = rooms.find((y) => y.id === v)
        if (r && Number(next.guests) > r.guests) next.guests = r.guests
      }
      return next
    })
  }

  const save = async () => {
    setBusy(true)
    setProblem('')
    try {
      const { data } = await api.changeBooking(b.ref, { ...f, guests: Number(f.guests) }, staff)
      onDone?.(data)
    } catch (e) {
      setProblem(friendlyError(e))
    }
    setBusy(false)
  }

  const paid = folioTotals(b).paid
  const refund = preview && paid > preview.after.total + folioTotals(b).extras ? paid - preview.after.total - folioTotals(b).extras : 0
  const minIn = today()

  return (
    <section className="change-stay" aria-label="Change booking">
      <header>
        <h3><CalendarClock size={18} /> {inHouse ? 'Extend or shorten the stay' : 'Change your booking'}</h3>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={16} /></button>
      </header>

      <div className="cs-grid">
        <label><span>Check-in</span>
          <input type="date" value={f.checkIn} min={minIn} onChange={set('checkIn')} disabled={inHouse || busy} />
        </label>
        <label><span>Check-out</span>
          <input type="date" value={f.checkOut} min={inHouse ? addDays(minIn, 1) : addDays(f.checkIn, 1)} onChange={set('checkOut')} disabled={busy} />
        </label>
        <label className="cs-room"><span>Room</span>
          <select value={f.roomId} onChange={set('roomId')} disabled={inHouse || busy}>
            {!rooms.some((r) => r.id === b.roomId) && <option value={b.roomId}>{b.roomName}</option>}
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} · {formatLKR(r.price)}/night</option>)}
          </select>
        </label>
        <label><span>Guests</span>
          <select value={f.guests} onChange={set('guests')} disabled={inHouse || busy}>
            {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      <div className="cs-result" aria-live="polite">
        {!changed ? (
          <p className="muted small">Pick new dates, a different room or the number of guests. You'll see the new price before anything changes.</p>
        ) : problem ? (
          <p className="auth-msg auth-msg--err" role="alert">{problem}</p>
        ) : checking || !preview ? (
          <p className="muted small cs-checking"><span className="spinner spinner--sm" /> Checking availability and price…</p>
        ) : (
          <>
            <div className="cs-compare">
              <div>
                <small>Now</small>
                <strong>{prettyDate(preview.before.checkIn)} → {prettyDate(preview.before.checkOut)}</strong>
                <span>{preview.before.roomName} · {preview.before.guests} guest{preview.before.guests === 1 ? '' : 's'}</span>
                <span className="cs-price">{formatLKR(preview.before.total)}</span>
              </div>
              <ArrowRight size={18} className="cs-arrow" />
              <div className="cs-new">
                <small>New</small>
                <strong>{prettyDate(preview.after.checkIn)} → {prettyDate(preview.after.checkOut)}</strong>
                <span>{preview.after.roomName} · {preview.after.guests} guest{preview.after.guests === 1 ? '' : 's'} · {preview.after.nights} night{preview.after.nights === 1 ? '' : 's'}</span>
                <span className="cs-price">{formatLKR(preview.after.total)}</span>
              </div>
            </div>
            <p className={`cs-diff ${preview.difference > 0 ? 'is-more' : preview.difference < 0 ? 'is-less' : ''}`}>
              {preview.difference === 0 ? 'Same price.' : preview.difference > 0 ? `${formatLKR(preview.difference)} more` : `${formatLKR(-preview.difference)} less`}
              {preview.price?.promo && <small> · promo {preview.price.promo.code} still applies</small>}
            </p>
            {refund > 0 && <p className="cs-note"><Info size={14} /> {staff ? `The guest has paid ${formatLKR(refund)} more than the new bill. Refund it at the desk.` : `You've paid ${formatLKR(refund)} more than the new total. The hotel will refund the difference.`}</p>}
            {staff && preview.unitNote && <p className="cs-note"><Info size={14} /> {preview.unitNote}</p>}
            {!staff && <p className="muted small">Nights you already booked keep their price. New nights use today's rates.</p>}
          </>
        )}
      </div>

      <div className="cs-actions">
        <button type="button" className="btn btn-gold btn-sm" disabled={!preview || checking || busy || !!problem} onClick={save}>
          {busy ? <span className="spinner spinner--sm" /> : <Check size={15} />} Confirm change
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>Keep as it is</button>
      </div>
    </section>
  )
}
