/*
 * Room numbers (pure rules, no database).
 *   roomUnits/{number}  { number, roomId, roomName, housekeeping, outOfOrder, note }
 * A room type (e.g. Deluxe Garden, 6 rooms) has up to `units` numbers (101–106).
 * A booking can be given one number; two live bookings can't hold the same number
 * on overlapping nights.
 */
import { ApiError } from './errors.js'

export const HOUSEKEEPING = ['clean', 'dirty', 'cleaning']
const LIVE = ['Confirmed', 'CheckedIn']

const bad = (msg) => {
  throw new ApiError('invalid-argument', msg)
}

export function parseUnitNumber(v) {
  const n = typeof v === 'string' ? v.trim().toUpperCase() : typeof v === 'number' ? String(v) : ''
  if (!/^[A-Z0-9-]{1,10}$/.test(n)) bad(`"${String(v ?? '').slice(0, 12)}" isn't a valid room number (letters, numbers and - only, up to 10).`)
  return n
}

/** "101, 102 103\n104" or ["101", …] → ["101", "102", "103", "104"] (unique, in the order given) */
export function parseUnitList(input) {
  const raw = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/[\s,;]+/) : null
  if (!raw) bad('Enter the room numbers.')
  const list = raw.filter((x) => String(x).trim() !== '').map(parseUnitNumber)
  const dup = list.find((n, i) => list.indexOf(n) !== i)
  if (dup) bad(`Room ${dup} is listed twice.`)
  if (list.length > 200) bad('At most 200 room numbers per room type.')
  return list
}

const overlaps = (a, b) => a.checkIn < b.checkOut && b.checkIn < a.checkOut
/** End of the stay for clash checks: an early check-out frees the room from that day. */
const effective = (b) => ({ checkIn: b.checkIn, checkOut: b.checkOutActual && b.checkOutActual < b.checkOut ? b.checkOutActual : b.checkOut })

/** The other live booking holding this room number on overlapping nights, or null. */
export function unitClash(booking, others) {
  const me = effective(booking)
  return others.find((o) => o.ref !== booking.ref && LIVE.includes(o.status) && overlaps(me, effective(o))) || null
}

export function parseHousekeeping(body) {
  if (!body || typeof body !== 'object') bad('Nothing to change.')
  const out = {}
  if (body.housekeeping !== undefined) {
    if (!HOUSEKEEPING.includes(body.housekeeping)) bad('Unknown housekeeping status.')
    out.housekeeping = body.housekeeping
  }
  if (body.outOfOrder !== undefined) {
    if (typeof body.outOfOrder !== 'boolean') bad('Out of order must be true or false.')
    out.outOfOrder = body.outOfOrder
  }
  if (body.note !== undefined) {
    if (typeof body.note !== 'string' || body.note.length > 200) bad('Note is too long (max 200 characters).')
    out.note = body.note.trim()
  }
  if (!Object.keys(out).length) bad('Nothing to change.')
  return out
}
