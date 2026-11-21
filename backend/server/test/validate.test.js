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

import { verifyEmail, passwordResetEmail } from '../src/emailTemplates.js'
import { continueUrl } from '../src/accountEmails.js'

test('account emails', () => {
  const v = verifyEmail({ name: '<b>Ann</b>', link: 'https://x.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=abc&a=1' })
  assert.match(v.subject, /Confirm your email/)
  assert.ok(!v.html.includes('<b>Ann</b>'), 'name escaped')
  assert.match(v.html, /oobCode=abc&amp;a=1/) // link escaped inside HTML
  assert.match(v.text, /oobCode=abc&a=1/)
  assert.match(passwordResetEmail({ link: 'https://l' }).html, /Choose a new password/)
  const allowed = ['http://localhost:5173', 'https://monsoon-ridge.web.app']
  assert.equal(continueUrl('http://localhost:5173', allowed), 'http://localhost:5173/login')
  assert.equal(continueUrl('https://evil.example', allowed), 'https://monsoon-ridge.web.app/login')
  assert.equal(continueUrl(undefined, allowed), 'https://monsoon-ridge.web.app/login')
})

import { parseUnitList, parseUnitNumber, unitClash, parseHousekeeping } from '../src/unitRules.js'

test('room numbers: parsing', () => {
  assert.deepEqual(parseUnitList('101, 102 103\n104;105'), ['101', '102', '103', '104', '105'])
  assert.deepEqual(parseUnitList(['v1', 'V-2']), ['V1', 'V-2'])
  assert.deepEqual(parseUnitList(''), [])
  assert.equal(parseUnitNumber(7), '7')
  assert.throws(() => parseUnitList('101, 101'), /twice/)
  assert.throws(() => parseUnitList('10 1/2'), /valid room number/)
  assert.throws(() => parseUnitNumber('ROOM-NUMBER-TOO-LONG'))
})

test('room numbers: clashes', () => {
  const me = { ref: 'A', checkIn: '2026-12-10', checkOut: '2026-12-13', status: 'Confirmed' }
  const b = (ref, ci, co, status = 'Confirmed', extra = {}) => ({ ref, checkIn: ci, checkOut: co, status, ...extra })
  assert.equal(unitClash(me, [b('B', '2026-12-13', '2026-12-15')]), null, 'back-to-back is fine')
  assert.equal(unitClash(me, [b('B', '2026-12-08', '2026-12-10')]), null, 'leaves the day I arrive')
  assert.equal(unitClash(me, [b('B', '2026-12-12', '2026-12-14')])?.ref, 'B', 'overlap')
  assert.equal(unitClash(me, [b('B', '2026-12-11', '2026-12-12', 'Cancelled')]), null, 'cancelled ignored')
  assert.equal(unitClash(me, [b('B', '2026-12-05', '2026-12-12', 'CheckedOut', { checkOutActual: '2026-12-09' })]), null, 'checked out')
  assert.equal(unitClash(me, [b('A', '2026-12-10', '2026-12-13')]), null, 'itself')
  assert.equal(unitClash(me, [b('B', '2026-12-05', '2026-12-12', 'CheckedIn')])?.ref, 'B', 'guest still in the room')
})

test('housekeeping input', () => {
  assert.deepEqual(parseHousekeeping({ housekeeping: 'dirty' }), { housekeeping: 'dirty' })
  assert.deepEqual(parseHousekeeping({ outOfOrder: true, note: ' Leaking tap ' }), { outOfOrder: true, note: 'Leaking tap' })
  assert.throws(() => parseHousekeeping({ housekeeping: 'sparkly' }))
  assert.throws(() => parseHousekeeping({}))
})

import { parseReview, publicName, reviewProblem, applyRating, newToken, hashToken, tokenMatches, parseReply } from '../src/reviewRules.js'

