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

/* ---------- front desk: check-in / check-out / no-show ---------- */
import { planStatusChange, nightsFrom } from '../src/statusRules.js'

const stay = (status = 'Confirmed') => ({ status, checkIn: '2026-12-10', checkOut: '2026-12-13' }) // 3 nights

test('check-in only on the stay dates and only when confirmed', () => {
  assert.throws(() => planStatusChange(stay(), 'check-in', '2026-12-09'), /Too early/)
  assert.equal(planStatusChange(stay(), 'check-in', '2026-12-10').status, 'CheckedIn')
  assert.equal(planStatusChange(stay(), 'check-in', '2026-12-12').status, 'CheckedIn') // late arrival
  assert.throws(() => planStatusChange(stay(), 'check-in', '2026-12-13'), /already ended/)
  assert.throws(() => planStatusChange(stay('Cancelled'), 'check-in', '2026-12-10'), /Only confirmed/)
})

test('early check-out frees tonight onwards; on-time frees nothing', () => {
  const early = planStatusChange(stay('CheckedIn'), 'check-out', '2026-12-11')
  assert.equal(early.status, 'CheckedOut')
  assert.equal(early.fields.checkOutActual, '2026-12-11')
  assert.deepEqual(nightsFrom(stay(), early.freeFrom), ['2026-12-11', '2026-12-12'])
  const onTime = planStatusChange(stay('CheckedIn'), 'check-out', '2026-12-13')
  assert.equal(onTime.freeFrom, null)
  assert.equal(onTime.fields.checkOutActual, '2026-12-13')
  assert.throws(() => planStatusChange(stay(), 'check-out', '2026-12-11'), /checked-in/)
})

