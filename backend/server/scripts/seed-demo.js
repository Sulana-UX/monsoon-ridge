/*
 * Demo data for the LOCAL Firebase emulators: rooms, room numbers, prices and promo codes,
 * 18 bookings (in the hotel, arriving today, upcoming, past with bills and reviews), guest messages,
 * staff and an activity log. Every guest is made up; emails use example.com.
 *
 *   npm run emulators            (repo root, keep it running)
 *   npm run seed-demo            (backend/server)
 *
 * It ALWAYS writes to the emulators (it sets the emulator addresses itself), never to the real project.
 * Sign in on the site with:  manager@monsoonridge.lk  or  nimali.perera@example.com   (password Demo-pass-2026)
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
const LOCAL = /^(127\.0\.0\.1|localhost):\d+$/
if (!LOCAL.test(process.env.FIRESTORE_EMULATOR_HOST) || !LOCAL.test(process.env.FIREBASE_AUTH_EMULATOR_HOST)) {
  console.error('Refusing to run: the emulator addresses must be on this computer.')
  process.exit(1)
}
const reach = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/`).catch(() => null)
if (!reach) {
  console.error('The Firestore emulator is not running. Start it first: npm run emulators (in the repo root).')
  process.exit(1)
}
delete process.env.FIREBASE_SERVICE_ACCOUNT
delete process.env.GOOGLE_APPLICATION_CREDENTIALS
const { db, auth } = await import('../src/firebase.js')
const { parseRoomInput } = await import('../src/rooms.js')
const { quoteStay } = await import('../src/pricing.js')
const { applyRating, hashToken } = await import('../src/reviewRules.js')
const { hotelToday, nightsOf } = await import('../src/validate.js')
const { rooms: starter } = await import('../../../frontend/src/data/rooms.js')
const { Timestamp } = await import('firebase-admin/firestore')

const CATEGORY = { 'standard-queen': 'Single', 'deluxe-garden': 'Double', 'superior-twin': 'Double', 'honeymoon-suite': 'Double', 'river-view-suite': 'Family', 'family-villa': 'Family' }
const T = hotelToday()
const day = (n) => { const d = new Date(`${T}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const at = (n, h = 10, m = 0) => { const d = new Date(`${day(n)}T00:00:00+05:30`); d.setTime(d.getTime() + (h * 60 + m) * 60000); return Timestamp.fromDate(d) }
const RULES = { seasons: [{ name: 'Peak season', months: [12, 1, 4], percent: 20 }, { name: 'Monsoon', months: [6, 7], percent: -15 }], weekend: { days: [5, 6], amount: 2500 } }

/* rooms */
const rooms = {}
for (const r of starter) {
  const room = { ...parseRoomInput({ ...r, type: CATEGORY[r.id] ?? 'Double', active: true }), id: r.id, reviewCount: 0, reviewSum: 0, ratingAvg: null, createdAt: at(-90), updatedAt: at(-3) }
  rooms[r.id] = room
  await db.collection('rooms').doc(r.id).set(room)
}
await db.collection('settings').doc('pricing').set({ ...RULES, updatedAt: at(-10), updatedBy: 'manager@monsoonridge.lk' })
await db.collection('settings').doc('offer').set({ active: true, minNights: 3, from: day(-10), to: day(120), perks: 'Breakfast and a sunset boat ride', updatedAt: at(-10) })
await db.collection('promos').doc('MONSOON10').set({ code: 'MONSOON10', percent: 10, active: true, maxUses: 100, used: 23, expires: day(60), createdAt: at(-40), createdBy: 'manager@monsoonridge.lk' })
await db.collection('promos').doc('HONEYMOON15').set({ code: 'HONEYMOON15', percent: 15, active: true, maxUses: null, used: 7, expires: null, createdAt: at(-30), createdBy: 'manager@monsoonridge.lk' })
await db.collection('promos').doc('EARLYBIRD').set({ code: 'EARLYBIRD', percent: 12, active: false, maxUses: 50, used: 50, expires: day(-5), createdAt: at(-80), createdBy: 'manager@monsoonridge.lk' })

