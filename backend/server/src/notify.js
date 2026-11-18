/*
 * Booking emails. Called AFTER the booking is saved, never inside the transaction:
 * a slow or failing email service can't block or undo a booking.
 * The result is written to the booking (emails.confirmation / emails.cancellation)
 * so staff can see in the dashboard whether the guest got it, and resend.
 */
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firebase.js'
import { ApiError } from './errors.js'
import { mailEnabled, sendMail, staffRecipients } from './mailer.js'
import { bookingConfirmation, bookingCancelled, staffNewBooking } from './emailTemplates.js'
import { parseRef } from './validate.js'

const bookingDoc = (ref) => db.collection('bookings').doc(ref)

async function record(ref, kind, result) {
  await bookingDoc(ref).update({
    [`emails.${kind}`]: { status: result.status, at: FieldValue.serverTimestamp(), ...(result.error && { error: result.error.slice(0, 200) }) },
  })
}

const toGuest = (b) => (b.guest?.email ? [{ email: b.guest.email, name: [b.guest.firstName, b.guest.lastName].filter(Boolean).join(' ') }] : [])

/** Guest confirmation (+ staff alert for online bookings). Returns the guest email result. */
export async function sendBookingEmails(ref, { staffAlert = true } = {}) {
  const snap = await bookingDoc(ref).get()
  if (!snap.exists) return { status: 'skipped' }
  const b = snap.data()

  const guest = await sendMail({ to: toGuest(b), ...bookingConfirmation(b) })
  await record(ref, 'confirmation', guest.status === 'skipped' && !b.guest?.email ? { status: 'skipped', error: 'No guest email.' } : guest)

  if (staffAlert && b.source === 'online') {
    const staff = await sendMail({ to: staffRecipients(), replyTo: toGuest(b)[0], ...staffNewBooking(b) })
    if (staff.status === 'failed') console.error('staff alert failed', ref, staff.error)
  }
  return guest
}

export async function sendCancellationEmail(ref) {
  const snap = await bookingDoc(ref).get()
  if (!snap.exists || !snap.get('guest.email')) return
  const result = await sendMail({ to: toGuest(snap.data()), ...bookingCancelled(snap.data()) })
  await record(ref, 'cancellation', result)
}

/** Fire and forget: log problems, never reject. */
export const later = (promise) => promise.catch((e) => console.error('email task failed', e))

/** Staff: send the confirmation again (e.g. guest says it didn't arrive, or email was added later). */
export async function resendConfirmation(refParam) {
  const ref = parseRef(refParam)
  if (!mailEnabled()) throw new ApiError('failed-precondition', "Email isn't set up on the server yet (BREVO_API_KEY and MAIL_FROM).")
  const snap = await bookingDoc(ref).get()
  if (!snap.exists) throw new ApiError('not-found', 'Booking not found.')
  if (!snap.get('guest.email')) throw new ApiError('failed-precondition', 'This booking has no guest email address.')
  const result = await sendBookingEmails(ref, { staffAlert: false })
  if (result.status !== 'sent') throw new ApiError('failed-precondition', `The email could not be sent: ${result.error || 'unknown error'}`)
  return { ok: true }
}