test('reviews: input is checked and cleaned', () => {
  assert.deepEqual(parseReview({ rating: 5, title: ' Lovely ', text: '  Great stay, friendly staff. ', uid: 'x' }), { rating: 5, title: 'Lovely', text: 'Great stay, friendly staff.' })
  assert.equal(parseReview({ rating: '4', text: 'Nice and quiet room' }).rating, 4)
  for (const r of [0, 6, 4.5, 'abc', null]) assert.throws(() => parseReview({ rating: r, text: 'Nice and quiet room' }))
  assert.throws(() => parseReview({ rating: 5, text: 'short' }))
  assert.throws(() => parseReview({ rating: 5, text: 'x'.repeat(2001) }))
  assert.throws(() => parseReview({ rating: 5, title: 'x'.repeat(81), text: 'Nice and quiet room' }))
})

test('reviews: public name never shows the full surname', () => {
  assert.equal(publicName({ firstName: 'Kasun', lastName: 'perera' }), 'Kasun P.')
  assert.equal(publicName({ firstName: 'Kasun' }), 'Kasun')
  assert.equal(publicName({}), 'Guest')
})

test('reviews: only checked-out stays, once, within the time limit', () => {
  const b = { status: 'CheckedOut', checkOut: '2026-05-10' }
  assert.equal(reviewProblem(b, '2026-05-11'), null)
  assert.match(reviewProblem({ ...b, status: 'Confirmed' }, '2026-05-11'), /after you check out/)
  assert.match(reviewProblem({ ...b, status: 'CheckedIn' }, '2026-05-11'), /after you check out/)
  assert.match(reviewProblem({ ...b, review: { rating: 5 } }, '2026-05-11'), /already/)
  assert.match(reviewProblem(b, '2026-12-01'), /days after/)
  assert.equal(reviewProblem({ ...b, checkOutActual: '2026-05-08' }, '2026-09-05'), null)
})

test('reviews: room average follows adds and removals', () => {
  let room = {}
  room = applyRating(room, 5, +1)
  room = applyRating(room, 4, +1)
  assert.deepEqual(room, { reviewCount: 2, reviewSum: 9, ratingAvg: 4.5 })
  room = applyRating(room, 3, +1)
  assert.equal(room.ratingAvg, 4)
  room = applyRating(applyRating(room, 5, -1), 4, -1)
  assert.deepEqual(room, { reviewCount: 1, reviewSum: 3, ratingAvg: 3 })
  assert.deepEqual(applyRating(room, 3, -1), { reviewCount: 0, reviewSum: 0, ratingAvg: null })
})

test('reviews: link tokens are random and only the hash is compared', () => {
  const t = newToken()
  assert.notEqual(t, newToken())
  assert.ok(t.length >= 30)
  assert.equal(tokenMatches(t, hashToken(t)), true)
  assert.equal(tokenMatches(t + 'x', hashToken(t)), false)
  assert.equal(tokenMatches('', hashToken('')), false)
  assert.equal(tokenMatches(t, undefined), false)
  assert.equal(parseReply({ text: '  Thanks!  ' }), 'Thanks!')
  assert.equal(parseReply({ text: '' }), '')
  assert.throws(() => parseReply({}))
})

import { parseCharge, parsePayment, folioTotals, folioProblem, invoiceNumber, receiptNumber } from '../src/folioRules.js'
import { invoiceEmail, checkoutEmail } from '../src/emailTemplates.js'

test('bill: charges are checked and priced', () => {
  assert.deepEqual(parseCharge({ description: '  Dinner   for two ', qty: '2', unitPrice: '4,500', by: 'x' }), { description: 'Dinner for two', qty: 2, unitPrice: 4500, amount: 9000 })
  assert.equal(parseCharge({ description: 'Spa', unitPrice: 6000.4 }).amount, 6000)
  for (const bad of [{ description: 'x', unitPrice: 10 }, { description: 'Spa', unitPrice: 0 }, { description: 'Spa', unitPrice: -5 }, { description: 'Spa', unitPrice: 'abc' },
    { description: 'Spa', unitPrice: 10, qty: 0 }, { description: 'Spa', unitPrice: 10, qty: 1.5 }, { description: 'Spa', unitPrice: 1e9 }]) {
    assert.throws(() => parseCharge(bad), undefined, JSON.stringify(bad))
  }
})

