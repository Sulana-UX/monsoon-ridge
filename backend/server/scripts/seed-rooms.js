// One-time: copies the starter rooms (frontend/src/data/rooms.js) into Firestore.
// Rooms that already exist are left untouched, so it's safe to run again.
// Usage (from backend/server): npm run seed-rooms
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../src/firebase.js'
import { parseRoomInput } from '../src/rooms.js'
import { rooms as starter } from '../../../frontend/src/data/rooms.js'

// Old types → the hotel's three categories
const CATEGORY = {
  'standard-queen': 'Single',
  'deluxe-garden': 'Double',
  'superior-twin': 'Double',
  'honeymoon-suite': 'Double',
  'river-view-suite': 'Family',
  'family-villa': 'Family',
}

let added = 0
for (const r of starter) {
  const ref = db.collection('rooms').doc(r.id)
  if ((await ref.get()).exists) {
    console.log(`- ${r.id}: already in database, skipped`)
    continue
  }
  const room = parseRoomInput({ ...r, type: CATEGORY[r.id] ?? 'Double', active: true })
  await ref.set({
    ...room, id: r.id, rating: r.rating ?? null, reviews: r.reviews ?? 0,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  })
  console.log(`✓ ${r.id}: added as ${room.type}`)
  added++
}
console.log(`\nDone: ${added} room(s) added.`)
process.exit(0)
