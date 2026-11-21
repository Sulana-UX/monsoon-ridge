/*
 * Guest reviews: pure rules (no database), tested in test/validate.test.js.
 * Only guests who really stayed can review: the booking must be checked out,
 * one review per booking, within REVIEW_DAYS of leaving.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { ApiError } from './errors.js'

export const REVIEW_DAYS = 120
const bad = (msg) => {
  throw new ApiError('invalid-argument', msg)
}

export function parseReview(data) {
  if (!data || typeof data !== 'object') bad('Missing review.')
  const rating = Number(data.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) bad('Choose a star rating from 1 to 5.')
  const str = (v, label) => {
    if (v != null && typeof v !== 'string') bad(`${label} is invalid.`)
    return (v || '').trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n')
  }
  const title = str(data.title, 'Title')
  const text = str(data.text, 'Review')
  if (title.length > 80) bad('Title is too long (max 80 characters).')
  if (text.length < 10) bad('Please write a few words about your stay (at least 10 characters).')
  if (text.length > 2000) bad('Review is too long (max 2000 characters).')
  return { rating, title, text }
}

/** Shown publicly: first name + last initial ("Kasun P."). Never the email. */
export function publicName(guest) {
  const first = (guest?.firstName || '').trim()
  const last = (guest?.lastName || '').trim()
  if (!first && !last) return 'Guest'
  return [first || last, first && last ? `${last[0].toUpperCase()}.` : ''].filter(Boolean).join(' ')
}

const toUTC = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

/** null = this booking can be reviewed today; otherwise the reason it can't. */
export function reviewProblem(b, today) {
  if (b.review) return 'You have already reviewed this stay. Thank you!'
  if (b.status !== 'CheckedOut') return 'You can review your stay after you check out.'
  const left = b.checkOutActual || b.checkOut
  if ((toUTC(today) - toUTC(left)) / 86_400_000 > REVIEW_DAYS) return `Reviews can be written up to ${REVIEW_DAYS} days after your stay.`
  return null
}

/** New room totals after adding (+1) or removing (-1) a published rating. */
export function applyRating(room, rating, sign) {
  const reviewCount = Math.max(0, (room?.reviewCount || 0) + sign)
  const reviewSum = Math.max(0, (room?.reviewSum || 0) + sign * rating)
  return { reviewCount, reviewSum, ratingAvg: reviewCount ? Math.round((reviewSum / reviewCount) * 10) / 10 : null }
}

/* Review link token: random, only its hash is stored on the booking. */
export const newToken = () => randomBytes(24).toString('base64url')
export const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex')
export function tokenMatches(token, hash) {
  if (typeof token !== 'string' || !token || typeof hash !== 'string' || hash.length !== 64) return false
  return timingSafeEqual(Buffer.from(hashToken(token), 'hex'), Buffer.from(hash, 'hex'))
}

export function parseReply(data) {
  const t = typeof data?.text === 'string' ? data.text.trim() : null
  if (t == null) bad('Reply is invalid.')
  if (t.length > 1000) bad('Reply is too long (max 1000 characters).')
  return t
}