test('bill: payments need an amount and a method', () => {
  assert.deepEqual(parsePayment({ amount: '10000', method: 'cash', note: ' front desk ' }), { amount: 10000, method: 'cash', note: 'front desk' })
  assert.throws(() => parsePayment({ amount: 100, method: 'bitcoin' }))
  assert.throws(() => parsePayment({ amount: 0, method: 'card' }))
  assert.throws(() => parsePayment({ amount: 100, method: 'toString' }))
})

test('bill: totals and balance', () => {
  const b = { total: 50000, charges: [{ amount: 9000 }, { amount: 6000 }], payments: [{ amount: 20000 }, { amount: 5000 }] }
  assert.deepEqual(folioTotals(b), { room: 50000, extras: 15000, total: 65000, paid: 25000, balance: 40000 })
  assert.deepEqual(folioTotals({ total: 1000 }), { room: 1000, extras: 0, total: 1000, paid: 0, balance: 1000 })
  assert.match(folioProblem({ status: 'Cancelled' }), /cancelled/)
  assert.equal(folioProblem({ status: 'CheckedOut' }), null)
  assert.equal(invoiceNumber('2026', 7), 'INV-2026-00007')
  assert.equal(receiptNumber('2026', 123), 'RCT-2026-00123')
})

test('bill: invoice emails escape what guests and staff typed', () => {
  const b = { ref: 'MRR-ABCDEFGH', roomName: 'Garden', nights: 2, checkIn: '2026-05-01', checkOut: '2026-05-03', total: 1000, price: { rooms: 800, service: 80, tax: 120 },
    guest: { firstName: '<b>Kasun</b>', lastName: 'P', email: 'k@example.com' }, charges: [{ description: '<script>x</script>', qty: 1, amount: 500 }], payments: [{ amount: 1500, method: 'cash', receipt: 'RCT-2026-00001' }], invoice: { number: 'INV-2026-00001' } }
  const t = folioTotals(b)
  const e = invoiceEmail(b, t)
  assert.ok(!e.html.includes('<script>') && e.html.includes('&lt;script&gt;') && !e.html.includes('<b>Kasun'))
  assert.match(e.html, /Paid in full/)
  assert.match(e.subject, /INV-2026-00001/)
  const c = checkoutEmail(b, t, 'https://x.test/review/MRR-ABCDEFGH?t=abc')
  assert.match(c.html, /How was your stay/)
  assert.match(c.html, /r=5/)
})

import { planChange, inventoryDelta, keptNights } from '../src/changeRules.js'


