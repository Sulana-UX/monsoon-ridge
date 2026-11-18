/*
 * Server-side source of truth for prices and inventory.
 * The frontend shows its own copy for display, but every booking is priced
 * and checked against THIS file, so a guest can never change what they pay.
 *
 * units = how many physical rooms of this type the hotel has.
 * Keep `id`, `name`, `price` and `guests` in sync with frontend/src/data/rooms.js.
 */
const u = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`

export const ROOMS = {
  'deluxe-garden': { name: 'Deluxe Garden Room', price: 18500, guests: 2, units: 6, image: u('photo-1611892440504-42a792e24d32') },
  'river-view-suite': { name: 'River View Suite', price: 32000, guests: 3, units: 4, image: u('photo-1774280954999-9758f11f3d41') },
  'family-villa': { name: 'Family Pool Villa', price: 54000, guests: 5, units: 2, image: u('photo-1605538032432-a9f0c8d9baac') },
  'superior-twin': { name: 'Superior Twin Room', price: 14500, guests: 2, units: 6, image: u('photo-1776500587879-5f8acadf4a69') },
  'honeymoon-suite': { name: 'Honeymoon Suite', price: 38500, guests: 2, units: 2, image: u('photo-1791535767615-2fb43a41e8a8') },
  'standard-queen': { name: 'Classic Queen Room', price: 12000, guests: 2, units: 8, image: u('photo-1662841540530-2f04bb3291e8') },
}

export const SERVICE_RATE = 0.1
export const TAX_RATE = 0.08

export const priceFor = (rate, nights) => {
  const subtotal = rate * nights
  const service = Math.round(subtotal * SERVICE_RATE)
  const tax = Math.round(subtotal * TAX_RATE)
  return { rate, nights, subtotal, service, tax, total: subtotal + service + tax }
}
