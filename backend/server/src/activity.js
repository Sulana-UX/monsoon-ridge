/*
 * Activity log: who did what, and when.
 *   activity/{id} { at, by, role, action, category, target: { type, id, label }, summary, details? }
 * Written only by the server, after the action succeeded. There is no API to edit or delete
 * entries, and Firestore rules make it read-only for staff, so the log can't be tidied up afterwards.
 * Logging never fails the action itself.
 */
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firebase.js'

export const CATEGORIES = { booking: 'Bookings', room: 'Rooms', pricing: 'Prices & promos', block: 'Blocked dates', staff: 'Staff', inbox: 'Inbox' }

/** actor: { email, admin } from the signed-in user, or { email, guest: true } */
export async function logActivity(actor, { action, target, summary, details }) {
  try {
    await db.collection('activity').add({
      at: FieldValue.serverTimestamp(),
      by: actor?.email || 'unknown',
      role: actor?.admin ? 'staff' : 'guest',
      action,
      category: action.split('.')[0],
      target: target || null,
      summary: String(summary).slice(0, 300),
      ...(details && { details: String(details).slice(0, 1000) }),
    })
  } catch (e) {
    console.error('activity log failed', action, e.message)
  }
}

export const lkr = (n) => 'LKR ' + Math.round(n || 0).toLocaleString('en-US')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const NIGHTS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "Peak season +20% (Dec, Apr) · Weekend +LKR 2,000 (Fri, Sat)" */
export function describeRules(r) {
  if (!r) return 'none'
  const seasons = (r.seasons || []).map((s) => `${s.name} ${s.percent > 0 ? '+' : ''}${s.percent}% (${s.months.map((m) => MONTHS[m - 1]).join(', ')})`)
  const w = r.weekend?.amount > 0 ? [`Weekend +${lkr(r.weekend.amount)} (${r.weekend.days.map((d) => NIGHTS[d]).join(', ')})`] : ['No weekend extra']
  return [...(seasons.length ? seasons : ['No seasons']), ...w].join(' · ')
}

/** What changed on a room: ["price LKR 20,000 → LKR 22,000", "rooms 6 → 5"] */
export function roomChanges(before, after) {
  const fields = [
    ['name', 'name', (v) => v],
    ['price', 'price', lkr],
    ['units', 'rooms', (v) => v],
    ['guests', 'max guests', (v) => v],
    ['type', 'category', (v) => v],
    ['active', 'shown on website', (v) => (v === false ? 'no' : 'yes')],
  ]
  const out = []
  for (const [k, label, fmt] of fields) {
    if (before?.[k] !== undefined && after?.[k] !== undefined && before[k] !== after[k]) out.push(`${label} ${fmt(before[k])} → ${fmt(after[k])}`)
  }
  return out
}
