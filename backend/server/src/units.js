/*
 * Room numbers & housekeeping (database side). Rules: unitRules.js
 *   setRoomNumbers   Admin: which numbers a room type has (101–106)
 *   assignUnit       Staff: give a booking a room number (before or at check-in), or take it away
 *   setHousekeeping  Staff: clean / dirty / cleaning, out of order, note
 * Check-in uses the same clash check (bookingStatus.js), check-out marks the room dirty.
 */
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firebase.js'
import { ApiError } from './errors.js'
import { parseRef, hotelToday } from './validate.js'
import { parseRoomId } from './rooms.js'
import { parseUnitList, parseUnitNumber, unitClash, parseHousekeeping } from './unitRules.js'
import { logActivity } from './activity.js'

export const unitRef = (n) => db.collection('roomUnits').doc(n)
const bookingsWithUnit = (n) => db.collection('bookings').where('unit', '==', n)

/**
 * Inside a transaction: check `unit` can go to booking `b` (right room type, not out of order,
 * not held by another live booking on overlapping nights). Returns the unit's data.
 */
export async function checkUnitFor(tx, b, unit) {
  const snap = await tx.get(unitRef(unit))
  if (!snap.exists) throw new ApiError('not-found', `Room ${unit} doesn't exist.`)
  const u = snap.data()
  if (u.roomId !== b.roomId) throw new ApiError('failed-precondition', `Room ${unit} is a ${u.roomName}, but this booking is for ${b.roomName}.`)
  if (u.outOfOrder) throw new ApiError('failed-precondition', `Room ${unit} is out of order${u.note ? ` (${u.note})` : ''}.`)
  const others = (await tx.get(bookingsWithUnit(unit))).docs.map((d) => d.data())
  const clash = unitClash(b, others)
  if (clash) {
    throw new ApiError('failed-precondition', `Room ${unit} is taken by ${clash.guest?.firstName ?? ''} ${clash.guest?.lastName ?? ''} (${clash.ref}, ${clash.checkIn} → ${clash.checkOut}). Choose another room.`)
  }
  return u
}

/** Does this room type use room numbers yet? (inside a transaction) */
export async function typeHasUnits(tx, roomId) {
  return !(await tx.get(db.collection('roomUnits').where('roomId', '==', roomId).limit(1))).empty
}

export async function setRoomNumbers(staff, roomIdParam, body) {
  const roomId = parseRoomId(roomIdParam)
  const wanted = parseUnitList(body?.numbers)
  const today = hotelToday()

  const result = await db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(db.collection('rooms').doc(roomId))
    if (!roomSnap.exists) throw new ApiError('not-found', 'Room not found.')
    const room = roomSnap.data()
    if (wanted.length > room.units) {
      throw new ApiError('invalid-argument', `${room.name} has ${room.units} room${room.units === 1 ? '' : 's'}, but you entered ${wanted.length} numbers. Change the number of rooms first (Rooms page).`)
    }
    const current = (await tx.get(db.collection('roomUnits').where('roomId', '==', roomId))).docs.map((d) => d.data())
    const currentSet = new Set(current.map((u) => u.number))
    const added = wanted.filter((n) => !currentSet.has(n))
    const removed = current.filter((u) => !wanted.includes(u.number)).map((u) => u.number)

    // New numbers must not belong to another room type
    const addedSnaps = await Promise.all(added.map((n) => tx.get(unitRef(n))))
    addedSnaps.forEach((s, i) => {
      if (s.exists) throw new ApiError('failed-precondition', `Room ${added[i]} already belongs to ${s.get('roomName')}.`)
    })
    // Removed numbers must not be holding a current or future stay
    for (const n of removed) {
      const held = (await tx.get(bookingsWithUnit(n))).docs.map((d) => d.data())
        .find((b) => ['Confirmed', 'CheckedIn'].includes(b.status) && b.checkOut > today)
      if (held) throw new ApiError('failed-precondition', `Room ${n} is assigned to ${held.ref} (${held.checkIn} → ${held.checkOut}). Move that booking to another room first.`)
    }

    added.forEach((n) => tx.create(unitRef(n), {
      number: n, roomId, roomName: room.name, housekeeping: 'clean', outOfOrder: false, note: '',
      updatedBy: staff.email ?? 'staff', updatedAt: FieldValue.serverTimestamp(),
    }))
    removed.forEach((n) => tx.delete(unitRef(n)))
    return { roomName: room.name, units: room.units, added, removed, numbers: wanted }
  })

  if (result.added.length || result.removed.length) {
    await logActivity(staff, {
      action: 'room.numbers_changed', target: { type: 'room', id: roomId, label: result.roomName },
      summary: `Room numbers for ${result.roomName}: ${result.numbers.join(', ') || 'none'}`,
      details: [result.added.length && `Added ${result.added.join(', ')}`, result.removed.length && `Removed ${result.removed.join(', ')}`].filter(Boolean).join(' · '),
    })
  }
  return { numbers: result.numbers, missing: result.units - result.numbers.length }
}

/** Give a booking a room number (unit = null to take it away). */
export async function assignUnit(staff, refParam, body) {
  const ref = parseRef(refParam)
  const unit = body?.unit == null || body.unit === '' ? null : parseUnitNumber(body.unit)
  const bookingRef = db.collection('bookings').doc(ref)
  let b
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef)
    if (!snap.exists) throw new ApiError('not-found', 'Booking not found.')
    b = snap.data()
    if (!['Confirmed', 'CheckedIn'].includes(b.status)) throw new ApiError('failed-precondition', `This booking is ${b.status}; room numbers are only for upcoming or current stays.`)
    if (unit) await checkUnitFor(tx, b, unit)
    tx.update(bookingRef, { unit: unit ?? FieldValue.delete(), unitBy: staff.email ?? 'staff', unitAt: FieldValue.serverTimestamp() })
  })
  if ((b.unit || null) !== unit) {
    await logActivity(staff, {
      action: 'booking.room_assigned', target: { type: 'booking', id: ref, label: ref },
      summary: unit ? `${b.unit ? `Moved from room ${b.unit} to` : 'Assigned'} room ${unit}: ${b.guest?.firstName ?? ''} ${b.guest?.lastName ?? ''}` : `Removed room ${b.unit} from the booking`,
    })
  }
  return { ref, unit }
}

export async function setHousekeeping(staff, numberParam, body) {
  const number = parseUnitNumber(numberParam)
  const changes = parseHousekeeping(body)
  const ref = unitRef(number)
  const before = await ref.get()
  if (!before.exists) throw new ApiError('not-found', `Room ${number} doesn't exist.`)
  await ref.update({ ...changes, updatedBy: staff.email ?? 'staff', updatedAt: FieldValue.serverTimestamp() })
  // Out of order is worth a log line; clean/dirty flips happen all day and would drown the log
  if (changes.outOfOrder !== undefined && changes.outOfOrder !== (before.get('outOfOrder') === true)) {
    await logActivity(staff, {
      action: changes.outOfOrder ? 'room.out_of_order' : 'room.back_in_order', target: { type: 'unit', id: number, label: `Room ${number}` },
      summary: changes.outOfOrder ? `Room ${number} (${before.get('roomName')}) marked out of order${changes.note ? `: ${changes.note}` : ''}` : `Room ${number} (${before.get('roomName')}) back in service`,
    })
  }
  return { ok: true }
}