test('no-show frees the rest of the stay; undo check-in works', () => {
  const ns = planStatusChange(stay(), 'no-show', '2026-12-11')
  assert.equal(ns.status, 'NoShow')
  assert.deepEqual(nightsFrom(stay(), ns.freeFrom), ['2026-12-11', '2026-12-12'])
  assert.throws(() => planStatusChange(stay(), 'no-show', '2026-12-09'), /isn't due/)
  assert.equal(planStatusChange(stay('CheckedIn'), 'undo-check-in', '2026-12-10').status, 'Confirmed')
  assert.throws(() => planStatusChange(stay(), 'delete-everything', '2026-12-10'), /Unknown action/)
})

/* ---------- room blocks + staff bookings ---------- */
import { parseBlockInput } from '../src/blockRules.js'

test('room block validation', () => {
  const ok = parseBlockInput({ roomId: 'family-villa', from: '2026-12-01', to: '2026-12-05', units: '1', reason: ' Renovation ' }, '2026-11-20')
  assert.deepEqual(ok, { roomId: 'family-villa', from: '2026-12-01', to: '2026-12-05', nights: 4, units: 1, reason: 'Renovation' })
  const no = (patch, re) => assert.throws(() => parseBlockInput({ roomId: 'family-villa', from: '2026-12-01', to: '2026-12-05', units: 1, reason: 'Renovation', ...patch }, '2026-11-20'), re)
  no({ from: '2026-11-01' }, /past/)
  no({ to: '2026-12-01' }, /after the start/)
  no({ to: '2027-06-01' }, /at most/)
  no({ units: 0 }, /whole number/)
  no({ reason: '' }, /reason/)
  no({ roomId: '../x' }, /Unknown room/)
})

test('staff bookings may omit the guest email; online bookings may not', () => {
  const d = valid()
  d.guest.email = ''
  assert.throws(() => parseBookingRequest(d), /Email/)
  assert.equal(parseBookingRequest(d, { staff: true }).guest.email, '')
  d.guest.email = 'not-an-email'
  assert.throws(() => parseBookingRequest(d, { staff: true }), /Email/)
})

import { nightlyRates, quoteStay, parsePricingRules, parsePromoInput, promoProblem } from '../src/pricing.js'

test('seasons and weekend extras price each night', () => {
  const rules = { seasons: [{ name: 'Peak', months: [12, 4], percent: 20 }], weekend: { days: [5, 6], amount: 2000 } }
  // 2026-12-04 is a Friday, 12-05 Saturday, 12-06 Sunday; 11-30 Monday (no season)
  const n = nightlyRates(10000, ['2026-11-30', '2026-12-04', '2026-12-05', '2026-12-06'], rules)
  assert.deepEqual(n.map((x) => x.rate), [10000, 14000, 14000, 12000])
  const q = quoteStay(10000, ['2026-12-04', '2026-12-06'], rules, { code: 'MONSOON10', percent: 10 })
  assert.equal(q.rooms, 26000)
  assert.equal(q.discount, 2600)
  assert.equal(q.subtotal, 23400)
  assert.equal(q.total, 23400 + 2340 + 1872)
  assert.equal(quoteStay(18500, ['2026-11-30', '2026-12-01'], { seasons: [], weekend: { days: [], amount: 0 } }).total, 43660)
})

test('pricing rules validation', () => {
  assert.deepEqual(parsePricingRules({ seasons: [{ name: ' Peak ', months: [4, 12, 12], percent: '20' }], weekend: { days: [6, 5], amount: 2000 } }),
    { seasons: [{ name: 'Peak', months: [4, 12], percent: 20 }], weekend: { days: [5, 6], amount: 2000 } })
  assert.throws(() => parsePricingRules({ seasons: [{ name: 'A', months: [12], percent: 10 }, { name: 'B', months: [12], percent: 5 }] }), /same month/)
  assert.throws(() => parsePricingRules({ seasons: [{ name: 'A', months: [13], percent: 10 }] }))
  assert.throws(() => parsePricingRules({ seasons: [], weekend: { days: [], amount: 500 } }), /weekend/)
})

test('promo codes', () => {
  const t = '2026-11-18'
  assert.deepEqual(parsePromoInput({ code: ' monsoon10 ', percent: 10, expires: '2026-12-31', maxUses: 50 }, t),
    { code: 'MONSOON10', percent: 10, expires: '2026-12-31', maxUses: 50 })
  assert.equal(parsePromoInput({ code: 'ABC', percent: 5, expires: t, maxUses: '' }, t).maxUses, null)
  assert.throws(() => parsePromoInput({ code: 'A!', percent: 10, expires: '2026-12-31' }, t))
  assert.throws(() => parsePromoInput({ code: 'ABC', percent: 95, expires: '2026-12-31' }, t))
  assert.throws(() => parsePromoInput({ code: 'ABC', percent: 10, expires: '2026-01-01' }, t), /past/)
  assert.deepEqual(parsePromoInput({ active: false }, t, { partial: true }), { active: false })
  assert.equal(promoProblem({ active: true, expires: '2026-12-31', maxUses: 2, used: 1 }, t), '')
  assert.match(promoProblem({ active: true, expires: '2026-11-17', maxUses: null }, t), /expired/)
  assert.match(promoProblem({ active: true, expires: '2026-12-31', maxUses: 2, used: 2 }, t), /fully used/)
  assert.match(promoProblem({ active: false, expires: '2026-12-31' }, t), /valid/)
  assert.match(promoProblem(null, t), /valid/)
})

import { parseContact } from '../src/messages.js'
import { bookingConfirmation, staffNewMessage, esc } from '../src/emailTemplates.js'

test('contact form validation + honeypot', () => {
  const ok = parseContact({ name: ' Nimal ', email: 'Nimal@Example.com', subject: 'Wedding', message: 'Do you host weddings for 80 people?', extra: 'x' })
  assert.deepEqual(ok, { name: 'Nimal', email: 'nimal@example.com', phone: '', subject: 'Wedding', message: 'Do you host weddings for 80 people?', bot: false })
  assert.equal(parseContact({ name: 'Bot', email: 'b@b.co', message: 'Buy cheap things now!!', website: 'http://spam' }).bot, true)
  assert.throws(() => parseContact({ name: '', email: 'a@b.co', message: 'Hello there friends' }), /name/)
  assert.throws(() => parseContact({ name: 'A', email: 'not-an-email', message: 'Hello there friends' }), /valid email/)
  assert.throws(() => parseContact({ name: 'A', email: 'a@b.co', message: 'hi' }), /short/)
  assert.throws(() => parseContact({ name: 'A', email: 'a@b.co', message: 'x'.repeat(3001) }), /long/)
  assert.throws(() => parseContact({ name: 'A', email: 'a@b.co', message: 'Hello there friends', phone: 'call me' }), /Phone/)
})

test('email templates escape guest input', () => {
  assert.equal(esc('<script>"x"&\''), '&lt;script&gt;&quot;x&quot;&amp;&#39;')
  const b = { ref: 'MRR-ABCDEFGH', roomName: 'Family Villa', checkIn: '2026-12-04', checkOut: '2026-12-06', nights: 2, guests: 3, total: 99120, payment: 'hotel', uid: 'u1',
    price: { discount: 8400, promo: { code: 'MONSOON10' }, service: 7560, tax: 6048 },
    guest: { firstName: '<img src=x onerror=alert(1)>', lastName: 'P', email: 'g@x.com', requests: '<b>late</b>' } }
  const e = bookingConfirmation(b)
  assert.match(e.subject, /MRR-ABCDEFGH/)
  assert.ok(!e.html.includes('<img src=x'), 'name is escaped')
  assert.ok(!e.html.includes('<b>late</b>'), 'requests are escaped')
  assert.match(e.html, /LKR 99,120/)
  assert.match(e.html, /MONSOON10/)
  assert.match(e.text, /Fri, 4 Dec 2026/)
  const m = staffNewMessage({ name: 'A<b>', email: 'a@b.co', subject: '', message: '<script>alert(1)</script>' })
  assert.ok(!m.html.includes('<script>alert'))
})

import { describeRules, roomChanges } from '../src/activity.js'
import { parseStaffEmail } from '../src/staff.js'

test('activity log descriptions', () => {
  assert.equal(describeRules({ seasons: [{ name: 'Peak', months: [12, 4], percent: 20 }], weekend: { days: [5, 6], amount: 2000 } }),
    'Peak +20% (Dec, Apr) · Weekend +LKR 2,000 (Fri, Sat)')
  assert.equal(describeRules({ seasons: [], weekend: { days: [], amount: 0 } }), 'No seasons · No weekend extra')
  assert.deepEqual(roomChanges({ name: 'A', price: 20000, units: 6, active: true }, { name: 'A', price: 22000, units: 5, active: false }),
    ['price LKR 20,000 → LKR 22,000', 'rooms 6 → 5', 'shown on website yes → no'])
  assert.deepEqual(roomChanges({ price: 1 }, { price: 1 }), [])
})

test('staff email validation', () => {
  assert.equal(parseStaffEmail('  Desk@Hotel.LK '), 'desk@hotel.lk')
  assert.throws(() => parseStaffEmail('nope'))
  assert.throws(() => parseStaffEmail('a/b@x.com'))
})
