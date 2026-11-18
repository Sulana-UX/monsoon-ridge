/* Booking statuses: labels, colours and the occupancy rules used across the app. */

export const STATUS = {
  Confirmed: { label: 'Confirmed', tone: 'ok' },
  CheckedIn: { label: 'Checked in', tone: 'in' },
  CheckedOut: { label: 'Checked out', tone: 'out' },
  NoShow: { label: 'No-show', tone: 'bad' },
  Cancelled: { label: 'Cancelled', tone: 'bad' },
}

export const statusLabel = (s) => STATUS[s]?.label ?? s
export const statusClass = (s) => `status status--${STATUS[s]?.tone ?? 'ok'}`

/** Bookings that bring in revenue (everything except cancelled / no-show). */
export const isLive = (b) => b.status === 'Confirmed' || b.status === 'CheckedIn' || b.status === 'CheckedOut'

/** Is a room taken by this booking on night `d` (YYYY-MM-DD)? Early check-outs free the rest. */
export function occupies(b, d) {
  if (d < b.checkIn) return false
  if (b.status === 'Confirmed' || b.status === 'CheckedIn') return d < b.checkOut
  if (b.status === 'CheckedOut') return d < (b.checkOutActual || b.checkOut)
  return false
}

export const guestName = (b) => `${b.guest?.firstName ?? ''} ${b.guest?.lastName ?? ''}`.trim() || 'Guest'
