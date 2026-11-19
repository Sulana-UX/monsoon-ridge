import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { CalendarOff, Trash2, Wrench, CalendarRange, CheckCircle2, AlertTriangle } from 'lucide-react'
import { api, friendlyError } from '../../lib/firebase'
import { useAvailability } from '../../lib/useAvailability'
import { addDays, nightsBetween, prettyDate, today } from '../../utils'
import { useDialog } from '../../components/Dialog'

const REASONS = ['Renovation', 'Maintenance', 'Deep cleaning', 'Private event', 'Staff use']

export default function Blocks() {
  const dialog = useDialog()
  const { rooms, blocks } = useOutletContext()
  const t = today()
  const active = rooms.filter((r) => r.active !== false)
  const [f, setF] = useState({ roomId: active[0]?.id || '', from: t, to: addDays(t, 1), units: 1, reason: 'Maintenance' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const room = rooms.find((r) => r.id === f.roomId)
  const nights = nightsBetween(f.from, f.to)
  const { available, loading: availLoading } = useAvailability(f.from, f.to)
  const free = available?.[f.roomId]
  const tooMany = free != null && Number(f.units) > free
  const { current, past } = useMemo(() => ({
    current: blocks.filter((b) => b.to > t),
    past: blocks.filter((b) => b.to <= t).reverse().slice(0, 10),
  }), [blocks, t])

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      await api.createBlock({ ...f, units: Number(f.units) })
      setMsg({ ok: true, text: `Blocked ${f.units} × ${room?.name} for ${nights} night${nights === 1 ? '' : 's'}. Guests can't book them now.` })
    } catch (err) {
      setMsg({ ok: false, text: friendlyError(err) })
    }
    setBusy(false)
  }

  const remove = async (b) => {
    if (!(await dialog.confirm({ title: 'Remove this block?', message: `${b.units} × ${b.roomName}, ${prettyDate(b.from)} → ${prettyDate(b.to)}. Those rooms go back on sale straight away.`, confirmLabel: 'Remove block' }))) return
    try {
      await api.deleteBlock(b.id)
    } catch (err) {
      setMsg({ ok: false, text: friendlyError(err) })
    }
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow">Availability</span>
          <h1>Blocked dates</h1>
          <p>Take rooms out of sale for renovation, maintenance or a private event.</p>
        </div>
        <Link to="/admin/calendar" className="btn btn-outline btn-sm"><CalendarRange size={16} /> View calendar</Link>
      </div>

      <div className="admin-grid">
        <form className="admin-card admin-card--5 room-editor block-form" onSubmit={add} noValidate>
          <h3><Wrench size={18} /> Block rooms</h3>
          <div className="form-grid">
            <label className="field"><span>Room type</span>
              <div className="input-wrap"><select value={f.roomId} onChange={set('roomId')}>
                {active.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.units} room{r.units === 1 ? '' : 's'})</option>)}
              </select></div>
            </label>
            <label className="field field--half"><span>From</span>
              <div className="input-wrap"><input type="date" min={t} value={f.from}
                onChange={(e) => setF((x) => ({ ...x, from: e.target.value, to: nightsBetween(e.target.value, x.to) < 1 ? addDays(e.target.value, 1) : x.to }))} /></div>
            </label>
            <label className="field field--half"><span>Until (rooms free again)</span>
              <div className="input-wrap"><input type="date" min={addDays(f.from, 1)} value={f.to} onChange={set('to')} /></div>
            </label>
            <label className="field field--half"><span>How many rooms</span>
              <div className="input-wrap"><input type="number" min={1} max={room?.units || 1} value={f.units} onChange={set('units')} /></div>
            </label>
            <label className="field field--half"><span>Reason</span>
              <div className="input-wrap">
                <input list="block-reasons" value={f.reason} onChange={set('reason')} maxLength={120} />
                <datalist id="block-reasons">{REASONS.map((r) => <option key={r} value={r} />)}</datalist>
              </div>
            </label>
          </div>
          {nights > 0 && room && (availLoading ? <p className="muted small">Checking free rooms…</p>
            : free === 0 ? <p className="avail-bad"><AlertTriangle size={16} /> No {room.name} free on these dates (already booked or blocked).</p>
            : free != null ? <p className={tooMany ? 'avail-bad' : 'avail-good'}>{tooMany ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {free} of {room.units} free every night{tooMany ? ', so block ' + free + ' or fewer' : ''}.</p>
            : null)}
          {nights > 0 && room && (
            <p className="muted small">{f.units} of {room.units} {room.name} closed for {nights} night{nights === 1 ? '' : 's'} ({prettyDate(f.from)} → {prettyDate(f.to)}).</p>
          )}
          {msg && <p className={`auth-msg ${msg.ok ? '' : 'auth-msg--err'}`} role="status">{msg.text}</p>}
          <button className="btn btn-gold btn-block" disabled={busy || !room || nights < 1 || free === 0 || tooMany}>
            {busy ? <span className="spinner spinner--sm" /> : <CalendarOff size={17} />} Block these dates
          </button>
        </form>

        <section className="admin-card admin-card--7">
          <div className="admin-card-head">
            <div>
              <h3>Current & upcoming blocks</h3>
              <p className="muted small">{current.length} active</p>
            </div>
          </div>
          {current.length === 0 ? (
            <p className="today-empty"><CalendarOff size={16} /> No rooms are blocked. Everything is on sale.</p>
          ) : (
            <ul className="block-list">
              {current.map((b) => (
                <BlockRow key={b.id} b={b} onRemove={() => remove(b)} live={b.from <= t} />
              ))}
            </ul>
          )}
          {past.length > 0 && (
            <details className="chart-table">
              <summary>Past blocks ({past.length})</summary>
              <ul className="block-list block-list--past">
                {past.map((b) => <BlockRow key={b.id} b={b} />)}
              </ul>
            </details>
          )}
        </section>
      </div>
    </>
  )
}

function BlockRow({ b, onRemove, live }) {
  return (
    <li className="block-row">
      <span className="block-icon"><Wrench size={16} /></span>
      <div>
        <strong>{b.units} × {b.roomName}</strong>
        <small>{prettyDate(b.from)} → {prettyDate(b.to)} · {b.nights} night{b.nights === 1 ? '' : 's'}</small>
        <small className="block-reason">{b.reason} · by {b.createdBy}</small>
      </div>
      {live && <span className="status status--in">Now</span>}
      {onRemove && (
        <button className="icon-btn" title="Remove block" aria-label="Remove block" onClick={onRemove}><Trash2 size={15} /></button>
      )}
    </li>
  )
}
