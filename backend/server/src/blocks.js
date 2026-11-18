/*
 * Room blocks: take N rooms of a type out of sale for a date range
 * (renovation, maintenance, private event).
 *
 * A block simply occupies inventory nights, exactly like a booking does, so
 * availability, online booking, staff booking and the calendar all respect it
 * with no special cases. Removing the block hands the nights back.
 */
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firebase.js'
import { ApiError } from './errors.js'
import { nightsOf, hotelToday } from './validate.js'
import { parseBlockInput } from './blockRules.js'

const invRef = (roomId, date) => db.collection('inventory').doc(`${roomId}_${date}`)
const bad = (msg) => {
  throw new ApiError('invalid-argument', msg)
}

export async function createBlock(staff, body) {
  const req = parseBlockInput(body, hotelToday())
  const nights = nightsOf(req.from, req.nights)

  return db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(db.collection('rooms').doc(req.roomId))
    if (!roomSnap.exists) throw new ApiError('not-found', 'Room not found.')
    const room = roomSnap.data()
    if (req.units > (room.units || 0)) throw new ApiError('invalid-argument', `${room.name} only has ${room.units} room${room.units === 1 ? '' : 's'}.`)

    const inv = await Promise.all(nights.map((d) => tx.get(invRef(req.roomId, d))))
    const clash = inv.findIndex((s) => (s.exists ? s.get('booked') || 0 : 0) + req.units > room.units)
    if (clash !== -1) {
      const taken = inv[clash].get('booked') || 0
      throw new ApiError('failed-precondition',
        `Can't block ${req.units} on ${nights[clash]}: ${taken} of ${room.units} ${room.name} already taken. Move or cancel those bookings first, or block fewer rooms.`)
    }

    nights.forEach((date, i) => {
      if (inv[i].exists) tx.update(invRef(req.roomId, date), { booked: FieldValue.increment(req.units) })
      else tx.set(invRef(req.roomId, date), { roomId: req.roomId, date, booked: req.units })
    })
    const ref = db.collection('blocks').doc()
    tx.create(ref, {
      roomId: req.roomId, roomName: room.name, from: req.from, to: req.to, nights: req.nights,
      units: req.units, reason: req.reason, createdBy: staff.email ?? 'staff', createdAt: FieldValue.serverTimestamp(),
    })
    return { id: ref.id }
  })
}

export async function deleteBlock(idParam) {
  if (typeof idParam !== 'string' || !/^[A-Za-z0-9]{1,40}$/.test(idParam)) bad('Unknown block.')
  const ref = db.collection('blocks').doc(idParam)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new ApiError('not-found', 'Block not found.')
    const b = snap.data()
    const nights = nightsOf(b.from, b.nights)
    const inv = await Promise.all(nights.map((d) => tx.get(invRef(b.roomId, d))))
    nights.forEach((date, i) => {
      if (inv[i].exists) tx.update(invRef(b.roomId, date), { booked: Math.max(0, (inv[i].get('booked') || 0) - b.units) })
    })
    tx.delete(ref)
    return { ok: true }
  })
}
