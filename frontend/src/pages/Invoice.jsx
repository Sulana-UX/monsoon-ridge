import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Printer, Mail, FileCheck2 } from 'lucide-react'
import InvoiceDocument from '../components/InvoiceDocument'
import { useBookingByRef } from '../lib/bookings'
import { useAuth } from '../context/AuthContext'
import { api, friendlyError } from '../lib/firebase'
import NotFound from './NotFound'

/**
 * /invoice/:ref            the bill (guests: their own bookings; staff: any)
 * /invoice/:ref?receipt=ID one payment's receipt
 * Print / "Save as PDF" uses the browser's print dialog; the page has print styles.
 */
export default function Invoice() {
  const { ref } = useParams()
  const [params] = useSearchParams()
  const { isAdmin } = useAuth()
  const { booking: b, loading } = useBookingByRef(ref)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)

  if (loading) return <div className="page-loading"><span className="spinner" /></div>
  if (!b) return <NotFound />
  const payment = params.get('receipt') ? (b.payments || []).find((p) => p.id === params.get('receipt')) : null
  if (params.get('receipt') && !payment) return <NotFound />

  const run = async (what, fn, ok) => {
    setBusy(what)
    setMsg(null)
    try {
      const { data } = await fn()
      setMsg({ ok: true, text: ok(data) })
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e) })
    }
    setBusy('')
  }
  const back = isAdmin ? `/admin/bookings/${b.ref}` : '/my-bookings'
  const doc = payment ? 'receipt' : 'invoice'

  return (
    <div className="invoice-page">
      <div className="invoice-bar no-print">
        <Link to={back} className="back-link"><ChevronLeft size={16} /> {isAdmin ? 'Back to booking' : 'My bookings'}</Link>
        <div className="invoice-actions">
          {isAdmin && !payment && !b.invoice?.number && b.status !== 'Cancelled' && (
            <button className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => run('issue', () => api.issueInvoice(b.ref), (d) => `Invoice ${d.number} issued.`)}>
              {busy === 'issue' ? <span className="spinner spinner--sm" /> : <FileCheck2 size={15} />} Issue invoice number
            </button>
          )}
          {isAdmin && !payment && b.guest?.email && b.status !== 'Cancelled' && (
            <button className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => run('email', () => api.emailInvoice(b.ref), (d) => `Invoice ${d.number} sent to ${d.sentTo}.`)}>
              {busy === 'email' ? <span className="spinner spinner--sm" /> : <Mail size={15} />} Email to guest
            </button>
          )}
          <button className="btn btn-gold btn-sm" onClick={() => window.print()}><Printer size={15} /> Print or save PDF</button>
        </div>
        {msg && <p className={`auth-msg ${msg.ok ? '' : 'auth-msg--err'}`} role="status">{msg.text}</p>}
        <p className="invoice-hint muted small">To save the {doc} as a PDF, choose <strong>Save as PDF</strong> as the printer.</p>
      </div>
      <InvoiceDocument booking={b} payment={payment} />
    </div>
  )
}
