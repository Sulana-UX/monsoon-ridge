/*
 * Change a booking's dates, room type or number of guests (guests from My Bookings, staff from the dashboard).
 * One transaction: re-checks availability night by night, moves the inventory (only the nights that
 * really change), re-prices, keeps or drops the room number, and records the change on the booking.
 * Nights the guest already had keep their price; only new nights use today's rates.
 * The promo code of the booking still applies (it was valid when they booked).
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { db } from './firebase.js'
import { ApiError } from './errors.js'
import { parseRef, hotelToday, nightsOf } from './validate.js'
import { quoteStay } from './pricing.js'
import { rulesRef, rulesFrom } from './pricingStore.js'
import { planChange, inventoryDelta, keptNights, describeStay } from './changeRules.js'
import { unitClash } from './unitRules.js'
import { logActivity, lkr } from './activity.js'
import { later } from './notify.js'
import { sendMail, staffRecipients } from './mailer.js'
import { bookingChanged, staffBookingChanged } from './emailTemplates.js'

const bookingDoc = (ref) => db.collection('bookings').doc(ref)
const invDoc = (key) => db.collection('inventory').doc(key)

/**
 * actor = { uid, email } (guest) or the staff user; staff = true for dashboard requests.
 * dryRun = only work out the new price and check availability (nothing is saved).
 */
async function run(actor, refParam, body, { staff, dryRun }) {
  const ref = parseRef(refParam)
  const today = hotelToday()
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingDoc(ref))
    // Same error for "missing" and "not yours", so refs can't be probed
    if (!snap.exists || (!staff && snap.get('uid') !== actor.uid)) throw new ApiError('not-found', 'Booking not found.')
    const b = snap.data()
    const next = planChange(b, body, { today, staff })

    const roomSnap = await tx.get(db.collection('rooms').doc(next.roomId))
    const room = roomSnap.exists ? roomSnap.data() : null
    if (!room || (room.active === false && next.roomId !== b.roomId)) throw new ApiError('invalid-argument', 'This room is not available for booking.')
    if (next.guests > room.guests) throw new ApiError('invalid-argument', `${room.name} sleeps up to ${room.guests} guests.`)
    const rules = rulesFrom(await tx.get(rulesRef()))

    // Inventory: only nights that are added (+1) or given back (-1)
    const delta = [...inventoryDelta(b, next)]
    const inv = await Promise.all(delta.map(([k]) => tx.get(invDoc(k))))
    delta.forEach(([k, d], i) => {
      if (d > 0 && (inv[i].exists ? inv[i].get('booked') || 0 : 0) + d > room.units) {
        throw new ApiError('failed-precondition', `Sorry, ${room.name} is fully booked on ${k.slice(-10)}. Please try other dates.`)
      }
    })

    // Room number: keep it if it's still free for the new nights, otherwise the desk picks another
    let unit = b.unit || null
    let unitNote = null
    if (unit) {
      if (next.roomId !== b.roomId) {
        unit = null
        unitNote = `Room ${b.unit} was released (different room type).`
      } else {
        const others = (await tx.get(db.collection('bookings').where('unit', '==', b.unit))).docs.map((d) => d.data())
        const clash = unitClash({ ...b, ...next, checkOutActual: null }, others)
        if (clash) {
          if (b.status === 'CheckedIn') {
            throw new ApiError('failed-precondition', `Room ${b.unit} is booked for ${clash.guest?.firstName ?? 'another guest'} from ${clash.checkIn} (${clash.ref}). Give that booking another room number first.`)
          }
          unit = null
          unitNote = `Room ${b.unit} was released (it's taken on the new dates).`
        }
      }
    }

    const price = quoteStay(room.price, nightsOf(next.checkIn, next.nights), rules, b.price?.promo || null, keptNights(b, next.roomId))
    const result = {
      ref, before: { roomId: b.roomId, roomName: b.roomName, checkIn: b.checkIn, checkOut: b.checkOut, guests: b.guests, total: b.total },
      after: { ...next, roomName: room.name, total: price.total }, price, difference: price.total - (b.total || 0), unitNote,
    }
    if (dryRun) return result

    delta.forEach(([k, d], i) => {
      if (d > 0) {
        if (inv[i].exists) tx.update(inv[i].ref, { booked: FieldValue.increment(d) })
        else tx.set(inv[i].ref, { roomId: k.slice(0, -11), date: k.slice(-10), booked: d })
      } else if (inv[i].exists && (inv[i].get('booked') || 0) > 0) {
        tx.update(inv[i].ref, { booked: FieldValue.increment(Math.max(d, -(inv[i].get('booked') || 0))) })
      }
    })
    tx.update(snap.ref, {
      roomId: next.roomId, roomName: room.name, image: next.roomId === b.roomId ? b.image ?? null : room.image ?? null,
      checkIn: next.checkIn, checkOut: next.checkOut, nights: next.nights, guests: next.guests,
      price, total: price.total,
      unit: unit ?? FieldValue.delete(),
      changes: FieldValue.arrayUnion({
        at: Timestamp.now(), by: actor.email ?? (staff ? 'staff' : 'guest'), role: staff ? 'staff' : 'guest',
        from: result.before, to: result.after,
      }),
    })
    result.booking = { ...b, ...next, roomName: room.name, price, total: price.total, unit }
    return result
  })
}

/** New price and availability, without saving. */
export async function previewChange(actor, ref, body, { staff = false } = {}) {
  const r = await run(actor, ref, body, { staff, dryRun: true })
  return { before: r.before, after: r.after, price: r.price, difference: r.difference, unitNote: r.unitNote }
}

export async function changeBooking(actor, ref, body, { staff = false } = {}) {
  const r = await run(actor, ref, body, { staff, dryRun: false })
  const b = r.booking
  const diff = r.difference === 0 ? 'same price' : `${r.difference > 0 ? '+' : '−'}${lkr(Math.abs(r.difference))}`
  await logActivity({ ...actor, admin: staff }, { action: 'booking.changed', target: { type: 'booking', id: r.ref, label: r.ref },
    summary: `Changed ${staff ? 'by the hotel' : 'by the guest'}: ${describeStay(r.before, r.before.roomName)} → ${describeStay(r.after, r.after.roomName)} (${lkr(r.after.total)}, ${diff})`,
    details: r.unitNote || undefined })

  // Emails after saving: the guest always (if we have an address); staff when the guest did it
  if (b.guest?.email) {
    later(sendMail({ to: [{ email: b.guest.email, name: `${b.guest.firstName ?? ''} ${b.guest.lastName ?? ''}`.trim() }], ...bookingChanged(b, r.before, r.difference) })
      .then((m) => bookingDoc(r.ref).update({ 'emails.change': { status: m.status, at: Timestamp.now(), ...(m.error && { error: m.error.slice(0, 200) }) } })))
  }
  if (!staff) later(sendMail({ to: staffRecipients(), ...staffBookingChanged(b, r.before, r.difference) }))
  return { ok: true, ref: r.ref, total: r.after.total, difference: r.difference, unitNote: r.unitNote }
}