/* room numbers */
const NUMBERS = { 'deluxe-garden': ['101', '102', '103', '104', '105', '106'], 'superior-twin': ['201', '202', '203', '204', '205', '206'], 'standard-queen': ['301', '302', '303', '304', '305', '306', '307', '308'], 'river-view-suite': ['S1', 'S2', 'S3', 'S4'], 'family-villa': ['V1', 'V2'], 'honeymoon-suite': ['H1', 'H2'] }
const HK = { 102: 'dirty', 104: 'cleaning', 203: 'dirty', 305: 'dirty', 306: 'cleaning', S2: 'dirty' }
for (const [roomId, nums] of Object.entries(NUMBERS)) {
  for (const n of nums) {
    await db.collection('roomUnits').doc(n).set({ number: n, roomId, roomName: rooms[roomId].name, housekeeping: HK[n] || 'clean', outOfOrder: n === '308', ...(n === '308' && { note: 'AC repair' }), updatedAt: at(0, 8), updatedBy: 'frontdesk@monsoonridge.lk' })
  }
}

/* bookings */
const GUEST_UID = 'demo-guest-nimali'
const G = (first, last, country, extra = {}) => ({ firstName: first, lastName: last, email: `${first.toLowerCase()}.${last.toLowerCase().replace(/\W/g, '')}@example.com`, phone: '+94 77 ' + String(1000000 + Math.floor(first.length * 734567 + last.length * 91234) % 8999999).slice(0, 3) + ' ' + String(1000 + last.length * 731).slice(0, 4), country, arrival: '14:00', requests: '', ...extra })
let n = 0
const refFor = () => 'MRR-' + ['7K2P9QXA', 'B4HN8TWE', 'C9MR2LKD', 'D3VQ7PZA', 'E8WT5JHN', 'F2XK9RBM', 'G6LN3YCP', 'H5QA8VDS', 'J7RD4MFT', 'K3SE6NGU', 'L9TB2PHW', 'M4UC7QJX', 'N8VD3RKY', 'P2WE9SLZ', 'Q6XF5TMA', 'R3YG8UNB', 'S7ZH4VPC', 'T5AJ9WQD', 'U8BK2XRE', 'V4CL6YSF'][n++]
const bookings = []
function book({ roomId, from, nights, guests = 2, guest, status, unit, source = 'online', promo = null, uid = null, charges = [], payments = [], extra = {} }) {
  const room = rooms[roomId]
  const checkIn = day(from), checkOut = day(from + nights)
  const price = quoteStay(room.price, nightsOf(checkIn, nights), RULES, promo)
  const b = {
    ref: refFor(), roomId, roomName: room.name, image: room.image, checkIn, checkOut, nights, guests, payment: 'hotel', price, total: price.total,
    guest, status, source, uid, accountEmail: uid ? guest.email : null, createdAt: at(from - 12 - n, 11, 20), ...(unit && { unit }),
    ...(source !== 'online' && { createdBy: 'frontdesk@monsoonridge.lk' }),
    charges: charges.map((c, i) => ({ id: `c${n}${i}`, qty: 1, ...c, amount: (c.qty || 1) * c.unitPrice, by: 'frontdesk@monsoonridge.lk', at: at(from + (c.d ?? 0), 20) })),
    payments: payments.map((p, i) => ({ id: `p${n}${i}`, note: '', ...p, receipt: `RCT-2026-${String(40 + n * 2 + i).padStart(5, '0')}`, by: 'frontdesk@monsoonridge.lk', at: at(from + (p.d ?? 0), 15) })),
    emails: { confirmation: { status: 'sent', at: at(from - 12, 11, 21) } },
    ...extra,
  }
  if (status === 'CheckedIn' || status === 'CheckedOut') Object.assign(b, { checkedInAt: at(from, 14, 25), statusBy: 'frontdesk@monsoonridge.lk', statusAt: at(from, 14, 25) })
  if (status === 'CheckedOut') Object.assign(b, { checkedOutAt: at(from + nights, 10, 40), checkOutActual: checkOut })
  if (status === 'Cancelled') Object.assign(b, { cancelledAt: at(from - 4, 9), cancelledBy: 'guest' })
  bookings.push(b)
  return b
}

const nimali = G('Nimali', 'Perera', 'Sri Lanka')
// past stays (checked out, paid, reviewed)
book({ roomId: 'honeymoon-suite', from: -30, nights: 3, guest: nimali, uid: GUEST_UID, status: 'CheckedOut', unit: 'H1', promo: { code: 'HONEYMOON15', percent: 15 },
  charges: [{ description: 'Candle-lit dinner for two', unitPrice: 14500 }, { description: 'Couples Ayurveda massage', unitPrice: 18000, d: 1 }],
  extra: { invoice: { number: 'INV-2026-00031', issuedAt: at(-27, 10, 35), issuedBy: 'check-out' }, review: { rating: 5, at: at(-25) } } })
