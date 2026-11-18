/*
 * Monsoon Ridge backend (Firebase Cloud Functions v2, callable).
 *
 * The browser NEVER writes to Firestore directly (see backend/firestore.rules).
 * Every change to bookings goes through these functions, which:
 *   - require a signed-in user with a verified email
 *   - validate and normalise all input
 *   - price the stay from server-side data (src/rooms.js)
 *   - keep per-night inventory in a transaction, so a room can't be over-booked
 */
import { randomInt } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { ROOMS, priceFor } from './rooms.js'
import { parseBookingRequest, parseRef, nightsOf, hotelToday } from './validate.js'

initializeApp()
const db = getFirestore()

setGlobalOptions({ region: 'asia-south1', maxInstances: 10 })

const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean)

const callOpts = {
  // Only our own site may call these (browsers enforce this; tokens are still checked below).
  cors: list(process.env.ALLOWED_ORIGINS).length ? list(process.env.ALLOWED_ORIGINS) : true,
  // Turn on once App Check is registered in the console (see README).
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
}

const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 3 // bookings per user per 10 minutes
const ACTIVE_MAX = 10 // upcoming confirmed bookings per user

/* ---------- helpers ---------- */

function requireVerifiedUser(request) {
  const auth = request.auth
  if (!auth) throw new HttpsError('unauthenticated', 'Please sign in first.')
  if (!auth.token.email_verified) throw new HttpsError('permission-denied', 'Please verify your email address first.')
  return auth
}

const isAdmin = (auth) => auth?.token?.admin === true

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
const newRef = () => 'MRR-' + Array.from({ length: 8 }, () => REF_CHARS[randomInt(REF_CHARS.length)]).join('')

const invRef = (roomId, date) => db.collection('inventory').doc(`${roomId}_${date}`)

/* ---------- createBooking ---------- */

export const createBooking = onCall(callOpts, async (request) => {
  const auth = requireVerifiedUser(request)
  const req = parseBookingRequest(request.data)

  const room = ROOMS[req.roomId]
  if (!room) throw new HttpsError('invalid-argument', 'Unknown room.')
  if (req.guests > room.guests) {
    throw new HttpsError('invalid-argument', `${room.name} sleeps up to ${room.guests} guests.`)
  }

  // Rate limits (outside the transaction; they only need to be roughly right)
  const mine = db.collection('bookings').where('uid', '==', auth.uid)
  const recent = await mine
    .where('createdAt', '>=', Timestamp.fromMillis(Date.now() - RATE_WINDOW_MS))
    .count().get()
  if (recent.data().count >= RATE_MAX) {
    throw new HttpsError('resource-exhausted', 'Too many bookings in a short time. Please try again in a few minutes.')
  }
  const today = hotelToday()
  const active = await mine.where('status', '==', 'Confirmed').get()
  if (active.docs.filter((d) => d.get('checkOut') > today).length >= ACTIVE_MAX) {
    throw new HttpsError('resource-exhausted', 'You have reached the limit of upcoming bookings. Please contact the hotel.')
  }

  const price = priceFor(room.price, req.nights)
  const nights = nightsOf(req.checkIn, req.nights)

  const ref = await db.runTransaction(async (tx) => {
    // reads first
    let ref = newRef()
    for (let i = 0; i < 5 && (await tx.get(db.collection('bookings').doc(ref))).exists; i++) ref = newRef()

    const inv = await Promise.all(nights.map((d) => tx.get(invRef(req.roomId, d))))
    const full = inv.findIndex((snap) => (snap.exists ? snap.get('booked') : 0) >= room.units)
    if (full !== -1) {
      throw new HttpsError('failed-precondition', `Sorry, ${room.name} is fully booked on ${nights[full]}. Please try other dates.`)
    }

    // then writes
    nights.forEach((date, i) => {
      if (inv[i].exists) tx.update(invRef(req.roomId, date), { booked: FieldValue.increment(1) })
      else tx.set(invRef(req.roomId, date), { roomId: req.roomId, date, booked: 1 })
    })

    tx.create(db.collection('bookings').doc(ref), {
      ref,
      uid: auth.uid,
      accountEmail: auth.token.email ?? null,
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
    return ref
  })

  logger.info('booking created', { ref, uid: auth.uid, roomId: req.roomId })
  return { ref }
})

/* ---------- cancelBooking (owner before check-in, or admin) ---------- */

export const cancelBooking = onCall(callOpts, async (request) => {
  const auth = requireVerifiedUser(request)
  const ref = parseRef(request.data?.ref)
  const admin = isAdmin(auth)

  await db.runTransaction(async (tx) => {
    const bookingRef = db.collection('bookings').doc(ref)
    const snap = await tx.get(bookingRef)
    // Same error for "missing" and "not yours", so refs can't be probed.
    if (!snap.exists || (!admin && snap.get('uid') !== auth.uid)) {
      throw new HttpsError('not-found', 'Booking not found.')
    }
    const b = snap.data()
    if (b.status !== 'Confirmed') throw new HttpsError('failed-precondition', 'This booking is already cancelled.')
    if (!admin && b.checkIn <= hotelToday()) {
      throw new HttpsError('failed-precondition', 'This stay has already started. Please contact the hotel to make changes.')
    }

    const nights = nightsOf(b.checkIn, b.nights)
    const inv = await Promise.all(nights.map((d) => tx.get(invRef(b.roomId, d))))

    nights.forEach((date, i) => {
      if (inv[i].exists && inv[i].get('booked') > 0) tx.update(invRef(b.roomId, date), { booked: FieldValue.increment(-1) })
    })
    tx.update(bookingRef, {
      status: 'Cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: admin && b.uid !== auth.uid ? 'hotel' : 'guest',
    })
  })

  logger.info('booking cancelled', { ref, by: auth.uid, admin })
  return { ok: true }
})

/* ---------- syncAdminClaim ----------
 * Staff accounts are listed in ADMIN_EMAILS (backend/functions/.env).
 * After signing in, the site calls this once; it sets or removes the
 * `admin` custom claim to match that list. Nobody can make themselves admin
 * from the browser.
 */
export const syncAdminClaim = onCall(callOpts, async (request) => {
  const auth = requireVerifiedUser(request)
  const admins = list(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase())
  const shouldBeAdmin = admins.includes((auth.token.email || '').toLowerCase())

  if (shouldBeAdmin !== isAdmin(auth)) {
    const user = await getAuth().getUser(auth.uid)
    await getAuth().setCustomUserClaims(auth.uid, { ...(user.customClaims || {}), admin: shouldBeAdmin })
    logger.info('admin claim changed', { uid: auth.uid, admin: shouldBeAdmin })
    return { admin: shouldBeAdmin, changed: true }
  }
  return { admin: shouldBeAdmin, changed: false }
})
