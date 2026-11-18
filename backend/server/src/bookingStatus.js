// Front-desk status changes and staff notes (staff only). Rules: statusRules.js
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firebase.js'
import { ApiError } from './errors.js'
import { parseRef, hotelToday } from './validate.js'
import { planStatusChange, nightsFrom } from './statusRules.js'

export async function changeBookingStatus(staff, refParam, action) {
  const ref = parseRef(refParam)
  const bookingRef = db.collection('bookings').doc(ref)

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef)
    if (!snap.exists) throw new ApiError('not-found', 'Booking not found.')
    const b = snap.data()
    const plan = planStatusChange(b, action, hotelToday())

    const freed = plan.freeFrom ? nightsFrom(b, plan.freeFrom) : []
    const invRefs = freed.map((d) => db.collection('inventory').doc(`${b.roomId}_${d}`))
    const inv = await Promise.all(invRefs.map((r) => tx.get(r)))

    invRefs.forEach((r, i) => {
      if (inv[i].exists && inv[i].get('booked') > 0) tx.update(r, { booked: FieldValue.increment(-1) })
    })

    const update = { status: plan.status, statusBy: staff.email ?? 'staff', statusAt: FieldValue.serverTimestamp() }
    for (const [k, v] of Object.entries(plan.fields)) update[k] = v === true ? FieldValue.serverTimestamp() : v ?? FieldValue.delete()
    tx.update(bookingRef, update)
    return { ref, status: plan.status, freedNights: freed.length }
  })
}

/* ---------- staff-only notes: bookings/{ref}/notes (guests can't read them) ---------- */

export async function addNote(staff, refParam, body) {
  const ref = parseRef(refParam)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) throw new ApiError('invalid-argument', 'Write a note first.')
  if (text.length > 1000) throw new ApiError('invalid-argument', 'Notes can be at most 1000 characters.')
  const bookingRef = db.collection('bookings').doc(ref)
  if (!(await bookingRef.get()).exists) throw new ApiError('not-found', 'Booking not found.')
  const doc = await bookingRef.collection('notes').add({ text, by: staff.email ?? 'staff', at: FieldValue.serverTimestamp() })
  return { id: doc.id }
}

export async function deleteNote(refParam, noteId) {
  const ref = parseRef(refParam)
  if (typeof noteId !== 'string' || !/^[A-Za-z0-9]{1,40}$/.test(noteId)) throw new ApiError('invalid-argument', 'Unknown note.')
  await db.collection('bookings').doc(ref).collection('notes').doc(noteId).delete()
  return { ok: true }
}