bookings.at(-1).payments = [{ id: 'pa', amount: bookings.at(-1).total + 32500, method: 'card', note: 'Visa ending 4242', receipt: 'RCT-2026-00052', by: 'frontdesk@monsoonridge.lk', at: at(-27, 10, 30) }]
const past = [
  ['river-view-suite', -18, 4, G('James', 'Whitfield', 'United Kingdom'), 'S3', 5],
  ['family-villa', -15, 5, G('Aisha', 'Rahman', 'Other'), 'V1', 5],
  ['deluxe-garden', -12, 2, G('Kasun', 'Jayasuriya', 'Sri Lanka'), '103', 4],
  ['superior-twin', -10, 3, G('Lena', 'Hoffmann', 'Germany'), '204', 5],
  ['standard-queen', -9, 2, G('Ravi', 'Menon', 'India'), '302', 3],
  ['deluxe-garden', -6, 3, G('Sophie', 'Martin', 'Other'), '105', 5],
]
for (const [roomId, from, nights, guest, unit, rating] of past) {
  const b = book({ roomId, from, nights, guest, status: 'CheckedOut', unit, charges: rating > 4 ? [{ description: 'Dinner at the river terrace', unitPrice: 9800 }] : [], extra: { invoice: { number: `INV-2026-000${40 + n}`, issuedAt: at(from + nights, 10, 35), issuedBy: 'check-out' }, review: { rating, at: at(from + nights + 2) } } })
  b.payments = [{ id: 'pb', amount: b.total + b.charges.reduce((s, c) => s + c.amount, 0), method: n % 2 ? 'cash' : 'card', note: '', receipt: `RCT-2026-000${60 + n}`, by: 'frontdesk@monsoonridge.lk', at: at(from + nights, 10, 30) }]
}
// in the hotel now
book({ roomId: 'deluxe-garden', from: -2, nights: 4, guest: G('Daniel', 'Okafor', 'United States', { requests: 'Late check-out if possible' }), status: 'CheckedIn', unit: '101',
  charges: [{ description: 'Airport transfer', unitPrice: 12000, d: 0 }, { description: 'Dinner for two', qty: 2, unitPrice: 4500, d: 1 }], payments: [{ amount: 40000, method: 'card', note: 'Mastercard ending 1881', d: 0 }] })
book({ roomId: 'river-view-suite', from: -1, nights: 3, guest: G('Mei', 'Tanaka', 'Other'), status: 'CheckedIn', unit: 'S1', charges: [{ description: 'Spa: hot stone massage', unitPrice: 15000, d: 0 }] })
book({ roomId: 'superior-twin', from: -3, nights: 3, guest: G('Tharindu', 'Fernando', 'Sri Lanka'), status: 'CheckedIn', unit: '201', source: 'walk-in', payments: [{ amount: 20000, method: 'cash', d: 0 }] })
book({ roomId: 'family-villa', from: -1, nights: 5, guests: 4, guest: G('Olivia', 'Brown', 'Australia', { requests: 'Two extra beds for the kids' }), status: 'CheckedIn', unit: 'V2' })
// arriving today
book({ roomId: 'honeymoon-suite', from: 0, nights: 4, guest: G('Arjun', 'Shah', 'India', { arrival: '15:30', requests: 'Honeymoon: flowers in the room please' }), status: 'Confirmed', unit: 'H2', promo: { code: 'HONEYMOON15', percent: 15 } })
book({ roomId: 'deluxe-garden', from: 0, nights: 2, guest: G('Emma', 'Laurent', 'Other', { arrival: '13:00' }), status: 'Confirmed' })
book({ roomId: 'standard-queen', from: 0, nights: 1, guests: 1, guest: G('Chamara', 'Silva', 'Sri Lanka'), status: 'Confirmed', source: 'phone' })
// upcoming
book({ roomId: 'river-view-suite', from: 3, nights: 4, guest: nimali, uid: GUEST_UID, status: 'Confirmed', promo: { code: 'MONSOON10', percent: 10 } })
book({ roomId: 'superior-twin', from: 5, nights: 2, guest: G('Lucas', 'Silva', 'Other'), status: 'Confirmed' })
book({ roomId: 'family-villa', from: 9, nights: 6, guests: 4, guest: G('Priya', 'Nair', 'India'), status: 'Confirmed' })
book({ roomId: 'deluxe-garden', from: 12, nights: 3, guest: G('Tom', 'Becker', 'Germany'), status: 'Cancelled' })