test('change: guests can move their own booking before check-in day', () => {
  const b = { roomId: 'garden', checkIn: '2026-06-10', checkOut: '2026-06-12', guests: 2, status: 'Confirmed' }
  const today = '2026-06-01'
  assert.deepEqual(planChange(b, { checkIn: '2026-06-11', checkOut: '2026-06-14' }, { today, staff: false }), { roomId: 'garden', checkIn: '2026-06-11', checkOut: '2026-06-14', nights: 3, guests: 2 })
  assert.equal(planChange(b, { guests: '3' }, { today, staff: false }).guests, 3)
  assert.throws(() => planChange(b, {}, { today, staff: false }), /Nothing has changed/)
  assert.throws(() => planChange(b, { checkIn: '2026-05-30', checkOut: '2026-06-02' }, { today, staff: false }), /past/)
  assert.throws(() => planChange(b, { checkOut: '2026-06-10' }, { today, staff: false }), /after check-in/)
  assert.throws(() => planChange(b, { checkOut: '2026-08-01' }, { today, staff: false }), /limited to/)
  assert.throws(() => planChange(b, { roomId: '../x' }, { today, staff: false }), /Unknown room/)
  assert.throws(() => planChange(b, { checkIn: 'soon' }, { today, staff: false }), /valid dates/)
  // on or after the check-in day: guests must call; staff can still change it
  assert.throws(() => planChange(b, { checkOut: '2026-06-13' }, { today: '2026-06-10', staff: false }), /already started/)
  assert.equal(planChange(b, { checkOut: '2026-06-13' }, { today: '2026-06-10', staff: true }).nights, 3)
  // three guest changes, then the hotel
  const changed = { ...b, changes: [{ role: 'guest' }, { role: 'staff' }, { role: 'guest' }, { role: 'guest' }] }
  assert.throws(() => planChange(changed, { checkOut: '2026-06-13' }, { today, staff: false }), /contact the hotel/)
  assert.equal(planChange(changed, { checkOut: '2026-06-13' }, { today, staff: true }).checkOut, '2026-06-13')
})

test('change: a checked-in stay can only be extended or shortened, by staff', () => {
  const b = { roomId: 'garden', checkIn: '2026-06-10', checkOut: '2026-06-12', guests: 2, status: 'CheckedIn' }
  const today = '2026-06-11'
  assert.equal(planChange(b, { checkOut: '2026-06-15' }, { today, staff: true }).nights, 5)
  assert.throws(() => planChange(b, { checkOut: '2026-06-15' }, { today, staff: false }), /front desk/)
  assert.throws(() => planChange(b, { checkIn: '2026-06-11', checkOut: '2026-06-15' }, { today, staff: true }), /arrival date/)
  assert.throws(() => planChange(b, { roomId: 'suite' }, { today, staff: true }), /room number/)
  assert.throws(() => planChange(b, { checkOut: '2026-06-11' }, { today, staff: true }), /after today/)
  for (const status of ['Cancelled', 'CheckedOut', 'NoShow']) assert.throws(() => planChange({ ...b, status }, { checkOut: '2026-06-15' }, { today, staff: true }))
})

test('change: only the nights that differ move in the inventory', () => {
  const old = { roomId: 'garden', checkIn: '2026-06-10', checkOut: '2026-06-12' }
  assert.deepEqual([...inventoryDelta(old, { ...old, checkOut: '2026-06-13' })], [['garden_2026-06-12', 1]])
  assert.deepEqual([...inventoryDelta(old, { ...old, checkIn: '2026-06-11', checkOut: '2026-06-12' })], [['garden_2026-06-10', -1]])
  assert.deepEqual(new Map(inventoryDelta(old, { roomId: 'suite', checkIn: '2026-06-10', checkOut: '2026-06-11' })),
    new Map([['garden_2026-06-10', -1], ['garden_2026-06-11', -1], ['suite_2026-06-10', 1]]))
  assert.equal(inventoryDelta(old, { ...old }).size, 0)
})

test('change: nights already booked keep their price, new nights use today\'s rates', () => {
  const b = { roomId: 'garden', checkIn: '2026-06-10', nights: 2, total: 0,
    price: { nightly: [{ date: '2026-06-10', rate: 10000 }, { date: '2026-06-11', rate: 10000 }], promo: { code: 'SAVE10', percent: 10 } } }
  const kept = keptNights(b, 'garden')
  const q = quoteStay(15000, ['2026-06-10', '2026-06-11', '2026-06-12'], { seasons: [], weekend: { days: [], amount: 0 } }, b.price.promo, kept)
  assert.deepEqual(q.nightly.map((n) => n.rate), [10000, 10000, 15000])
  assert.equal(q.rooms, 35000)
  assert.equal(q.discount, 3500)
  assert.equal(keptNights(b, 'suite'), null)
  // old bookings without per-night prices: the flat rate is kept
  assert.equal(keptNights({ checkIn: '2026-06-10', nights: 2, price: { rate: 9000 } }, undefined).get('2026-06-11').rate, 9000)
})

