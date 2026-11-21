import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Wallet, FileText, Receipt, X, ShoppingBag } from 'lucide-react'
import PriceLines from '../../components/PriceLines'
import { api, friendlyError } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { useDialog } from '../../components/Dialog'
import { folioTotals, PAY_METHODS, tsDate, shortWhen } from '../../lib/folio'
import { formatLKR } from '../../utils'

const CHARGE_IDEAS = ['Dinner', 'Lunch', 'Breakfast', 'Room service', 'Minibar', 'Spa treatment', 'Laundry', 'Airport transfer', 'Tour']

/** Booking page: the guest's bill. Staff add extras and take payments; the invoice is built from this. */
export default function Folio({ booking: b, price }) {
  const { isManager } = useAuth()
  const dialog = useDialog()
  const t = folioTotals(b)
  const open = b.status !== 'Cancelled'
  const [form, setForm] = useState(null) // 'charge' | 'payment' | null
  const [err, setErr] = useState('')

  const remove = async (kind, item) => {
    const isPay = kind === 'payment'
    const ok = await dialog.confirm(isPay
      ? { title: `Void payment ${item.receipt}?`, message: `${formatLKR(item.amount)} by ${PAY_METHODS[item.method].toLowerCase()}. Only for a payment entered by mistake. The activity log keeps a record.`, confirmLabel: 'Void payment', danger: true }
      : { title: 'Remove this charge?', message: `${item.description}, ${formatLKR(item.amount)}.`, confirmLabel: 'Remove charge', danger: true })
    if (!ok) return
    setErr('')
    try { await (isPay ? api.removePayment(b.ref, item.id) : api.removeCharge(b.ref, item.id)) } catch (e) { setErr(friendlyError(e)) }
  }

  return (
    <section className="admin-card admin-card--7 folio">
      <div className="folio-head">
        <h3 className="bd-title">Bill</h3>
        <div className="folio-head-actions no-print">
          {b.invoice?.number && <span className="folio-inv mono">{b.invoice.number}</span>}
          <Link to={`/invoice/${b.ref}`} className="btn btn-outline btn-sm"><FileText size={15} /> {b.invoice?.number ? 'Invoice' : 'Bill preview'}</Link>
        </div>
      </div>

      <PriceLines price={price || b.price} className="price-lines bd-price" />

      <div className="folio-block">
        <h4><ShoppingBag size={15} /> Extras</h4>
        {(b.charges || []).length === 0 ? <p className="muted small">No extras yet. Add meals, spa, transfers and so on here.</p> : (
          <ul className="folio-list">
            {b.charges.map((c) => (
              <li key={c.id}>
                <span><strong>{c.description}</strong>{c.qty > 1 && ` × ${c.qty}`}<small>{shortWhen(tsDate(c.at))} · {c.by}</small></span>
                <span className="folio-amt">{formatLKR(c.amount)}</span>
                {open && <button className="icon-btn no-print" aria-label={`Remove ${c.description}`} onClick={() => remove('charge', c)}><Trash2 size={14} /></button>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="folio-sum">
        <div><span>Total</span><strong>{formatLKR(t.total)}</strong></div>
      </div>

      <div className="folio-block">
        <h4><Wallet size={15} /> Payments</h4>
        {(b.payments || []).length === 0 ? <p className="muted small">Nothing paid yet.</p> : (
          <ul className="folio-list">
            {b.payments.map((p) => (
              <li key={p.id}>
                <span><strong>{PAY_METHODS[p.method]}</strong> <span className="mono small">{p.receipt}</span><small>{shortWhen(tsDate(p.at))} · {p.by}{p.note ? ` · ${p.note}` : ''}</small></span>
                <span className="folio-amt">− {formatLKR(p.amount)}</span>
                <Link to={`/invoice/${b.ref}?receipt=${p.id}`} className="icon-btn no-print" aria-label={`Receipt ${p.receipt}`} title="Receipt"><Receipt size={14} /></Link>
                {isManager && <button className="icon-btn no-print" aria-label={`Void payment ${p.receipt}`} title="Void payment" onClick={() => remove('payment', p)}><Trash2 size={14} /></button>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`folio-balance ${t.balance > 0 ? 'is-due' : t.balance < 0 ? 'is-refund' : 'is-paid'}`}>
        <span>{t.balance > 0 ? 'Balance due' : t.balance < 0 ? 'Refund due to guest' : 'Paid in full'}</span>
        <strong>{formatLKR(Math.abs(t.balance))}</strong>
      </div>

      {err && <p className="auth-msg auth-msg--err" role="alert">{err}</p>}

      {open && (
        <div className="no-print">
          {form === 'charge' ? <ChargeForm b={b} onClose={() => setForm(null)} />
            : form === 'payment' ? <PaymentForm b={b} balance={t.balance} onClose={() => setForm(null)} />
              : (
                <div className="folio-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => setForm('charge')}><Plus size={15} /> Add extra</button>
                  {t.balance > 0 && <button className="btn btn-gold btn-sm" onClick={() => setForm('payment')}><Wallet size={15} /> Take payment</button>}
                </div>
              )}
        </div>
      )}
    </section>
  )
}

function ChargeForm({ b, onClose }) {
  const [f, setF] = useState({ description: '', qty: 1, unitPrice: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const amount = (Number(f.qty) || 0) * (Number(String(f.unitPrice).replace(/,/g, '')) || 0)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try { await api.addCharge(b.ref, f); onClose() } catch (e2) { setErr(friendlyError(e2)) }
    setBusy(false)
  }
  return (
    <form className="folio-form" onSubmit={submit}>
      <div className="folio-form-row">
        <label className="ff-desc"><span>What</span>
          <input value={f.description} onChange={set('description')} maxLength={80} placeholder="e.g. Dinner for two" list="charge-ideas" autoFocus required />
          <datalist id="charge-ideas">{CHARGE_IDEAS.map((x) => <option key={x} value={x} />)}</datalist>
        </label>
        <label className="ff-qty"><span>Qty</span><input type="number" min={1} max={99} value={f.qty} onChange={set('qty')} /></label>
        <label className="ff-price"><span>Price each (LKR)</span><input inputMode="numeric" value={f.unitPrice} onChange={set('unitPrice')} placeholder="4,500" required /></label>
      </div>
      {err && <p className="auth-msg auth-msg--err" role="alert">{err}</p>}
      <div className="folio-actions">
        <button type="submit" className="btn btn-gold btn-sm" disabled={busy}>{busy ? <span className="spinner spinner--sm" /> : <Plus size={15} />} Add {amount > 0 ? formatLKR(amount) : 'extra'}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}><X size={15} /> Cancel</button>
      </div>
    </form>
  )
}

function PaymentForm({ b, balance, onClose }) {
  const [f, setF] = useState({ amount: String(balance), method: b.payment === 'card' ? 'card' : 'cash', note: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try { await api.addPayment(b.ref, f); onClose() } catch (e2) { setErr(friendlyError(e2)) }
    setBusy(false)
  }
  return (
    <form className="folio-form" onSubmit={submit}>
      <div className="folio-form-row">
        <label className="ff-price"><span>Amount (LKR)</span><input inputMode="numeric" value={f.amount} onChange={set('amount')} autoFocus required /></label>
        <label className="ff-method"><span>Paid by</span>
          <select value={f.method} onChange={set('method')}>{Object.entries(PAY_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <label className="ff-desc"><span>Note <em>(optional)</em></span><input value={f.note} onChange={set('note')} maxLength={120} placeholder="e.g. Card ending 4242" /></label>
      </div>
      <p className="muted small">Balance {formatLKR(balance)}. A receipt number is given automatically.</p>
      {err && <p className="auth-msg auth-msg--err" role="alert">{err}</p>}
      <div className="folio-actions">
        <button type="submit" className="btn btn-gold btn-sm" disabled={busy}>{busy ? <span className="spinner spinner--sm" /> : <Wallet size={15} />} Record payment</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}><X size={15} /> Cancel</button>
      </div>
    </form>
  )
}