// inventory for every live night (so the availability matches the bookings)
const inv = {}
for (const b of bookings) {
  if (b.status === 'Cancelled') continue
  for (const d of nightsOf(b.checkIn, b.nights)) inv[`${b.roomId}_${d}`] = (inv[`${b.roomId}_${d}`] || 0) + 1
}
for (const [k, booked] of Object.entries(inv)) await db.collection('inventory').doc(k).set({ roomId: k.slice(0, -11), date: k.slice(-10), booked })
for (const b of bookings) {
  if (b.review) b.reviewTokenHash = hashToken('demo')
  await db.collection('bookings').doc(b.ref).set(b)
}

/* reviews */
const TEXTS = {
  5: [['Woke up in the clouds', 'The suite was spotless and so peaceful. Breakfast on the deck was the highlight, and the staff arranged a tuk-tuk to Nine Arches Bridge for us. We are already planning our next visit.'],
    ['Best stay in Sri Lanka', 'The river view from the bath is unreal, and the staff remembered our names from day one. The Ayurveda massage was worth every rupee.'],
    ['Perfect for the family', 'Our kids loved the private pool villa. Calm, safe and beautifully designed. Check-in took two minutes and the extra beds were ready.'],
    ['Quiet and green', 'Lovely room opening onto the garden, great breakfast, and the most helpful front desk. Ella town is a short ride away.'],
    ['We will be back', 'Thoughtful touches everywhere: fresh flowers, a hand-written welcome note and a dinner by the river we will never forget.']],
  4: [['Lovely garden room', 'Comfortable bed and a beautiful garden view. The wifi was a little slow in the evening, but the staff were quick to help.']],
  3: [['Good value', 'Clean and comfortable room for the price. The road noise was noticeable at night; ask for a room at the back.']],
}
const counters = { 5: 0, 4: 0, 3: 0 }
for (const b of bookings.filter((x) => x.review)) {
  const [title, text] = TEXTS[b.review.rating][counters[b.review.rating]++ % TEXTS[b.review.rating].length]
  const reply = b.review.rating <= 4 ? { text: b.review.rating === 3 ? 'Thank you, Ravi. We have moved our quieter rooms to the top of the list for light sleepers, and hope to welcome you back.' : 'Thank you, Kasun! We have upgraded the wifi in the garden rooms since your stay.', at: b.review.at } : null
  await db.collection('reviews').doc(b.ref).set({ ref: b.ref, roomId: b.roomId, roomName: b.roomName, rating: b.review.rating, title, text, name: `${b.guest.firstName} ${b.guest.lastName[0]}.`, stayMonth: b.checkOut.slice(0, 7), status: 'published', createdAt: b.review.at, ...(reply && { reply }) })
  const room = rooms[b.roomId]
  Object.assign(room, applyRating(room, b.review.rating, +1))
  await db.collection('rooms').doc(b.roomId).update(applyRating({ reviewCount: room.reviewCount - 1, reviewSum: room.reviewSum - b.review.rating }, b.review.rating, +1))
}
// two more reviews on other rooms, so the home page has real quotes
const extraReviews = [['deluxe-garden', 'Hannah W.', 5, 'Mist over the hills every morning', 'Waking up to mist over the mountains was unreal. The garden room was cosy, the food was fresh and local, and the team made us feel at home.', -40],
  ['family-villa', 'Marco R.', 5, 'Our favourite place in Ella', 'Spacious villa, private pool and the kindest staff. The cooking class with the chef was a highlight for the whole family.', -50]]
for (const [roomId, name, rating, title, text, d] of extraReviews) {
  const ref = 'MRR-X' + name.replace(/\W/g, '').toUpperCase().padEnd(7, 'Z').slice(0, 7)
  await db.collection('reviews').doc(ref).set({ ref, roomId, roomName: rooms[roomId].name, rating, title, text, name, stayMonth: day(d).slice(0, 7), status: 'published', createdAt: at(d) })
  const room = rooms[roomId]
  const next = applyRating(room, rating, +1)
  Object.assign(room, next)
  await db.collection('rooms').doc(roomId).update(next)
}

