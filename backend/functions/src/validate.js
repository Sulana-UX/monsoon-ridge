import { HttpsError } from 'firebase-functions/v2/https'

const HOTEL_TZ = 'Asia/Colombo'
const DAY = 86400000
export const MAX_NIGHTS = 30
export const MAX_DAYS_AHEAD = 365
export const COUNTRIES = ['Sri Lanka', 'India', 'United Kingdom', 'United States', 'Australia', 'Germany', 'Other']
export const PAYMENTS = ['hotel', 'card']

const bad = (msg) => {
  throw new HttpsError('invalid-argument', msg)
}

/** Today's date (YYYY-MM-DD) at the hotel, not on the server's clock. */
export const hotelToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: HOTEL_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const toUTC = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

export const isValidISODate = (iso) => {
  if (typeof iso !== 'string' || !ISO_DATE.test(iso)) return false
  const d = new Date(toUTC(iso))
  return d.toISOString().slice(0, 10) === iso // rejects 2026-02-31 etc.
}

export const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / DAY)

/** Every night of the stay: checkIn .. checkOut-1 */
export const nightsOf = (checkIn, nights) =>
  Array.from({ length: nights }, (_, i) => new Date(toUTC(checkIn) + i * DAY).toISOString().slice(0, 10))

const str = (v, field, { min = 0, max, pattern } = {}) => {
  if (typeof v !== 'string') bad(`${field} is invalid.`)
  const s = v.trim()
  if (s.length < min) bad(`${field} is required.`)
  if (s.length > max) bad(`${field} is too long.`)
  if (pattern && s && !pattern.test(s)) bad(`${field} is invalid.`)
  return s
}

/** Validates and normalises the createBooking payload. Unknown fields are dropped. */
export function parseBookingRequest(data) {
  if (!data || typeof data !== 'object') bad('Missing booking details.')
  const { roomId, checkIn, checkOut, guests, payment, guest } = data

  if (typeof roomId !== 'string' || !/^[a-z0-9-]{1,40}$/.test(roomId)) bad('Unknown room.')
  if (!isValidISODate(checkIn) || !isValidISODate(checkOut)) bad('Please choose valid dates.')

  const today = hotelToday()
  if (checkIn < today) bad('Check-in cannot be in the past.')
  if (daysBetween(today, checkIn) > MAX_DAYS_AHEAD) bad(`Bookings open up to ${MAX_DAYS_AHEAD} days ahead.`)
  const nights = daysBetween(checkIn, checkOut)
  if (nights < 1) bad('Check-out must be after check-in.')
  if (nights > MAX_NIGHTS) bad(`Stays are limited to ${MAX_NIGHTS} nights online. Please contact us for longer stays.`)

  if (!Number.isInteger(guests) || guests < 1 || guests > 10) bad('Number of guests is invalid.')
  if (!PAYMENTS.includes(payment)) bad('Payment method is invalid.')
  if (!guest || typeof guest !== 'object') bad('Guest details are missing.')

  const g = {
    firstName: str(guest.firstName, 'First name', { min: 1, max: 60 }),
    lastName: str(guest.lastName, 'Last name', { min: 1, max: 60 }),
    email: str(guest.email, 'Email', { min: 3, max: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }).toLowerCase(),
    phone: str(guest.phone, 'Phone', { min: 9, max: 25, pattern: /^\+?[\d\s()-]{9,25}$/ }),
    country: str(guest.country, 'Country', { min: 1, max: 40 }),
    arrival: str(guest.arrival ?? '', 'Arrival time', { max: 5, pattern: /^([01]\d|2[0-3]):[0-5]\d$/ }),
    requests: str(guest.requests ?? '', 'Special requests', { max: 500 }),
  }
  if (!COUNTRIES.includes(g.country)) bad('Country is invalid.')
  if (g.phone.replace(/\D/g, '').length < 9) bad('Phone is invalid.')

  return { roomId, checkIn, checkOut, nights, guests, payment, guest: g }
}

export const parseRef = (ref) => {
  if (typeof ref !== 'string' || !/^MRR-[A-Z0-9]{8}$/.test(ref)) bad('Booking reference is invalid.')
  return ref
}
