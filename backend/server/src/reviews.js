/*
 * Guest reviews.
 *   reviews/{bookingRef} { ref, roomId, roomName, rating, title, text, name, stayMonth, status, createdAt, reply? }
 * The document is public when status == 'published', so it holds nothing private
 * (no email, no uid, no staff names). Who did what is in the activity log instead.
 *
 * Who can write one: the guest who stayed, either signed in (their booking) or through the
 * private link in the "How was your stay?" email sent at check-out (walk-ins have no account).
 * Room totals (reviewCount, reviewSum, ratingAvg) change in the same transaction as the review.
 */
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firebase.js'
import { ApiError } from './errors.js'
import { parseRef, hotelToday } from './validate.js'
import { parseReview, publicName, reviewProblem, applyRating, newToken, hashToken, tokenMatches, parseReply } from './reviewRules.js'
import { sendMail } from './mailer.js'
import { reviewRequest, checkoutEmail } from './emailTemplates.js'
import { folioTotals } from './folioRules.js'
import { logActivity } from './activity.js'

const bookingDoc = (ref) => db.collection('bookings').doc(ref)
const reviewDoc = (ref) => db.collection('reviews').doc(ref)
const roomDoc = (id) => db.collection('rooms').doc(id)
const site = () => (process.env.SITE_URL || 'https://monsoon-ridge.web.app').replace(/\/$/, '')

/** Throws unless this request may review the booking: the guest's own account, or the emailed link. */
function checkAccess(b, { token, user }) {
  if (user?.uid && b.uid && user.uid === b.uid) return
  if (tokenMatches(token, b.reviewTokenHash)) return
  throw new ApiError('permission-denied', 'This review link is not valid. Please use the link in your email, or sign in with the account you booked with.')
}

/**
 * Email the guest a private review link. At check-out (no staff) it's the combined
 * "thank you + your receipt + how was your stay?" email; staff can resend just the review request.
 */
export async function sendReviewInvite(refParam, { staff } = {}) {
  const ref = parseRef(refParam)
  const snap = await bookingDoc(ref).get()
  if (!snap.exists) throw new ApiError('not-found', 'Booking not found.')
  const b = snap.data()
  if (staff) {
    const problem = reviewProblem(b, hotelToday())
    if (problem) throw new ApiError('failed-precondition', b.review ? 'This guest has already left a review.' : problem.replace('You can review your stay', 'Guests can review'))
    if (!b.guest?.email) throw new ApiError('failed-precondition', 'This booking has no guest email address.')
  } else if (b.review || !b.guest?.email) return { status: 'skipped' }

  const token = newToken()
  await bookingDoc(ref).update({ reviewTokenHash: hashToken(token) })
  const link = `${site()}/review/${ref}?t=${token}`
  const content = staff ? reviewRequest(b, link) : checkoutEmail(b, folioTotals(b), link)
  const result = await sendMail({ to: [{ email: b.guest.email, name: [b.guest.firstName, b.guest.lastName].filter(Boolean).join(' ') }], ...content })
  const record = { status: result.status, at: FieldValue.serverTimestamp(), ...(result.error && { error: result.error.slice(0, 200) }) }
  await bookingDoc(ref).update({ 'emails.review': record, ...(!staff && { 'emails.invoice': record }) })
  if (staff) {
    if (result.status !== 'sent') throw new ApiError('unavailable', result.status === 'skipped' ? 'Email is not set up on the server (BREVO_API_KEY / MAIL_FROM).' : `The email wasn't sent: ${result.error}`)
    await logActivity(staff, { action: 'review.invite_sent', target: { type: 'booking', id: ref, label: ref }, summary: `Sent a review request to ${b.guest.firstName ?? 'the guest'}` })
  }
  return { status: result.status }
}

