/*
 * Front-desk status rules (pure, no database), used by bookingStatus.js:
 *   Confirmed → CheckedIn → CheckedOut
 *   Confirmed → NoShow
 *   CheckedIn → Confirmed   (undo a mistaken check-in)
 * Early check-out and no-shows hand the remaining nights back to inventory.
 */
import { ApiError } from './errors.js'
import { nightsOf, daysBetween } from './validate.js'

export const ACTIONS = ['check-in', 'check-out', 'no-show', 'undo-check-in']

const fail = (msg) => {
  throw new ApiError('failed-precondition', msg)
}

/**
 * Pure rules: what a given action does to a booking on a given day.
 * Returns { status, fields, freeFrom } where freeFrom (ISO date or null) is
 * the first night to give back to inventory.
 */
export function planStatusChange(b, action, today) {
  if (!ACTIONS.includes(action)) throw new ApiError('invalid-argument', 'Unknown action.')
  switch (action) {
    case 'check-in':
      if (b.status !== 'Confirmed') fail(`Only confirmed bookings can be checked in (this one is ${b.status}).`)
      if (today < b.checkIn) fail(`Too early: this stay starts on ${b.checkIn}.`)
      if (today >= b.checkOut) fail('This stay has already ended. Mark it as a no-show instead.')
      return { status: 'CheckedIn', fields: { checkedInAt: true }, freeFrom: null }

    case 'undo-check-in':
      if (b.status !== 'CheckedIn') fail('This guest is not checked in.')
      return { status: 'Confirmed', fields: { checkedInAt: null }, freeFrom: null }

    case 'check-out': {
      if (b.status !== 'CheckedIn') fail('Only checked-in guests can be checked out.')
      // Leaving early frees tonight and every night after it
      const actual = today < b.checkOut ? today : b.checkOut
      return { status: 'CheckedOut', fields: { checkedOutAt: true, checkOutActual: actual }, freeFrom: today < b.checkOut ? today : null }
    }

    case 'no-show':
      if (b.status !== 'Confirmed') fail('Only confirmed bookings can be marked as a no-show.')
      if (today < b.checkIn) fail(`The guest isn't due until ${b.checkIn}.`)
      return { status: 'NoShow', fields: { noShowAt: true }, freeFrom: today < b.checkOut ? (today > b.checkIn ? today : b.checkIn) : null }
  }
}

/** Nights from `from` up to (not including) checkOut. */
export const nightsFrom = (b, from) => {
  const n = daysBetween(from, b.checkOut)
  return n > 0 ? nightsOf(from, n) : []
}
