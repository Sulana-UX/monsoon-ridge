/*
 * Changing a booking (pure rules, tested in test/validate.test.js).
 *
 * Guests: their own Confirmed booking, before the check-in day (same window as cancelling),
 *         up to GUEST_CHANGES_MAX times; then they call the hotel.
 * Staff:  any Confirmed booking; for a guest already checked in, only the check-out date
 *         (extend or shorten the stay; moving rooms is done with the room number).
 */
import { ApiError } from './errors.js'
import { isValidISODate, daysBetween, nightsOf, MAX_NIGHTS, MAX_DAYS_AHEAD } from './validate.js'

export const GUEST_CHANGES_MAX = 3
const fail = (msg) => {
  throw new ApiError('failed-precondition', msg)
}
const bad = (msg) => {
  throw new ApiError('invalid-argument', msg)
}

/** Checks the request against the booking; returns the new stay { roomId, checkIn, checkOut, nights, guests }. */
export function planChange(b, data, { today, staff }) {
  if (!data || typeof data !== 'object') bad('Missing changes.')
  const roomId = data.roomId ?? b.roomId
  const checkIn = data.checkIn ?? b.checkIn
  const checkOut = data.checkOut ?? b.checkOut
  const guests = data.guests == null || data.guests === '' ? b.guests : Number(data.guests)

  if (typeof roomId !== 'string' || !/^[a-z0-9-]{1,40}$/.test(roomId)) bad('Unknown room.')
  if (!isValidISODate(checkIn) || !isValidISODate(checkOut)) bad('Please choose valid dates.')
  if (!Number.isInteger(guests) || guests < 1 || guests > 20) bad('Number of guests is invalid.')

  if (b.status === 'CheckedIn') {
    if (!staff) fail('Your stay has started. Please ask the front desk to make changes.')
    if (checkIn !== b.checkIn) fail("The guest is already checked in, so the arrival date can't change.")
    if (roomId !== b.roomId) fail('The guest is already checked in. To move them, change the room number instead.')
    if (checkOut <= today) fail('The new check-out date must be after today.')
  } else if (b.status === 'Confirmed') {
    if (!staff && b.checkIn <= today) fail('This stay has already started. Please contact the hotel to make changes.')
    if (!staff && (b.changes || []).filter((c) => c.role === 'guest').length >= GUEST_CHANGES_MAX) {
      fail(`This booking has been changed ${GUEST_CHANGES_MAX} times already. Please contact the hotel for more changes.`)
    }
    if (checkIn < today) bad('Check-in cannot be in the past.')
    if (daysBetween(today, checkIn) > MAX_DAYS_AHEAD) bad(`Bookings open up to ${MAX_DAYS_AHEAD} days ahead.`)
  } else {
    fail(b.status === 'Cancelled' ? 'This booking is cancelled.' : 'This booking can no longer be changed.')
  }

  const nights = daysBetween(checkIn, checkOut)
  if (nights < 1) bad('Check-out must be after check-in.')
  if (nights > MAX_NIGHTS) bad(`Stays are limited to ${MAX_NIGHTS} nights. Please contact us for longer stays.`)
  if (roomId === b.roomId && checkIn === b.checkIn && checkOut === b.checkOut && guests === b.guests) bad('Nothing has changed.')
  return { roomId, checkIn, checkOut, nights, guests }
}

/**
 * Inventory to move: Map("roomId_date" → +1 | -1). Nights in both the old and the new stay
 * cancel out, so a one-night extension touches only that night.
 */
export function inventoryDelta(oldStay, newStay) {
  const delta = new Map()
  const add = (s, n) => nightsOf(s.checkIn, daysBetween(s.checkIn, s.checkOut)).forEach((d) => {
    const k = `${s.roomId}_${d}`
    const v = (delta.get(k) || 0) + n
    if (v) delta.set(k, v)
    else delta.delete(k)
  })
  add(oldStay, -1)
  add(newStay, +1)
  return delta
}

/** Nights of the old stay that keep their price (same room only). */
export function keptNights(b, newRoomId) {
  if (newRoomId !== b.roomId) return null
  const nightly = b.price?.nightly
  if (Array.isArray(nightly) && nightly.length) return new Map(nightly.map((n) => [n.date, n]))
  const rate = b.price?.rate ?? (b.nights ? Math.round((b.price?.rooms ?? b.total) / b.nights) : null)
  if (!rate) return null
  return new Map(nightsOf(b.checkIn, b.nights).map((d) => [d, { date: d, rate }]))
}

/** "17 Nov → 21 Nov, Deluxe Garden Room, 2 guests" */
export const describeStay = (s, roomName) => `${s.checkIn} → ${s.checkOut}, ${roomName}, ${s.guests} guest${s.guests === 1 ? '' : 's'}`
