/*
 * Booking logic. The browser NEVER writes to Firestore directly (see backend/firestore.rules);
 * every change goes through these functions, which:
 *   - price the stay from server-side data (rooms.js)
 *   - keep per-night inventory in a transaction, so a room can't be over-booked
 */
import { randomInt } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { auth as adminAuth, db } from './firebase.js'
import { ApiError } from './errors.js'
import { offerFor, promoProblem, quoteStay } from './pricing.js'
import { offerFrom, offerRef, promoRef, rulesFrom, rulesRef } from './pricingStore.js'
import { later, sendBookingEmails, sendCancellationEmail } from './notify.js'
import { logActivity, lkr } from './activity.js'
import { getStaffRole } from './staff.js'
import { parseBookingRequest, parseRef, nightsOf, hotelToday } from './validate.js'

const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 3 // bookings per user per 10 minutes
const ACTIVE_MAX = 10 // upcoming confirmed bookings per user

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
const newRef = () => 'MRR-' + Array.from({ length: 8 }, () => REF_CHARS[randomInt(REF_CHARS.length)]).join('')
const invRef = (roomId, date) => db.collection('inventory').doc(`${roomId}_${date}`)


export async function createBooking(user, body) {
  const req = parseBookingRequest(body)

  // Per-account limits (outside the transaction; they only need to be roughly right)
  // One equality query (needs no composite index); counted in memory
  const mine = (await db.collection('bookings').where('uid', '==', user.uid).select('createdAt', 'status', 'checkOut').get()).docs
  const since = Date.now() - RATE_WINDOW_MS
  if (mine.filter((d) => d.get('createdAt')?.toMillis() >= since).length >= RATE_MAX) {
    throw new ApiError('resource-exhausted', 'Too many bookings in a short time. Please try again in a few minutes.')
  }
  const today = hotelToday()
  if (mine.filter((d) => d.get('status') === 'Confirmed' && d.get('checkOut') > today).length >= ACTIVE_MAX) {
    throw new ApiError('resource-exhausted', 'You have reached the limit of upcoming bookings. Please contact the hotel.')
  }

  const result = await reserve(req, { uid: user.uid, accountEmail: user.email ?? null, source: 'online' })
  later(sendBookingEmails(result.ref)) // confirmation to the guest + alert to staff, after saving
  await logActivity({ ...user, admin: false }, { action: 'booking.created', target: { type: 'booking', id: result.ref, label: result.ref },
    summary: `Booked online: ${req.guest.firstName} ${req.guest.lastName}, ${req.checkIn} → ${req.checkOut}${req.promo ? ` with promo ${req.promo}` : ''}` })
  return result
}

/**
 * Staff booking for a walk-in or phone guest (no guest account needed).
 * Same pricing + inventory transaction as online bookings; no per-account limits.
 * A walk-in arriving today can be checked in straight away.
 */
export async function createStaffBooking(staff, body) {
  const req = parseBookingRequest(body, { staff: true })
  const source = body?.source === 'phone' ? 'phone' : 'walk-in'
  const checkInNow = body?.checkInNow === true
  if (checkInNow && req.checkIn !== hotelToday()) {
    throw new ApiError('invalid-argument', 'Only a stay starting today can be checked in straight away.')
  }
  const result = await reserve(req, {
    uid: null, accountEmail: null, source, createdBy: staff.email ?? 'staff',
    ...(checkInNow && { status: 'CheckedIn', checkedInAt: FieldValue.serverTimestamp(), statusBy: staff.email ?? 'staff', statusAt: FieldValue.serverTimestamp() }),
  })
  if (req.guest.email) later(sendBookingEmails(result.ref))
  await logActivity(staff, { action: 'booking.staff_created', target: { type: 'booking', id: result.ref, label: result.ref },
    summary: `${source === 'phone' ? 'Phone' : 'Walk-in'} booking for ${req.guest.firstName} ${req.guest.lastName}, ${req.checkIn} → ${req.checkOut}${checkInNow ? ', checked in' : ''}` })
  return result
}

