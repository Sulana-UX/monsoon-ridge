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
import { priceFor } from './rooms.js'
import { parseBookingRequest, parseRef, nightsOf, hotelToday } from './validate.js'

const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 3 // bookings per user per 10 minutes
const ACTIVE_MAX = 10 // upcoming confirmed bookings per user

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
const newRef = () => 'MRR-' + Array.from({ length: 8 }, () => REF_CHARS[randomInt(REF_CHARS.length)]).join('')
const invRef = (roomId, date) => db.collection('inventory').doc(`${roomId}_${date}`)

const list = (v) => (v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

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

  const nights = nightsOf(req.checkIn, req.nights)

  return db.runTransaction(async (tx) => {
    // reads first. The room is read inside the transaction, so a price or
    // room-count change by staff can't race with this booking.
    const roomSnap = await tx.get(db.collection('rooms').doc(req.roomId))
    const room = roomSnap.exists ? roomSnap.data() : null
    if (!room || room.active === false) throw new ApiError('invalid-argument', 'This room is not available for booking.')
    if (req.guests > room.guests) throw new ApiError('invalid-argument', `${room.name} sleeps up to ${room.guests} guests.`)
    const price = priceFor(room.price, req.nights)

    let ref = newRef()
    for (let i = 0; i < 5 && (await tx.get(db.collection('bookings').doc(ref))).exists; i++) ref = newRef()

    const inv = await Promise.all(nights.map((d) => tx.get(invRef(req.roomId, d))))
    const full = inv.findIndex((snap) => (snap.exists ? snap.get('booked') : 0) >= room.units)
    if (full !== -1) {
      throw new ApiError('failed-precondition', `Sorry, ${room.name} is fully booked on ${nights[full]}. Please try other dates.`)
    }

    // then writes
    nights.forEach((date, i) => {
      if (inv[i].exists) tx.update(invRef(req.roomId, date), { booked: FieldValue.increment(1) })
      else tx.set(invRef(req.roomId, date), { roomId: req.roomId, date, booked: 1 })
    })
    tx.create(db.collection('bookings').doc(ref), {
      ref,
      uid: user.uid,
      accountEmail: user.email ?? null,
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
    })
    return { ref }
  })
}

/** Owner can cancel before check-in day; admin can cancel any confirmed booking. */
export async function cancelBooking(user, refParam) {
  const ref = parseRef(refParam)
  const admin = user.admin === true

  await db.runTransaction(async (tx) => {
    const bookingRef = db.collection('bookings').doc(ref)
    const snap = await tx.get(bookingRef)
    // Same error for "missing" and "not yours", so refs can't be probed
    if (!snap.exists || (!admin && snap.get('uid') !== user.uid)) throw new ApiError('not-found', 'Booking not found.')
    const b = snap.data()
    if (b.status !== 'Confirmed') throw new ApiError('failed-precondition', 'This booking is already cancelled.')
    if (!admin && b.checkIn <= hotelToday()) {
      throw new ApiError('failed-precondition', 'This stay has already started. Please contact the hotel to make changes.')
    }

    const nights = nightsOf(b.checkIn, b.nights)
    const inv = await Promise.all(nights.map((d) => tx.get(invRef(b.roomId, d))))
    nights.forEach((date, i) => {
      if (inv[i].exists && inv[i].get('booked') > 0) tx.update(invRef(b.roomId, date), { booked: FieldValue.increment(-1) })
    })
    tx.update(bookingRef, {
      status: 'Cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: admin && b.uid !== user.uid ? 'hotel' : 'guest',
    })
  })
  return { ok: true }
}

/*
 * Staff accounts are listed in ADMIN_EMAILS. After signing in, the site calls this once;
 * it sets or removes the `admin` custom claim to match. Nobody can make themselves admin
 * from the browser.
 */
export async function syncAdminClaim(user) {
  const shouldBeAdmin = list(process.env.ADMIN_EMAILS).includes((user.email || '').toLowerCase())
  if (shouldBeAdmin === (user.admin === true)) return { admin: shouldBeAdmin, changed: false }

  const record = await adminAuth.getUser(user.uid)
  await adminAuth.setCustomUserClaims(user.uid, { ...(record.customClaims || {}), admin: shouldBeAdmin })
  console.info('admin claim changed', { uid: user.uid, admin: shouldBeAdmin })
  return { admin: shouldBeAdmin, changed: true }
}