import { offerFor, parseOffer } from '../src/pricing.js'

test('stay-longer offer: cheapest night free, once per stay', () => {
  const flat = { seasons: [], weekend: { days: [5, 6], amount: 2000 } }
  const offer = { minNights: 3, perks: 'Breakfast and a sunset boat ride' }
  // Thu, Fri, Sat nights: 10000, 12000, 12000 -> Thursday is free
  const q = quoteStay(10000, ['2026-12-03', '2026-12-04', '2026-12-05'], flat, null, null, offer)
  assert.equal(q.rooms, 34000)
  assert.deepEqual(q.offer, { name: 'Stay 3 nights, pay for 2', minNights: 3, perks: offer.perks, night: '2026-12-03', amount: 10000 })
  assert.equal(q.subtotal, 24000)
  assert.equal(q.total, 24000 + 2400 + 1920)
  // too short: no offer
  assert.equal(quoteStay(10000, ['2026-12-03', '2026-12-04'], flat, null, null, offer).offer, null)
  // 6 nights still one free night
  assert.equal(quoteStay(10000, ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11', '2026-12-12'], flat, null, null, offer).offer.amount, 10000)
})

test('offer and promo code never add up: the bigger saving wins', () => {
  const flat = { seasons: [], weekend: { days: [], amount: 0 } }
  const dates = ['2026-06-01', '2026-06-02', '2026-06-03']
  const small = quoteStay(10000, dates, flat, { code: 'MONSOON10', percent: 10 }, null, { minNights: 3 })
  assert.equal(small.offer.amount, 10000)
  assert.equal(small.promo, null)
  assert.equal(small.discount, 0)
  assert.deepEqual(small.promoSkipped, { code: 'MONSOON10', percent: 10 })
  assert.equal(small.subtotal, 20000)
  const big = quoteStay(10000, dates, flat, { code: 'BIG50', percent: 50 }, null, { minNights: 3 })
  assert.equal(big.offer, null)
  assert.equal(big.offerSkipped, true)
  assert.equal(big.discount, 15000)
  assert.equal(big.promo.code, 'BIG50')
})

test('offer settings: validation and which check-in dates get it', () => {
  const o = parseOffer({ active: true, minNights: '3', from: '2026-11-01', to: '2027-03-31', perks: ' Breakfast\nand a  boat ride ' }, '2026-11-21')
  assert.deepEqual(o, { active: true, minNights: 3, from: '2026-11-01', to: '2027-03-31', perks: 'Breakfast and a boat ride' })
  assert.throws(() => parseOffer({ ...o, minNights: 1 }, '2026-11-21'), /Nights/)
  assert.throws(() => parseOffer({ ...o, to: '2026-10-01' }, '2026-11-21'), /before the start/)
  assert.throws(() => parseOffer({ ...o, from: '2026-01-01', to: '2026-02-01' }, '2026-11-21'), /past/)
  assert.equal(parseOffer({ ...o, active: false, from: '2026-01-01', to: '2026-02-01' }, '2026-11-21').active, false)
  assert.throws(() => parseOffer({ ...o, perks: 'x'.repeat(121) }, '2026-11-21'), /120/)
  assert.throws(() => parseOffer({ ...o, active: 'yes' }, '2026-11-21'))
  assert.deepEqual(offerFor(o, '2026-12-24'), { minNights: 3, perks: 'Breakfast and a boat ride' })
  assert.equal(offerFor(o, '2026-10-31'), null)
  assert.equal(offerFor(o, '2027-04-01'), null)
  assert.equal(offerFor({ ...o, active: false }, '2026-12-24'), null)
  assert.equal(offerFor(null, '2026-12-24'), null)
})
