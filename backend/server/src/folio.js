/*
 * Guest bill (staff only): extra charges, payments, the invoice number and the invoice email.
 * Stored on the booking: charges[], payments[], invoice { number, issuedAt }.
 * Every change runs in a transaction (two clerks at once can't lose each other's entries)
 * and is written to the activity log.
 *
 * Invoice and receipt numbers come from counters/{invoice|receipt}-{year}: sequential, no gaps
 * from failed writes (the number is taken in the same transaction that uses it).
 */
import { Timestamp } from 'firebase-admin/firestore'
import { db } from './firebase.js'
import { ApiError } from './errors.js'
import { parseRef, hotelToday } from './validate.js'
import { parseCharge, parsePayment, folioTotals, folioProblem, newId, invoiceNumber, receiptNumber, PAY_METHODS } from './folioRules.js'
import { logActivity, lkr } from './activity.js'
import { sendMail } from './mailer.js'
import { invoiceEmail } from './emailTemplates.js'

const bookingDoc = (ref) => db.collection('bookings').doc(ref)
const counterDoc = (kind, year) => db.collection('counters').doc(`${kind}-${year}`)
const by = (staff) => staff?.email ?? 'staff'

/** Reads the booking in a transaction and checks the bill is open. */
async function openBooking(tx, ref) {
  const snap = await tx.get(bookingDoc(ref))
  if (!snap.exists) throw new ApiError('not-found', 'Booking not found.')
  const b = snap.data()
  const problem = folioProblem(b)
  if (problem) throw new ApiError('failed-precondition', problem)
  return { snap, b }
}

/** Next number of a counter, inside a transaction (call before any writes in it). */
async function takeNumber(tx, kind) {
  const year = hotelToday().slice(0, 4)
  const ref = counterDoc(kind, year)
  const snap = await tx.get(ref)
  const seq = (snap.exists ? snap.get('seq') : 0) + 1
  return { year, seq, write: () => tx.set(ref, { seq, updatedAt: Timestamp.now() }, { merge: true }) }
}

const guestLabel = (b) => `${b.guest?.firstName ?? ''} ${b.guest?.lastName ?? ''}`.trim() || 'guest'

export async function addCharge(staff, refParam, body) {
  const ref = parseRef(refParam)
  const charge = { id: newId(), ...parseCharge(body), by: by(staff), at: Timestamp.now() }
  let b
  await db.runTransaction(async (tx) => {
    const r = await openBooking(tx, ref)
    b = r.b
    if ((b.charges || []).length >= 200) throw new ApiError('failed-precondition', 'This bill has too many charges.')
    tx.update(r.snap.ref, { charges: [...(b.charges || []), charge] })
  })
  await logActivity(staff, { action: 'booking.charge_added', target: { type: 'booking', id: ref, label: ref },
    summary: `Added a charge: ${charge.description}${charge.qty > 1 ? ` × ${charge.qty}` : ''}, ${lkr(charge.amount)} (${guestLabel(b)})` })
  return { ok: true, id: charge.id }
}

export async function removeCharge(staff, refParam, id) {
  const ref = parseRef(refParam)
  let removed
  await db.runTransaction(async (tx) => {
    const { snap, b } = await openBooking(tx, ref)
    removed = (b.charges || []).find((c) => c.id === id)
    if (!removed) throw new ApiError('not-found', 'Charge not found.')
    tx.update(snap.ref, { charges: b.charges.filter((c) => c.id !== id) })
  })
  await logActivity(staff, { action: 'booking.charge_removed', target: { type: 'booking', id: ref, label: ref },
    summary: `Removed a charge: ${removed.description}, ${lkr(removed.amount)} (added by ${removed.by})` })
  return { ok: true }
}

