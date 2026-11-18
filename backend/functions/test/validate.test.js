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
