/*
 * Room numbers on the website side (the server re-checks everything).
 * Same clash rule as backend/server/src/unitRules.js.
 */
const LIVE = ['Confirmed', 'CheckedIn']
const end = (b) => (b.checkOutActual && b.checkOutActual < b.checkOut ? b.checkOutActual : b.checkOut)
const overlaps = (a, b) => a.checkIn < end(b) && b.checkIn < end(a)

/** Live booking (other than `booking`) holding `number` on overlapping nights. */
export const clashFor = (booking, number, bookings) =>
  bookings.find((o) => o.ref !== booking.ref && o.unit === number && LIVE.includes(o.status) && overlaps(booking, o)) || null

/** Room numbers a booking can take: its room type, in service, no clash. Clean ones first. */
export function unitOptions(booking, units, bookings) {
  const rank = { clean: 0, cleaning: 1, dirty: 2 }
  return units
    .filter((u) => u.roomId === booking.roomId)
    .map((u) => ({ ...u, clash: clashFor(booking, u.number, bookings) }))
    .filter((u) => !u.outOfOrder && !u.clash)
    .sort((a, b) => (rank[a.housekeeping] ?? 3) - (rank[b.housekeeping] ?? 3) || a.number.localeCompare(b.number, undefined, { numeric: true }))
}

export const typeHasUnits = (roomId, units) => units.some((u) => u.roomId === roomId)

export const HK_LABEL = { clean: 'Clean', dirty: 'Dirty', cleaning: 'Cleaning' }

/** What's happening in a room today: who is in it, who arrives, who leaves. */
export function unitToday(unit, bookings, t) {
  const mine = bookings.filter((b) => b.unit === unit.number && LIVE.includes(b.status))
  const guest = mine.find((b) => b.status === 'CheckedIn') || null
  const arriving = mine.find((b) => b.status === 'Confirmed' && b.checkIn <= t && t < b.checkOut) || null
  const next = mine.filter((b) => b.status === 'Confirmed' && b.checkIn > t).sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0] || null
  return { guest, arriving, next, leavingToday: guest && guest.checkOut <= t }
}