export async function addPayment(staff, refParam, body) {
  const ref = parseRef(refParam)
  const input = parsePayment(body)
  let payment, b
  await db.runTransaction(async (tx) => {
    const r = await openBooking(tx, ref)
    b = r.b
    const { balance } = folioTotals(b)
    if (balance <= 0) throw new ApiError('failed-precondition', 'Nothing is owed on this booking.')
    if (input.amount > balance) throw new ApiError('invalid-argument', `That's more than the balance (${lkr(balance)}).`)
    const n = await takeNumber(tx, 'receipt')
    payment = { id: newId(), ...input, receipt: receiptNumber(n.year, n.seq), by: by(staff), at: Timestamp.now() }
    n.write()
    tx.update(r.snap.ref, { payments: [...(b.payments || []), payment] })
  })
  const left = folioTotals({ ...b, payments: [...(b.payments || []), payment] }).balance
  await logActivity(staff, { action: 'booking.payment_added', target: { type: 'booking', id: ref, label: ref },
    summary: `Took ${lkr(payment.amount)} by ${PAY_METHODS[payment.method].toLowerCase()} from ${guestLabel(b)} (${payment.receipt})${left > 0 ? `, ${lkr(left)} still to pay` : ', paid in full'}`,
    details: payment.note || undefined })
  return { ok: true, id: payment.id, receipt: payment.receipt, balance: left }
}

/** Admin role only: for a payment entered by mistake. The receipt number is not reused. */
export async function removePayment(staff, refParam, id) {
  const ref = parseRef(refParam)
  let removed
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingDoc(ref))
    if (!snap.exists) throw new ApiError('not-found', 'Booking not found.')
    const b = snap.data()
    removed = (b.payments || []).find((p) => p.id === id)
    if (!removed) throw new ApiError('not-found', 'Payment not found.')
    tx.update(snap.ref, { payments: b.payments.filter((p) => p.id !== id) })
  })
  await logActivity(staff, { action: 'booking.payment_removed', target: { type: 'booking', id: ref, label: ref },
    summary: `Voided payment ${removed.receipt}: ${lkr(removed.amount)} by ${PAY_METHODS[removed.method]?.toLowerCase()} (taken by ${removed.by})` })
  return { ok: true }
}

/** Gives the booking its invoice number (once). staff = null when it happens at check-out. */
export async function issueInvoice(staff, refParam) {
  const ref = parseRef(refParam)
  const result = await db.runTransaction(async (tx) => {
    const { snap, b } = await openBooking(tx, ref)
    if (b.invoice?.number) return { number: b.invoice.number, created: false }
    const n = await takeNumber(tx, 'invoice')
    const number = invoiceNumber(n.year, n.seq)
    n.write()
    tx.update(snap.ref, { invoice: { number, issuedAt: Timestamp.now(), issuedBy: staff ? by(staff) : 'check-out' } })
    return { number, created: true }
  })
  if (result.created && staff) {
    await logActivity(staff, { action: 'booking.invoice_issued', target: { type: 'booking', id: ref, label: ref }, summary: `Issued invoice ${result.number}` })
  }
  return result
}

/** Email the invoice to the guest (issues the number first if needed). */
export async function emailInvoice(staff, refParam) {
  const ref = parseRef(refParam)
  const { number } = await issueInvoice(staff, ref)
  const b = (await bookingDoc(ref).get()).data()
  if (!b.guest?.email) throw new ApiError('failed-precondition', 'This booking has no guest email address.')
  const r = await sendMail({ to: [{ email: b.guest.email, name: guestLabel(b) }], ...invoiceEmail(b, folioTotals(b)) })
  await bookingDoc(ref).update({ 'emails.invoice': { status: r.status, at: Timestamp.now(), ...(r.error && { error: r.error.slice(0, 200) }) } })
  if (r.status !== 'sent') throw new ApiError('unavailable', r.status === 'skipped' ? 'Email is not set up on the server (BREVO_API_KEY / MAIL_FROM).' : `The email wasn't sent: ${r.error}`)
  if (staff) await logActivity(staff, { action: 'booking.invoice_emailed', target: { type: 'booking', id: ref, label: ref }, summary: `Emailed invoice ${number} to ${b.guest.email}` })
  return { ok: true, number, sentTo: b.guest.email }
}
