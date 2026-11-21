import Logo from './Logo'
import { formatLKR, prettyDate } from '../utils'
import { folioTotals, HOTEL, PAY_METHODS, tsDate } from '../lib/folio'
import { guestName } from '../lib/status'

const day = (d) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

/**
 * A4 invoice (or a single-payment receipt when `payment` is given).
 * Before the invoice number is issued (at check-out) it's a booking summary.
 */
export default function InvoiceDocument({ booking: b, payment }) {
  const t = folioTotals(b)
  const pr = b.price || {}
  const isReceipt = Boolean(payment)
  const issued = b.invoice?.number
  const title = isReceipt ? 'Receipt' : issued ? (t.balance <= 0 ? 'Invoice · Paid' : 'Invoice') : b.status === 'Cancelled' ? 'Booking summary · Cancelled' : 'Booking summary'
  const docNo = isReceipt ? payment.receipt : issued || '—'
  const docDate = isReceipt ? tsDate(payment.at) : tsDate(b.invoice?.issuedAt) || new Date()
  const left = b.checkOutActual || b.checkOut
  // Receipt: what was paid up to and including this payment
  const upTo = isReceipt ? (b.payments || []).slice(0, (b.payments || []).findIndex((p) => p.id === payment.id) + 1).reduce((s, p) => s + p.amount, 0) : 0

  return (
    <article className={`invoice ${t.balance <= 0 && (issued || isReceipt) ? 'is-paid' : ''}`}>
      <header className="inv-head">
        <div className="inv-brand">
          <Logo />
          <address>{HOTEL.name}<br />{HOTEL.address}<br />{HOTEL.phone} · {HOTEL.email}</address>
        </div>
        <div className="inv-title">
          <h1>{title}</h1>
          <dl>
            <dt>{isReceipt ? 'Receipt no.' : 'Invoice no.'}</dt><dd className="mono">{docNo}</dd>
            <dt>Date</dt><dd>{day(docDate)}</dd>
            <dt>Booking</dt><dd className="mono">{b.ref}</dd>
          </dl>
        </div>
      </header>

      <section className="inv-parties">
        <div>
          <h4>{isReceipt ? 'Received from' : 'Bill to'}</h4>
          <strong>{guestName(b)}</strong>
          {b.guest?.email && <span>{b.guest.email}</span>}
          {b.guest?.phone && <span>{b.guest.phone}</span>}
          {b.guest?.country && <span>{b.guest.country}</span>}
        </div>
        <div>
          <h4>Stay</h4>
          <strong>{b.roomName}{b.unit ? ` · Room ${b.unit}` : ''}</strong>
          <span>{prettyDate(b.checkIn)} → {prettyDate(left)}</span>
          <span>{b.nights} night{b.nights === 1 ? '' : 's'} · {b.guests} guest{b.guests === 1 ? '' : 's'}</span>
        </div>
      </section>

      {isReceipt ? (
        <table className="inv-table">
          <thead><tr><th>Description</th><th className="num">Amount</th></tr></thead>
          <tbody>
            <tr>
              <td>Payment for booking {b.ref}, {PAY_METHODS[payment.method]?.toLowerCase()}{payment.note ? <small>{payment.note}</small> : null}</td>
              <td className="num">{formatLKR(payment.amount)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="inv-total"><td>Amount received</td><td className="num">{formatLKR(payment.amount)}</td></tr>
            <tr><td>Bill total</td><td className="num">{formatLKR(t.total)}</td></tr>
            <tr><td>Paid up to this receipt</td><td className="num">{formatLKR(upTo)}</td></tr>
            <tr className="inv-balance"><td>Balance after this payment</td><td className="num">{formatLKR(Math.max(0, t.total - upTo))}</td></tr>
          </tfoot>
        </table>
      ) : (
        <table className="inv-table">
          <thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Amount</th></tr></thead>
          <tbody>
            <tr>
              <td>{b.roomName}<small>{prettyDate(b.checkIn)} → {prettyDate(left)}</small></td>
              <td className="num">{b.nights}</td>
              <td className="num">{formatLKR(pr.rate ?? (pr.rooms ?? b.total) / (b.nights || 1))}</td>
              <td className="num">{formatLKR(pr.rooms ?? pr.subtotal ?? b.total)}</td>
            </tr>
            {pr.discount > 0 && <tr className="inv-muted"><td colSpan={3}>Promo {pr.promo?.code} (−{pr.promo?.percent}%)</td><td className="num">− {formatLKR(pr.discount)}</td></tr>}
            {pr.service > 0 && <tr className="inv-muted"><td colSpan={3}>Service charge (10%)</td><td className="num">{formatLKR(pr.service)}</td></tr>}
            {pr.tax > 0 && <tr className="inv-muted"><td colSpan={3}>Taxes (8%)</td><td className="num">{formatLKR(pr.tax)}</td></tr>}
            {(b.charges || []).map((c) => (
              <tr key={c.id}>
                <td>{c.description}<small>{day(tsDate(c.at))}</small></td>
                <td className="num">{c.qty}</td>
                <td className="num">{formatLKR(c.unitPrice)}</td>
                <td className="num">{formatLKR(c.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {t.extras > 0 && <tr><td colSpan={3}>Room</td><td className="num">{formatLKR(t.room)}</td></tr>}
            {t.extras > 0 && <tr><td colSpan={3}>Extras</td><td className="num">{formatLKR(t.extras)}</td></tr>}
            <tr className="inv-total"><td colSpan={3}>Total</td><td className="num">{formatLKR(t.total)}</td></tr>
            {(b.payments || []).map((p) => (
              <tr key={p.id} className="inv-muted">
                <td colSpan={3}>Paid by {PAY_METHODS[p.method]?.toLowerCase()} · {day(tsDate(p.at))} · <span className="mono">{p.receipt}</span></td>
                <td className="num">− {formatLKR(p.amount)}</td>
              </tr>
            ))}
            <tr className="inv-balance"><td colSpan={3}>{t.balance > 0 ? 'Balance due' : t.balance < 0 ? 'Refund due to you' : 'Balance'}</td><td className="num">{formatLKR(Math.abs(t.balance))}</td></tr>
          </tfoot>
        </table>
      )}

      {isReceipt ? <div className="inv-stamp-row"><span className="inv-stamp">Received</span></div>
        : issued && t.balance <= 0 && <div className="inv-stamp-row"><span className="inv-stamp">Paid</span></div>}

      <footer className="inv-foot">
        {!issued && !isReceipt && b.status !== 'Cancelled' && <p><strong>This is not a final invoice.</strong> Your invoice is issued when you check out.</p>}
        {t.balance > 0 && (issued || b.status !== 'Cancelled') && !isReceipt && <p>Please pay the balance at the front desk{b.status === 'Confirmed' ? ' when you arrive' : ''}. We accept cash, cards and bank transfer.</p>}
        <p>Prices are in Sri Lankan rupees (LKR) and include the service charge and taxes shown. Thank you for staying with us.</p>
      </footer>
    </article>
  )
}
