import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Sun, CalendarHeart, Tag, Plus, Trash2, Save, Pause, Play, Percent } from 'lucide-react'
import { api, friendlyError } from '../../lib/firebase'
import { usePricingRules, usePromos } from '../../lib/bookings'
import { addDays, formatLKR, prettyDate, today } from '../../utils'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const NIGHTS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EMPTY = { seasons: [], weekend: { days: [5, 6], amount: 0 } }

/* Same formula as the server (backend/server/src/pricing.js), for the live example only */
const rateFor = (base, monthNo, dow, rules) => {
  const s = rules.seasons.find((x) => x.months.includes(monthNo))
  const extra = Number(rules.weekend.amount) > 0 && rules.weekend.days.includes(dow) ? Number(rules.weekend.amount) : 0
  return Math.round(base * (1 + (Number(s?.percent) || 0) / 100)) + extra
}

export default function Pricing() {
  return (
    <>
      <div className="admin-head">
        <div>
          <span className="eyebrow">Revenue</span>
          <h1>Pricing & promos</h1>
          <p>Season and weekend prices are added to each room's base rate automatically, online and at the desk.</p>
        </div>
      </div>
      <div className="admin-grid">
        <PriceRules />
        <Promos />
      </div>
    </>
  )
}

function PriceRules() {
  const { rooms } = useOutletContext()
  const { rules: saved, loading, error } = usePricingRules()
  const [r, setR] = useState(EMPTY)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  // Load the saved rules once (and again after saving), but never over unsaved edits
  useEffect(() => {
    if (!dirty && saved) setR({ seasons: saved.seasons || [], weekend: saved.weekend || EMPTY.weekend })
  }, [saved, dirty])

  const change = (fn) => { setR((x) => fn(structuredClone(x))); setDirty(true); setMsg(null) }
  const usedBy = useMemo(() => {
    const m = {}
    r.seasons.forEach((s, i) => s.months.forEach((mo) => { m[mo] = i }))
    return m
  }, [r.seasons])

  const toggleMonth = (i, mo) => change((x) => {
    const s = x.seasons[i]
    s.months = s.months.includes(mo) ? s.months.filter((m) => m !== mo) : [...s.months, mo].sort((a, b) => a - b)
    return x
  })

  const save = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await api.savePricing({
        seasons: r.seasons.map((s) => ({ name: s.name, months: s.months, percent: Number(s.percent) })),
        weekend: { days: r.weekend.days, amount: Number(r.weekend.amount) || 0 },
      })
      setDirty(false)
      setMsg({ ok: true, text: 'Saved. New bookings use these prices from now on. Existing bookings keep their price.' })
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e) })
    }
    setBusy(false)
  }

  // Live example with the cheapest-to-understand room: the first active one
  const ex = rooms.find((x) => x.active !== false)
  const peak = r.seasons.find((s) => s.months.length && Number(s.percent))

  return (
    <>
      <section className="admin-card admin-card--7">
        <div className="admin-card-head">
          <div>
            <h3><CalendarHeart size={18} /> Seasons</h3>
            <p className="muted small">Raise (or lower) prices in chosen months. Each month can belong to one season.</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => change((x) => { x.seasons.push({ name: x.seasons.length ? `Season ${x.seasons.length + 1}` : 'Peak season', months: [], percent: 20 }); return x })} disabled={r.seasons.length >= 12}>
            <Plus size={15} /> Add season
          </button>
        </div>
        {loading ? <p className="muted small">Loading…</p>
          : error ? <p className="muted small">Couldn't load prices. Make sure the latest database rules are deployed.</p>
          : r.seasons.length === 0 ? <p className="today-empty"><Sun size={16} /> No seasons yet. Every month uses the base rate.</p>
          : (
            <ul className="season-list">
              {r.seasons.map((s, i) => (
                <li key={i} className="season-row">
                  <div className="season-top">
                    <input className="season-name" value={s.name} maxLength={40} aria-label="Season name"
                      onChange={(e) => change((x) => { x.seasons[i].name = e.target.value; return x })} />
                    <label className="season-pct">
                      <input type="number" min={-50} max={200} value={s.percent} aria-label={`${s.name} price change in percent`}
                        onChange={(e) => change((x) => { x.seasons[i].percent = e.target.value; return x })} />
                      <Percent size={14} />
                    </label>
                    <button className="icon-btn" title="Remove season" aria-label={`Remove ${s.name}`} onClick={() => change((x) => { x.seasons.splice(i, 1); return x })}><Trash2 size={15} /></button>
                  </div>
                  <div className="month-chips" role="group" aria-label={`Months in ${s.name}`}>
                    {MONTHS.map((m, k) => {
                      const mo = k + 1
                      const other = usedBy[mo] !== undefined && usedBy[mo] !== i
                      return (
                        <button key={m} type="button" aria-pressed={s.months.includes(mo)} disabled={other}
                          title={other ? `In ${r.seasons[usedBy[mo]].name}` : ''}
                          className={`mchip ${s.months.includes(mo) ? 'is-on' : ''}`} onClick={() => toggleMonth(i, mo)}>{m}</button>
                      )
                    })}
                  </div>
                  <small className="muted">{Number(s.percent) >= 0 ? `+${Number(s.percent) || 0}%` : `${s.percent}%`} on the base rate{s.months.length ? ` in ${s.months.map((m) => MONTHS[m - 1]).join(', ')}` : '. Pick the months.'}</small>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="admin-card admin-card--5">
        <h3><Sun size={18} /> Weekend extra</h3>
        <p className="muted small">A fixed amount added per room, per weekend night.</p>
        <div className="form-grid room-editor">
          <label className="field"><span>Extra per night (LKR)</span>
            <div className="input-wrap"><input type="number" min={0} step={500} value={r.weekend.amount}
              onChange={(e) => change((x) => { x.weekend.amount = e.target.value; return x })} /></div>
          </label>
        </div>
        <span className="field-label">Weekend nights</span>
        <div className="month-chips" role="group" aria-label="Weekend nights">
          {NIGHTS.map((d, k) => (
            <button key={d} type="button" aria-pressed={r.weekend.days.includes(k)} className={`mchip ${r.weekend.days.includes(k) ? 'is-on' : ''}`}
              onClick={() => change((x) => { x.weekend.days = x.weekend.days.includes(k) ? x.weekend.days.filter((v) => v !== k) : [...x.weekend.days, k].sort(); return x })}>{d}</button>
          ))}
        </div>
        <small className="muted">The night of the day you pick. Fri + Sat = guests staying Friday and Saturday night.</small>

        {ex && (
          <div className="price-example">
            <strong>Example: {ex.name}</strong>
            <div><span>Base rate</span><span>{formatLKR(ex.price)}</span></div>
            <div><span>Weekday night{peak ? ` in ${MONTHS[peak.months[0] - 1]}` : ''}</span><span>{formatLKR(rateFor(ex.price, peak ? peak.months[0] : 0, 2, r))}</span></div>
            {r.weekend.days.length > 0 && (
              <div><span>{NIGHTS[r.weekend.days[r.weekend.days.length - 1]]} night{peak ? ` in ${MONTHS[peak.months[0] - 1]}` : ''}</span><span>{formatLKR(rateFor(ex.price, peak ? peak.months[0] : 0, r.weekend.days[r.weekend.days.length - 1], r))}</span></div>
            )}
          </div>
        )}

        {msg && <p className={`auth-msg ${msg.ok ? '' : 'auth-msg--err'}`} role="status">{msg.text}</p>}
        <button className="btn btn-gold btn-block" onClick={save} disabled={busy || !dirty}>
          {busy ? <span className="spinner spinner--sm" /> : <Save size={17} />} {dirty ? 'Save prices' : 'Saved'}
        </button>
      </section>
    </>
  )
}

const promoState = (p, t) =>
  p.active === false ? ['Paused', 'status status--out']
    : p.expires < t ? ['Expired', 'status status--bad']
      : p.maxUses != null && (p.used || 0) >= p.maxUses ? ['Used up', 'status status--bad']
        : ['Active', 'status status--in']

function Promos() {
  const { promos, loading, error } = usePromos()
  const t = today()
  const [f, setF] = useState({ code: '', percent: 10, expires: addDays(t, 30), maxUses: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const create = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      await api.createPromo({ code: f.code, percent: Number(f.percent), expires: f.expires, maxUses: f.maxUses === '' ? null : Number(f.maxUses) })
      setMsg({ ok: true, text: `${f.code} is live: ${f.percent}% off until ${prettyDate(f.expires)}.` })
      setF((x) => ({ ...x, code: '' }))
    } catch (e2) {
      setMsg({ ok: false, text: friendlyError(e2) })
    }
    setBusy(false)
  }

  const act = async (fn) => {
    setMsg(null)
    try { await fn() } catch (e) { setMsg({ ok: false, text: friendlyError(e) }) }
  }

  return (
    <section className="admin-card admin-card--wide">
      <div className="admin-card-head">
        <div>
          <h3><Tag size={18} /> Promo codes</h3>
          <p className="muted small">Guests type the code when booking. The discount comes off the room price, before service charge and tax.</p>
        </div>
      </div>

      <form className="promo-form room-editor" onSubmit={create} noValidate>
        <label className="field"><span>Code</span>
          <div className="input-wrap"><input value={f.code} placeholder="MONSOON10" maxLength={20} autoComplete="off"
            onChange={(e) => setF((x) => ({ ...x, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))} /></div></label>
        <label className="field"><span>% off</span>
          <div className="input-wrap"><input type="number" min={1} max={90} value={f.percent} onChange={(e) => setF((x) => ({ ...x, percent: e.target.value }))} /></div></label>
        <label className="field"><span>Valid until</span>
          <div className="input-wrap"><input type="date" min={t} value={f.expires} onChange={(e) => setF((x) => ({ ...x, expires: e.target.value }))} /></div></label>
        <label className="field"><span>Max uses <em>(optional)</em></span>
          <div className="input-wrap"><input type="number" min={1} value={f.maxUses} placeholder="No limit" onChange={(e) => setF((x) => ({ ...x, maxUses: e.target.value }))} /></div></label>
        <button className="btn btn-gold" disabled={busy || f.code.length < 3}>
          {busy ? <span className="spinner spinner--sm" /> : <Plus size={16} />} Create code
        </button>
      </form>
      {msg && <p className={`auth-msg ${msg.ok ? '' : 'auth-msg--err'}`} role="status">{msg.text}</p>}

      {loading ? <p className="muted small">Loading…</p>
        : error ? <p className="muted small">Couldn't load promo codes. Make sure the latest database rules are deployed.</p>
        : promos.length === 0 ? <p className="today-empty"><Tag size={16} /> No promo codes yet.</p>
        : (
          <div className="promo-table-wrap">
            <table className="admin-table promo-table">
              <thead><tr><th>Code</th><th>Discount</th><th>Used</th><th>Valid until</th><th>Status</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {promos.map((p) => {
                  const [label, cls] = promoState(p, t)
                  const pct = p.maxUses ? Math.min(100, ((p.used || 0) / p.maxUses) * 100) : 0
                  return (
                    <tr key={p.code}>
                      <td><span className="promo-code">{p.code}</span></td>
                      <td>{p.percent}% off</td>
                      <td>
                        <span className="promo-uses">{p.used || 0}{p.maxUses ? ` / ${p.maxUses}` : ' (no limit)'}</span>
                        {p.maxUses && <span className="promo-meter" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>}
                      </td>
                      <td>{prettyDate(p.expires)}</td>
                      <td><span className={cls}>{label}</span></td>
                      <td className="promo-actions">
                        <button className="icon-btn" title={p.active === false ? 'Resume' : 'Pause'} aria-label={p.active === false ? `Resume ${p.code}` : `Pause ${p.code}`}
                          onClick={() => act(() => api.updatePromo(p.code, { active: p.active === false }))}>
                          {p.active === false ? <Play size={15} /> : <Pause size={15} />}
                        </button>
                        <button className="icon-btn" title="Delete" aria-label={`Delete ${p.code}`}
                          onClick={() => window.confirm(`Delete ${p.code}? Bookings that used it keep their discount.`) && act(() => api.deletePromo(p.code))}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </section>
  )
}
