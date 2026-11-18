/*
 * Pricing rules + promo codes in Firestore, and the public price quote.
 *   settings/pricing   { seasons, weekend, updatedAt, updatedBy }
 *   promos/{CODE}      { code, percent, expires, maxUses, used, active, createdBy, createdAt }
 * Neither is readable by guests (see firestore.rules): guests only ever see a quote.
 */
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firebase.js'
import { ApiError } from './errors.js'
import { DEFAULT_RULES, parsePricingRules, parsePromoCode, parsePromoInput, promoProblem, quoteStay } from './pricing.js'
import { hotelToday, nightsOf, parseStay } from './validate.js'
import { describeRules, logActivity } from './activity.js'

export const rulesRef = () => db.collection('settings').doc('pricing')
export const promoRef = (code) => db.collection('promos').doc(code)

export const rulesFrom = (snap) => {
  const d = snap.exists ? snap.data() : {}
  return { seasons: d.seasons || [], weekend: d.weekend || DEFAULT_RULES.weekend }
}

/** Public: what a stay costs, with an optional promo code. Never reveals anything about other codes. */
export async function getQuote(query) {
  const stay = parseStay(query)
  const [roomSnap, rulesSnap] = await Promise.all([db.collection('rooms').doc(stay.roomId).get(), rulesRef().get()])
  const room = roomSnap.exists ? roomSnap.data() : null
  if (!room || room.active === false) throw new ApiError('not-found', 'This room is not available.')

  let promo = null
  let promoError = ''
  if (query.promo) {
    try {
      const code = parsePromoCode(String(query.promo))
      const p = await promoRef(code).get()
      promoError = promoProblem(p.exists ? p.data() : null, hotelToday())
      if (!promoError) promo = { code, percent: p.get('percent') }
    } catch (e) {
      promoError = e instanceof ApiError ? e.message : "This promo code isn't valid."
    }
  }
  return { quote: quoteStay(room.price, nightsOf(stay.checkIn, stay.nights), rulesFrom(rulesSnap), promo), promoError }
}

export async function savePricingRules(staff, body) {
  const rules = parsePricingRules(body)
  const beforeSnap = await rulesRef().get()
  await rulesRef().set({ ...rules, updatedAt: FieldValue.serverTimestamp(), updatedBy: staff.email ?? 'staff' })
  await logActivity(staff, { action: 'pricing.updated', target: { type: 'pricing', id: 'pricing', label: 'Seasons & weekend' },
    summary: `Changed season / weekend prices: ${describeRules(rules)}`, details: `Before: ${beforeSnap.exists ? describeRules(rulesFrom(beforeSnap)) : 'none'}` })
  return { ok: true, rules }
}

export async function createPromo(staff, body) {
  const p = parsePromoInput(body, hotelToday())
  try {
    await promoRef(p.code).create({
      ...p, used: 0, active: p.active ?? true, createdBy: staff.email ?? 'staff', createdAt: FieldValue.serverTimestamp(),
    })
  } catch (e) {
    if (e.code === 6) throw new ApiError('already-exists', `${p.code} already exists. Choose another code.`)
    throw e
  }
  await logActivity(staff, { action: 'promo.created', target: { type: 'promo', id: p.code, label: p.code },
    summary: `Created promo ${p.code}: ${p.percent}% off until ${p.expires}${p.maxUses ? `, max ${p.maxUses} uses` : ', no use limit'}` })
  return { code: p.code }
}

export async function updatePromo(staff, codeParam, body) {
  const code = parsePromoCode(codeParam)
  const changes = parsePromoInput(body, hotelToday(), { partial: true })
  try {
    await promoRef(code).update(changes)
  } catch (e) {
    if (e.code === 5) throw new ApiError('not-found', 'Promo code not found.')
    throw e
  }
  const onlyActive = Object.keys(changes).length === 1 && 'active' in changes
  const summary = onlyActive
    ? `${changes.active ? 'Resumed' : 'Paused'} promo ${code}`
    : `Changed promo ${code}: ${Object.entries(changes).map(([k, v]) => `${k} → ${v ?? 'no limit'}`).join(', ')}`
  await logActivity(staff, { action: 'promo.updated', target: { type: 'promo', id: code, label: code }, summary })
  return { ok: true }
}

export async function deletePromo(staff, codeParam) {
  const code = parsePromoCode(codeParam)
  const snap = await promoRef(code).get()
  await promoRef(code).delete() // bookings keep their own copy of the discount
  if (snap.exists) await logActivity(staff, { action: 'promo.deleted', target: { type: 'promo', id: code, label: code }, summary: `Deleted promo ${code} (${snap.get('percent')}% off, used ${snap.get('used') || 0} times)` })
  return { ok: true }
}
