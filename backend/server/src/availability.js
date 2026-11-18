/*
 * Public availability: how many rooms of each type are free for the whole stay.
 * Reads the same per-night inventory the booking transaction uses, so what guests
 * see matches what the server will accept. Booking still re-checks inside the
 * transaction (availability can change between viewing and booking).
 */
import { db } from './firebase.js'
import { ApiError } from './errors.js'
import { isValidISODate, daysBetween, nightsOf, hotelToday, MAX_NIGHTS, MAX_DAYS_AHEAD } from './validate.js'

export async function getAvailability(query) {
  const { checkIn, checkOut } = query
  if (!isValidISODate(checkIn) || !isValidISODate(checkOut)) throw new ApiError('invalid-argument', 'Please choose valid dates.')
  const today = hotelToday()
  const n = daysBetween(checkIn, checkOut)
  if (checkIn < today || n < 1 || n > MAX_NIGHTS || daysBetween(today, checkIn) > MAX_DAYS_AHEAD) {
    throw new ApiError('invalid-argument', 'Please choose valid dates.')
  }

  const rooms = (await db.collection('rooms').where('active', '==', true).get()).docs
  const nights = nightsOf(checkIn, n)
  const refs = rooms.flatMap((r) => nights.map((d) => db.collection('inventory').doc(`${r.id}_${d}`)))
  const snaps = refs.length ? await db.getAll(...refs) : []
  const booked = new Map(snaps.map((s) => [s.id, s.exists ? s.get('booked') || 0 : 0]))

  const result = {}
  for (const r of rooms) {
    const units = r.get('units') || 0
    // the stay needs one room free on EVERY night, so the busiest night decides
    const busiest = Math.max(0, ...nights.map((d) => booked.get(`${r.id}_${d}`) || 0))
    result[r.id] = Math.max(0, units - busiest)
  }
  return { checkIn, checkOut, available: result }
}