/* inbox */
const msgs = [
  { name: 'Sarah Collins', email: 'sarah.collins@example.com', phone: '+44 7700 900123', subject: 'Airport pickup for 4 people', message: 'Hello! We land at Colombo airport on 14 December at 6 am. Can you arrange a pickup for four adults with luggage, and how much would it cost?\n\nThank you,\nSarah', status: 'new', createdAt: at(0, 9, 12) },
  { name: 'Rohan Gupta', email: 'rohan.g@example.com', phone: '', subject: 'Anniversary surprise', message: "My wife and I will stay in the Honeymoon Suite next month for our 10th anniversary. Could you help with a cake and some flowers in the room? Please don't call her number.", status: 'new', createdAt: at(-1, 18, 40) },
  { name: 'Anna Kowalska', email: 'anna.k@example.com', phone: '', subject: 'Vegan meals?', message: 'Do you offer vegan options at breakfast and dinner? We are two vegans travelling for a week.', status: 'replied', createdAt: at(-3, 11, 5), statusBy: 'frontdesk@monsoonridge.lk', replies: [{ text: 'Yes! Our chef makes vegan curries, hoppers and fresh fruit plates every day. Just let us know at check-in.', by: 'frontdesk@monsoonridge.lk', at: at(-3, 12, 20) }] },
  { name: 'Group Travel Co.', email: 'groups@example.com', phone: '+94 11 555 0101', subject: 'Group booking, 12 rooms in March', message: 'We are planning a corporate retreat for 20 people from 10 to 13 March. Could you send a quote for 12 rooms including meals?', status: 'read', createdAt: at(-4, 10, 0), statusBy: 'manager@monsoonridge.lk' },
]
for (const m of msgs) await db.collection('messages').add(m)

/* staff + activity */
await db.collection('staff').doc('manager@monsoonridge.lk').set({ email: 'manager@monsoonridge.lk', role: 'admin', addedBy: 'owner', addedAt: at(-120) })
await db.collection('staff').doc('frontdesk@monsoonridge.lk').set({ email: 'frontdesk@monsoonridge.lk', role: 'frontdesk', addedBy: 'manager@monsoonridge.lk', addedAt: at(-100) })
const acts = [
  [0, 9, 'frontdesk@monsoonridge.lk', 'staff', 'booking.check-in', 'Checked in: Daniel Okafor, Deluxe Garden Room, room 101', bookings.find((b) => b.guest.firstName === 'Daniel').ref],
  [0, 8, 'frontdesk@monsoonridge.lk', 'staff', 'booking.payment_added', 'Took LKR 40,000 by card from Daniel Okafor (RCT-2026-00071), LKR 41,150 still to pay', bookings.find((b) => b.guest.firstName === 'Daniel').ref],
  [-1, 16, 'manager@monsoonridge.lk', 'staff', 'pricing.rules', 'Changed price rules: Peak season +20% (Dec, Jan, Apr) · Weekend +LKR 2,500 (Fri, Sat)', 'pricing'],
  [-1, 12, 'nimali.perera@example.com', 'guest', 'booking.created', 'Booked online: Nimali Perera, river-view suite with promo MONSOON10', bookings.find((b) => b.guest.firstName === 'Nimali' && b.status === 'Confirmed').ref],
  [-2, 11, 'manager@monsoonridge.lk', 'staff', 'pricing.promo_created', 'Created promo code HONEYMOON15 (15% off)', 'HONEYMOON15'],
  [-3, 12, 'frontdesk@monsoonridge.lk', 'staff', 'inbox.replied', 'Replied by email to Anna Kowalska: "Vegan meals?"', 'msg'],
  [-3, 10, 'frontdesk@monsoonridge.lk', 'staff', 'booking.staff_created', 'Walk-in booking for Tharindu Fernando, checked in', bookings.find((b) => b.guest.firstName === 'Tharindu').ref],
  [-4, 15, 'manager@monsoonridge.lk', 'staff', 'room.updated', 'Updated River View Suite: price LKR 30,000 → LKR 32,000', 'river-view-suite'],
  [-5, 9, 'manager@monsoonridge.lk', 'staff', 'staff.added', 'Gave Front desk access to frontdesk@monsoonridge.lk', 'frontdesk@monsoonridge.lk'],
]
for (const [d, h, by, role, action, summary, id] of acts) {
  await db.collection('activity').add({ at: at(d, h), by, role, action, category: action.split('.')[0], target: { type: action.split('.')[0], id, label: id }, summary })
}

/* sign-in accounts (emulator) */
for (const [email, uid, name, claims] of [
  ['manager@monsoonridge.lk', 'demo-manager', 'Dilini Wickramasinghe', { admin: true, role: 'admin' }],
  ['nimali.perera@example.com', GUEST_UID, 'Nimali Perera', null],
]) {
  await auth.createUser({ uid, email, password: 'Demo-pass-2026', displayName: name, emailVerified: true }).catch(() => {})
  if (claims) await auth.setCustomUserClaims(uid, claims)
}
console.log('Sign in with manager@monsoonridge.lk (staff) or nimali.perera@example.com (guest), password Demo-pass-2026')
console.log(`demo data: ${Object.keys(rooms).length} rooms, ${bookings.length} bookings, ${Object.keys(inv).length} inventory nights, reviews, ${msgs.length} messages`)
process.exit(0)
