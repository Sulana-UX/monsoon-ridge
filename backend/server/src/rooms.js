/*
 * Rooms live in Firestore (`rooms/{id}`) and are managed from the admin dashboard.
 * The server reads price / capacity / units from there for every booking,
 * so a guest can never change what they pay.
 */
import { FieldValue } from 'firebase-admin/firestore'
import { ApiError } from './errors.js'

export const CATEGORIES = ['Single', 'Double', 'Family']
// Keep in sync with frontend/src/components/Amenity.jsx
export const AMENITY_IDS = ['wifi', 'ac', 'tv', 'breakfast', 'minibar', 'bathtub', 'shower', 'pool', 'kitchen', 'parking', 'spa', 'balcony', 'coffee']

export const SERVICE_RATE = 0.1
export const TAX_RATE = 0.08

export const priceFor = (rate, nights) => {
  const subtotal = rate * nights
  const service = Math.round(subtotal * SERVICE_RATE)
  const tax = Math.round(subtotal * TAX_RATE)
  return { rate, nights, subtotal, service, tax, total: subtotal + service + tax }
}

/* ---------- validation ---------- */

const bad = (msg) => {
  throw new ApiError('invalid-argument', msg)
}

const text = (v, field, { min = 0, max }) => {
  if (v == null) v = ''
  if (typeof v !== 'string') bad(`${field} is invalid.`)
  const s = v.trim()
  if (s.length < min) bad(min === 1 ? `${field} is required.` : `${field} must be at least ${min} characters.`)
  if (s.length > max) bad(`${field} must be at most ${max} characters.`)
  return s
}

const int = (v, field, min, max) => {
  if (typeof v === 'string' && v.trim() !== '') v = Number(v)
  if (!Number.isInteger(v) || v < min || v > max) bad(`${field} must be a whole number from ${min} to ${max}.`)
  return v
}

const imageUrl = (v, field) => {
  const s = text(v, field, { min: 1, max: 600 })
  let u
  try {
    u = new URL(s)
  } catch {
    bad(`${field} must be a full image link (https://…).`)
  }
  if (u.protocol !== 'https:') bad(`${field} must start with https://`)
  return u.toString()
}

/** Validates a room from the admin form. Unknown fields are dropped. */
export function parseRoomInput(data) {
  if (!data || typeof data !== 'object') bad('Room details are missing.')

  const type = data.type
  if (!CATEGORIES.includes(type)) bad(`Category must be one of: ${CATEGORIES.join(', ')}.`)

  if (!Array.isArray(data.amenities)) bad('Amenities are invalid.')
  const amenities = [...new Set(data.amenities)]
  if (amenities.some((a) => !AMENITY_IDS.includes(a))) bad('Unknown amenity.')

  if (!Array.isArray(data.gallery) || data.gallery.length < 1) bad('Add at least one photo.')
  if (data.gallery.length > 8) bad('A room can have at most 8 photos.')
  const gallery = data.gallery.map((g, i) => imageUrl(g, `Photo ${i + 1}`))

  return {
    name: text(data.name, 'Room name', { min: 3, max: 60 }),
    type,
    price: int(data.price, 'Price per night', 1000, 2_000_000),
    guests: int(data.guests, 'Max guests', 1, 12),
    units: int(data.units, 'Number of rooms', 0, 200),
    size: int(data.size, 'Size (m²)', 5, 2000),
    beds: text(data.beds, 'Beds', { min: 1, max: 60 }),
    view: text(data.view, 'View', { max: 60 }),
    short: text(data.short, 'Short description', { min: 10, max: 140 }),
    description: text(data.description, 'Full description', { min: 20, max: 2000 }),
    amenities,
    gallery,
    image: gallery[0],
    featured: data.featured === true,
    active: data.active !== false,
  }
}

export const slugify = (name) =>
  name.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40) || 'room'

export const parseRoomId = (id) => {
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,48}$/.test(id)) bad('Unknown room.')
  return id
}

/* ---------- admin operations ---------- */

export async function createRoom(db, body) {
  const room = parseRoomInput(body)
  const base = slugify(room.name)
  return db.runTransaction(async (tx) => {
    let id = base
    for (let n = 2; (await tx.get(db.collection('rooms').doc(id))).exists; n++) {
      if (n > 50) throw new ApiError('failed-precondition', 'Please choose a different room name.')
      id = `${base}-${n}`
    }
    tx.create(db.collection('rooms').doc(id), {
      ...room, id, rating: null, reviews: 0,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    })
    return { id }
  })
}

export async function updateRoom(db, idParam, body) {
  const id = parseRoomId(idParam)
  const room = parseRoomInput(body)
  const ref = db.collection('rooms').doc(id)
  await db.runTransaction(async (tx) => {
    if (!(await tx.get(ref)).exists) throw new ApiError('not-found', 'Room not found.')
    tx.update(ref, { ...room, updatedAt: FieldValue.serverTimestamp() })
  })
  return { id }
}

/** Only rooms that were never booked can be deleted; otherwise hide them instead. */
export async function deleteRoom(db, idParam) {
  const id = parseRoomId(idParam)
  const ref = db.collection('rooms').doc(id)
  if (!(await ref.get()).exists) throw new ApiError('not-found', 'Room not found.')
  const used = await db.collection('bookings').where('roomId', '==', id).limit(1).get()
  if (!used.empty) {
    throw new ApiError('failed-precondition', 'This room has bookings, so it can\'t be deleted. Turn off "Show on website" to hide it instead.')
  }
  await ref.delete()
  return { ok: true }
}
