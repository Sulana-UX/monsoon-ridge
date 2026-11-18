import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBookingRequest, parseRef, isValidISODate, nightsOf, hotelToday, daysBetween } from '../src/validate.js'
import { priceFor } from '../src/rooms.js'

const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const today = hotelToday()

const valid = () => ({
  roomId: 'deluxe-garden',
  checkIn: addDays(today, 3),
  checkOut: addDays(today, 5),
  guests: 2,
  payment: 'hotel',
  guest: {
    firstName: ' Kasun ', lastName: 'Perera', email: 'Kasun@Example.com', phone: '+94 77 123 4567',
    country: 'Sri Lanka', arrival: '14:00', requests: '',
  },
})

const rejects = (patch, re) => {
  const d = valid()
  patch(d)
  assert.throws(() => parseBookingRequest(d), (e) => e.code === 'invalid-argument' && re.test(e.message))
}

test('accepts a normal booking and normalises it', () => {
  const r = parseBookingRequest(valid())
  assert.equal(r.nights, 2)
  assert.equal(r.guest.firstName, 'Kasun')
  assert.equal(r.guest.email, 'kasun@example.com')
})

test('drops fields the client should not control', () => {
  const d = valid()
  d.total = 1
  d.status = 'Confirmed'
  d.uid = 'someone-else'
  d.guest.isAdmin = true
  const r = parseBookingRequest(d)
  assert.equal('total' in r, false)
  assert.equal('uid' in r, false)
  assert.equal('isAdmin' in r.guest, false)
})

test('rejects bad dates', () => {
  rejects((d) => { d.checkIn = addDays(today, -1) }, /past/)
  rejects((d) => { d.checkOut = d.checkIn }, /after check-in/)
  rejects((d) => { d.checkIn = '2026-02-31' }, /valid dates/)
  rejects((d) => { d.checkOut = addDays(d.checkIn, 31) }, /30 nights/)
  rejects((d) => { d.checkIn = addDays(today, 400); d.checkOut = addDays(today, 401) }, /365 days/)
})

test('rejects bad guest details and injection-shaped input', () => {
  rejects((d) => { d.guests = 0 }, /guests/)
  rejects((d) => { d.guests = '2' }, /guests/)
  rejects((d) => { d.payment = 'free' }, /Payment/)
  rejects((d) => { d.roomId = '../admin' }, /room/)
  rejects((d) => { d.guest.email = 'nope' }, /Email/)
  rejects((d) => { d.guest.phone = '123' }, /Phone/)
  rejects((d) => { d.guest.firstName = { $gt: '' } }, /First name/)
  rejects((d) => { d.guest.requests = 'x'.repeat(501) }, /too long/)
  rejects((d) => { d.guest.country = 'Atlantis' }, /Country/)
})

test('booking references', () => {
  assert.equal(parseRef('MRR-ABCD2345'), 'MRR-ABCD2345')
  assert.throws(() => parseRef('../../x'))
  assert.throws(() => parseRef('MRR-abc'))
})

test('date helpers', () => {
  assert.equal(isValidISODate('2026-12-01'), true)
  assert.equal(isValidISODate('2026-13-01'), false)
  assert.deepEqual(nightsOf('2026-12-30', 3), ['2026-12-30', '2026-12-31', '2027-01-01'])
  assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3)
})

test('server pricing', () => {
  assert.deepEqual(priceFor(18500, 2), { rate: 18500, nights: 2, subtotal: 37000, service: 3700, tax: 2960, total: 43660 })
})

/* ---------- rooms (admin form) ---------- */
import { parseRoomInput, slugify } from '../src/rooms.js'

const room = () => ({
  name: 'Garden Double', type: 'Double', price: 18500, guests: 2, units: 4, size: 30,
  beds: '1 King Bed', view: 'Garden', short: 'A calm room by the garden.',
  description: 'A calm room by the garden with warm timber floors.',
  amenities: ['wifi', 'ac'], gallery: ['https://images.unsplash.com/photo-1'], featured: true, active: true,
})

test('accepts a valid room and sets the main image', () => {
  const r = parseRoomInput(room())
  assert.equal(r.image, r.gallery[0])
  assert.equal(r.type, 'Double')
})

test('room form: numbers from inputs are accepted, unknown fields dropped', () => {
  const r = parseRoomInput({ ...room(), price: '20000', rating: 5, id: 'hack' })
  assert.equal(r.price, 20000)
  assert.equal('rating' in r, false)
  assert.equal('id' in r, false)
})

test('room form rejects bad input', () => {
  const no = (patch, re) => assert.throws(() => parseRoomInput({ ...room(), ...patch }), (e) => e.code === 'invalid-argument' && re.test(e.message))
  no({ type: 'Suite' }, /Category/)
  no({ price: 50 }, /Price/)
  no({ price: 1234.5 }, /Price/)
  no({ guests: 0 }, /guests/)
  no({ amenities: ['jacuzzi'] }, /amenity/)
  no({ gallery: [] }, /photo/)
  no({ gallery: ['http://insecure.com/a.jpg'] }, /https/)
  no({ gallery: ['javascript:alert(1)'] }, /https|link/)
  no({ name: 'x' }, /name/)
})

test('slugify makes safe ids', () => {
  assert.equal(slugify('Deluxe Family Room!'), 'deluxe-family-room')
  assert.equal(slugify('  ../../etc  '), 'etc')
})

/* ---------- Cloudinary signing ---------- */
import { createHash } from 'node:crypto'
import { signRoomUpload } from '../src/uploads.js'

test('upload signature matches Cloudinary’s algorithm and never returns the secret', () => {
  Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 'shh' })
  const s = signRoomUpload()
  const expected = createHash('sha1').update(`allowed_formats=${s.allowed_formats}&folder=${s.folder}&timestamp=${s.timestamp}shh`).digest('hex')
  assert.equal(s.signature, expected)
  assert.equal(JSON.stringify(s).includes('shh'), false)
  delete process.env.CLOUDINARY_API_SECRET
  assert.throws(() => signRoomUpload(), /not set up/)
})
