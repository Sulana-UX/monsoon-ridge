// Front-desk status changes and staff notes (staff only). Rules: statusRules.js
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firebase.js'
import { ApiError } from './errors.js'
import { parseRef, hotelToday } from './validate.js'
import { planStatusChange, nightsFrom } from './statusRules.js'
import { logActivity } from './activity.js'

const ACTION_TEXT = { 'check-in': 'Checked in', 'check-out': 'Checked out', 'no-show': 'Marked no-show', 'undo-check-in': 'Undid check-in' }

export async function changeBookingStatus(staff, refParam, action) {
  const ref = parseRef(refParam)
  const bookingRef = db.collection('bookings').doc(ref)

  let b
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef)
    if (!snap.exists) throw new ApiError('not-found', 'Booking not found.')
    b = snap.data()
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
  await logActivity(staff, { action: `booking.${action}`, target: { type: 'booking', id: ref, label: ref },
    summary: `${ACTION_TEXT[action] || action}: ${b.guest?.firstName ?? ''} ${b.guest?.lastName ?? ''}, ${b.roomName}${result.freedNights ? ` (${result.freedNights} night${result.freedNights === 1 ? '' : 's'} released)` : ''}` })
  return result
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
  await logActivity(staff, { action: 'booking.note_added', target: { type: 'booking', id: ref, label: ref }, summary: 'Added a staff note', details: text })
  return { id: doc.id }
}

export async function deleteNote(staff, refParam, noteId) {
  const ref = parseRef(refParam)
  if (typeof noteId !== 'string' || !/^[A-Za-z0-9]{1,40}$/.test(noteId)) throw new ApiError('invalid-argument', 'Unknown note.')
  const noteRef = db.collection('bookings').doc(ref).collection('notes').doc(noteId)
  const note = await noteRef.get()
  await noteRef.delete()
  if (note.exists) await logActivity(staff, { action: 'booking.note_deleted', target: { type: 'booking', id: ref, label: ref }, summary: 'Deleted a staff note', details: `${note.get('text')} (written by ${note.get('by')})` })
  return { ok: true }
}