/** The review page: what stay is this, and can it be reviewed? */
export async function getReviewStay(refParam, access) {
  const ref = parseRef(refParam)
  const snap = await bookingDoc(ref).get()
  if (!snap.exists) throw new ApiError('not-found', 'Booking not found.')
  const b = snap.data()
  checkAccess(b, access)
  const existing = b.review ? (await reviewDoc(ref).get()).data() : null
  return {
    ref, roomId: b.roomId, roomName: b.roomName, image: b.image || null,
    checkIn: b.checkIn, checkOut: b.checkOutActual || b.checkOut, firstName: b.guest?.firstName || '',
    problem: b.review ? null : reviewProblem(b, hotelToday()),
    review: existing && { rating: existing.rating, title: existing.title, text: existing.text, status: existing.status },
  }
}

export async function submitReview(refParam, access, body) {
  const ref = parseRef(refParam)
  const input = parseReview(body)
  let b
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingDoc(ref))
    if (!snap.exists) throw new ApiError('not-found', 'Booking not found.')
    b = snap.data()
    checkAccess(b, access)
    const problem = reviewProblem(b, hotelToday())
    if (problem) throw new ApiError('failed-precondition', problem)
    const room = await tx.get(roomDoc(b.roomId))

    tx.create(reviewDoc(ref), {
      ref, roomId: b.roomId, roomName: b.roomName, ...input,
      name: publicName(b.guest), stayMonth: (b.checkOutActual || b.checkOut).slice(0, 7),
      status: 'published', createdAt: FieldValue.serverTimestamp(),
    })
    if (room.exists) tx.update(room.ref, applyRating(room.data(), input.rating, +1))
    // the link keeps working, but only to show the review (b.review blocks a second one)
    tx.update(snap.ref, { review: { rating: input.rating, at: FieldValue.serverTimestamp() } })
  })
  await logActivity({ email: b.guest?.email || 'guest', admin: false }, { action: 'review.created', target: { type: 'booking', id: ref, label: ref },
    summary: `${publicName(b.guest)} left a ${input.rating}★ review for ${b.roomName}`, details: [input.title, input.text].filter(Boolean).join('\n') })
  return { ok: true }
}

/** Staff (Admin role): hide a review from the website, or show it again. Room totals follow. */
export async function setReviewStatus(staff, refParam, status) {
  const ref = parseRef(refParam)
  if (!['published', 'hidden'].includes(status)) throw new ApiError('invalid-argument', 'Unknown status.')
  let r
  const changed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(reviewDoc(ref))
    if (!snap.exists) throw new ApiError('not-found', 'Review not found.')
    r = snap.data()
    if (r.status === status) return false
    const room = await tx.get(roomDoc(r.roomId))
    if (room.exists) tx.update(room.ref, applyRating(room.data(), r.rating, status === 'published' ? +1 : -1))
    tx.update(snap.ref, { status })
    return true
  })
  if (changed) await logActivity(staff, { action: status === 'hidden' ? 'review.hidden' : 'review.shown', target: { type: 'booking', id: ref, label: ref },
    summary: `${status === 'hidden' ? 'Hid' : 'Showed again'} ${r.name}'s ${r.rating}★ review of ${r.roomName}` })
  return { ok: true, status }
}

/** Staff: public answer under the review ("Response from Monsoon Ridge"). Empty text removes it. */
export async function replyToReview(staff, refParam, body) {
  const ref = parseRef(refParam)
  const text = parseReply(body)
  const snap = await reviewDoc(ref).get()
  if (!snap.exists) throw new ApiError('not-found', 'Review not found.')
  await snap.ref.update({ reply: text ? { text, at: FieldValue.serverTimestamp() } : FieldValue.delete() })
  await logActivity(staff, { action: text ? 'review.replied' : 'review.reply_removed', target: { type: 'booking', id: ref, label: ref },
    summary: `${text ? 'Answered' : 'Removed the answer to'} ${snap.get('name')}'s review of ${snap.get('roomName')}`, details: text || undefined })
  return { ok: true }
}