/** Shared core: price from Firestore, take one room on every night, create the booking. */
async function reserve(req, extra) {
  const nights = nightsOf(req.checkIn, req.nights)

  return db.runTransaction(async (tx) => {
    // reads first. The room is read inside the transaction, so a price or
    // room-count change by staff can't race with this booking.
    const roomSnap = await tx.get(db.collection('rooms').doc(req.roomId))
    const room = roomSnap.exists ? roomSnap.data() : null
    if (!room || room.active === false) throw new ApiError('invalid-argument', 'This room is not available for booking.')
    if (req.guests > room.guests) throw new ApiError('invalid-argument', `${room.name} sleeps up to ${room.guests} guests.`)

    // Season / weekend rules and the promo code are read in the same transaction,
    // so the usage limit can't be overshot by two guests at once
    const rulesSnap = await tx.get(rulesRef())
    const offer = offerFor(offerFrom(await tx.get(offerRef())), req.checkIn)
    let promo = null
    if (req.promo) {
      const p = await tx.get(promoRef(req.promo))
      const problem = promoProblem(p.exists ? p.data() : null, hotelToday())
      if (problem) throw new ApiError('failed-precondition', problem)
      promo = { code: req.promo, percent: p.get('percent') }
    }
    const price = quoteStay(room.price, nights, rulesFrom(rulesSnap), promo, null, offer)

    let ref = newRef()
    for (let i = 0; i < 5 && (await tx.get(db.collection('bookings').doc(ref))).exists; i++) ref = newRef()

    const inv = await Promise.all(nights.map((d) => tx.get(invRef(req.roomId, d))))
    const full = inv.findIndex((snap) => (snap.exists ? snap.get('booked') : 0) >= room.units)
    if (full !== -1) {
      throw new ApiError('failed-precondition', `Sorry, ${room.name} is fully booked on ${nights[full]}. Please try other dates.`)
    }

    // then writes
    // only counts as a use when the code really gave the discount (not when the offer saved more)
    if (price.promo) tx.update(promoRef(price.promo.code), { used: FieldValue.increment(1) })
    nights.forEach((date, i) => {
      if (inv[i].exists) tx.update(invRef(req.roomId, date), { booked: FieldValue.increment(1) })
      else tx.set(invRef(req.roomId, date), { roomId: req.roomId, date, booked: 1 })
    })
    tx.create(db.collection('bookings').doc(ref), {
      ref,
      roomId: req.roomId,
      roomName: room.name,
      image: room.image,
      checkIn: req.checkIn,
      checkOut: req.checkOut,
      nights: req.nights,
      guests: req.guests,
      payment: req.payment,
      price,
      total: price.total,
      guest: req.guest,
      status: 'Confirmed',
      createdAt: FieldValue.serverTimestamp(),
      ...extra,
    })
    return { ref }
  })
}

/** Owner can cancel before check-in day; admin can cancel any confirmed booking. */
export async function cancelBooking(user, refParam) {
  const ref = parseRef(refParam)
  const admin = user.admin === true

  let cancelled
  await db.runTransaction(async (tx) => {
    const bookingRef = db.collection('bookings').doc(ref)
    const snap = await tx.get(bookingRef)
    // Same error for "missing" and "not yours", so refs can't be probed
    if (!snap.exists || (!admin && snap.get('uid') !== user.uid)) throw new ApiError('not-found', 'Booking not found.')
    const b = snap.data()
    cancelled = b
    if (b.status !== 'Confirmed') throw new ApiError('failed-precondition', 'This booking is already cancelled.')
    if (!admin && b.checkIn <= hotelToday()) {
      throw new ApiError('failed-precondition', 'This stay has already started. Please contact the hotel to make changes.')
    }

    const nights = nightsOf(b.checkIn, b.nights)
    const inv = await Promise.all(nights.map((d) => tx.get(invRef(b.roomId, d))))
    // A cancelled booking gives its promo-code use back
    const promoSnap = b.price?.promo?.code ? await tx.get(promoRef(b.price.promo.code)) : null
    if (promoSnap?.exists && (promoSnap.get('used') || 0) > 0) tx.update(promoSnap.ref, { used: FieldValue.increment(-1) })
    nights.forEach((date, i) => {
      if (inv[i].exists && inv[i].get('booked') > 0) tx.update(invRef(b.roomId, date), { booked: FieldValue.increment(-1) })
    })
    tx.update(bookingRef, {
      status: 'Cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: admin && b.uid !== user.uid ? 'hotel' : 'guest',
    })
  })
  later(sendCancellationEmail(ref))
  const byHotel = admin && cancelled.uid !== user.uid
  await logActivity({ ...user, admin: byHotel }, { action: 'booking.cancelled', target: { type: 'booking', id: ref, label: ref },
    summary: `Cancelled ${byHotel ? 'by the hotel' : 'by the guest'}: ${cancelled.guest?.firstName ?? ''} ${cancelled.guest?.lastName ?? ''}, ${cancelled.roomName}, ${cancelled.checkIn} → ${cancelled.checkOut} (${lkr(cancelled.total)})` })
  return { ok: true }
}

/*
 * Staff = owners in ADMIN_EMAILS + people added on the dashboard Staff page. After signing in, the site calls this once;
 * it sets or removes the `admin` custom claim to match. Nobody can make themselves admin
 * from the browser.
 */
export async function syncAdminClaim(user) {
  // Owners (ADMIN_EMAILS) + staff added from the dashboard (staff.js)
  const role = await getStaffRole(user.email)
  const shouldBeAdmin = Boolean(role)
  if (shouldBeAdmin === (user.admin === true) && (role || null) === (user.role || null)) return { admin: shouldBeAdmin, role, changed: false }

  const record = await adminAuth.getUser(user.uid)
  await adminAuth.setCustomUserClaims(user.uid, { ...(record.customClaims || {}), admin: shouldBeAdmin, role: role || null })
  console.info('staff claim changed', { uid: user.uid, admin: shouldBeAdmin, role })
  return { admin: shouldBeAdmin, role, changed: true }
}
