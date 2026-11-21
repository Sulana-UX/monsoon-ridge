/*
 * Pricing rules (pure functions, no database). Used for every quote and booking,
 * so the guest sees exactly what the server will charge.
 *
 *   night rate = base price × (1 + season %)  + weekend extra (if that night is a weekend night)
 *   room total = sum of night rates
 *   discount   = promo % of the room total
 *   service 10% and tax 8% are charged on (room total − discount)
 *
 * Rules live in Firestore `settings/pricing` and are edited from the dashboard:
 *   { seasons: [{ name, months: [12, 4], percent: 20 }], weekend: { days: [5, 6], amount: 2000 } }
 * Weekend days are the NIGHT's weekday (5 = Friday night, 6 = Saturday night).
 */
import { ApiError } from './errors.js'

export const SERVICE_RATE = 0.1
export const TAX_RATE = 0.08
export const DEFAULT_RULES = { seasons: [], weekend: { days: [5, 6], amount: 0 } }

const bad = (msg) => {
  throw new ApiError('invalid-argument', msg)
}

const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay()
const month = (iso) => Number(iso.slice(5, 7))

/** Price of each night: [{ date, rate, season, weekend }] */
export function nightlyRates(base, dates, rules = DEFAULT_RULES) {
  const seasons = rules.seasons || []
  const wk = rules.weekend || DEFAULT_RULES.weekend
  return dates.map((date) => {
    const s = seasons.find((x) => x.months.includes(month(date)))
    const extra = wk.amount > 0 && wk.days.includes(weekday(date)) ? wk.amount : 0
    const rate = Math.round(base * (1 + (s?.percent || 0) / 100)) + extra
    return { date, rate, ...(s && { season: s.name }), ...(extra && { weekend: extra }) }
  })
}

/**
 * Full price for a stay. promo = { code, percent } or null.
 * kept = Map(date → night) of nights already sold at an earlier price (changing a booking):
 * those nights keep their old rate, only new nights use today's rules.
 */
export function quoteStay(base, dates, rules, promo = null, kept = null) {
  const nightly = nightlyRates(base, dates, rules).map((n) => kept?.get(n.date) ?? n)
  const rooms = nightly.reduce((sum, n) => sum + n.rate, 0)
  const discount = promo ? Math.round((rooms * promo.percent) / 100) : 0
  const subtotal = rooms - discount
  const service = Math.round(subtotal * SERVICE_RATE)
  const tax = Math.round(subtotal * TAX_RATE)
  return {
    rate: base, // base price per night (before seasons / weekends)
    nights: dates.length,
    nightly,
    rooms,
    discount,
    promo: promo ? { code: promo.code, percent: promo.percent } : null,
    subtotal,
    service,
    tax,
    total: subtotal + service + tax,
  }
}

/* ---------- validation of the rules staff save ---------- */

const int = (v, label, min, max) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (!Number.isInteger(n) || n < min || n > max) bad(`${label} must be a whole number from ${min} to ${max}.`)
  return n
}

export function parsePricingRules(data) {
  if (!data || typeof data !== 'object') bad('Missing pricing rules.')
  const seasonsIn = Array.isArray(data.seasons) ? data.seasons : []
  if (seasonsIn.length > 12) bad('At most 12 seasons.')
  const taken = new Map()
  const seasons = seasonsIn.map((s, i) => {
    const name = typeof s?.name === 'string' ? s.name.trim() : ''
    if (name.length < 1 || name.length > 40) bad(`Season ${i + 1}: give it a name (up to 40 characters).`)
    if (!Array.isArray(s.months) || s.months.length === 0) bad(`${name}: choose at least one month.`)
    const months = [...new Set(s.months.map((m) => int(m, `${name}: month`, 1, 12)))].sort((a, b) => a - b)
    for (const m of months) {
      if (taken.has(m)) bad(`${name} and ${taken.get(m)} both include the same month. Each month can be in one season only.`)
      taken.set(m, name)
    }
    const percent = int(s.percent, `${name}: change`, -50, 200)
    if (percent === 0) bad(`${name}: the change can't be 0%.`)
    return { name, months, percent }
  })
  const w = data.weekend || {}
  const days = [...new Set((Array.isArray(w.days) ? w.days : []).map((d) => int(d, 'Weekend day', 0, 6)))].sort()
  const amount = int(w.amount ?? 0, 'Weekend extra', 0, 1_000_000)
  if (amount > 0 && days.length === 0) bad('Choose which nights count as the weekend.')
  return { seasons, weekend: { days, amount } }
}

/* ---------- promo codes ---------- */

export const parsePromoCode = (v) => {
  const code = typeof v === 'string' ? v.trim().toUpperCase() : ''
  if (!/^[A-Z0-9]{3,20}$/.test(code)) bad('Promo codes are 3–20 letters or numbers.')
  return code
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** New or edited promo code. `partial` = only the fields being changed */
export function parsePromoInput(data, today, { partial = false } = {}) {
  if (!data || typeof data !== 'object') bad('Missing promo details.')
  const out = {}
  if (!partial) out.code = parsePromoCode(data.code)
  if (!partial || data.percent !== undefined) out.percent = int(data.percent, 'Discount', 1, 90)
  if (!partial || data.expires !== undefined) {
    if (typeof data.expires !== 'string' || !ISO.test(data.expires) || Number.isNaN(Date.parse(data.expires))) bad('Choose a valid expiry date.')
    if (data.expires < today) bad('The expiry date is in the past.')
    out.expires = data.expires
  }
  if (!partial || data.maxUses !== undefined) {
    out.maxUses = data.maxUses === null || data.maxUses === '' || data.maxUses === undefined ? null : int(data.maxUses, 'Usage limit', 1, 100_000)
  }
  if (data.active !== undefined) {
    if (typeof data.active !== 'boolean') bad('Active must be true or false.')
    out.active = data.active
  }
  if (partial && Object.keys(out).length === 0) bad('Nothing to change.')
  return out
}

/** Why a promo can't be used today, or '' if it can. */
export function promoProblem(p, today) {
  if (!p || p.active === false) return "This promo code isn't valid."
  if (p.expires < today) return 'This promo code has expired.'
  if (p.maxUses != null && (p.used || 0) >= p.maxUses) return 'This promo code has been fully used.'
  return ''
}
