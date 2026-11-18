import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { auth } from './firebase.js'
import { ApiError } from './errors.js'
import { createBooking, createStaffBooking, cancelBooking, syncAdminClaim } from './bookings.js'
import { createBlock, deleteBlock } from './blocks.js'
import { createRoom, updateRoom, deleteRoom } from './rooms.js'
import { signRoomUpload } from './uploads.js'
import { getAvailability } from './availability.js'
import { changeBookingStatus, addNote, deleteNote } from './bookingStatus.js'
import { db } from './firebase.js'
import { createMessage, setMessageStatus, deleteMessage } from './messages.js'
import { resendConfirmation } from './notify.js'
import { addStaff, removeStaff, listStaff, isStaffEmail } from './staff.js'
import { logActivity, roomChanges, lkr } from './activity.js'
import { getQuote, savePricingRules, createPromo, updatePromo, deletePromo } from './pricingStore.js'

const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean)

export const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1) // Render sits behind one proxy; needed for per-IP rate limits

app.use(helmet()) // security headers (no sniffing, no framing, HSTS, …)
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || origins.includes(origin)), // only our own website
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  maxAge: 600,
}))
app.use(express.json({ limit: '10kb' })) // booking payloads are tiny; reject anything big

// Per-IP limits on top of the per-account limits in bookings.js
app.use('/api', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }))
// Promo lookups get their own, tighter limit so codes can't be guessed by brute force
const promoLimit = rateLimit({ windowMs: 10 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, skip: (req) => !req.query.promo })
// Contact form is public: 5 messages per hour per IP
const contactLimit = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { code: 'resource-exhausted', message: 'Too many messages. Please try again later or call us.' } } })
const writeLimit = rateLimit({ windowMs: 10 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false })

/** Requires `Authorization: Bearer <Firebase ID token>` from a verified email. */
async function requireUser(req, _res, next) {
  try {
    const m = /^Bearer (.+)$/.exec(req.get('authorization') || '')
    if (!m) throw new ApiError('unauthenticated', 'Please sign in first.')
    // checkRevoked = true: signed-out / disabled accounts are rejected immediately
    const token = await auth.verifyIdToken(m[1], true).catch(() => {
      throw new ApiError('unauthenticated', 'Your session has expired. Please sign in again.')
    })
    if (!token.email_verified) throw new ApiError('permission-denied', 'Please verify your email address first.')
    req.user = { uid: token.uid, email: token.email, admin: token.admin === true }
    next()
  } catch (e) {
    next(e)
  }
}

/**
 * Staff only. Two checks: the `admin` claim on the token (set by the server, never by the browser)
 * AND current membership (owners in ADMIN_EMAILS or staff/{email}), so someone removed from
 * the Staff page loses access on their very next request.
 */
async function requireAdmin(req, _res, next) {
  try {
    const ok = req.user?.admin === true && (await isStaffEmail(req.user.email))
    next(ok ? undefined : new ApiError('permission-denied', 'Staff access only.'))
  } catch (e) {
    next(e)
  }
}

const handle = (fn) => async (req, res, next) => {
  try {
    res.json(await fn(req))
  } catch (e) {
    next(e)
  }
}

// Health check (Render pings this; also handy to wake the free server up)
app.get('/health', (_req, res) => res.json({ ok: true }))

// Public: free rooms per room type for the chosen dates (no personal data)
app.get('/api/availability', handle((req) => getAvailability(req.query)))

// Public: price of a stay (seasons, weekends, promo code) exactly as a booking would be charged
app.get('/api/quote', promoLimit, handle((req) => getQuote(req.query)))

// Public: contact form → dashboard inbox
app.post('/api/contact', contactLimit, handle((req) => createMessage(req.body)))

app.post('/api/bookings', writeLimit, requireUser, handle((req) => createBooking(req.user, req.body)))
app.post('/api/bookings/:ref/cancel', writeLimit, requireUser, handle((req) => cancelBooking(req.user, req.params.ref)))
app.post('/api/me/sync-admin', requireUser, handle((req) => syncAdminClaim(req.user)))

// Room management (staff)
app.post('/api/admin/rooms', writeLimit, requireUser, requireAdmin, handle(async (req) => {
  const r = await createRoom(db, req.body)
  await logActivity(req.user, { action: 'room.created', target: { type: 'room', id: r.id, label: req.body?.name },
    summary: `Added room ${req.body?.name}: ${lkr(req.body?.price)} per night, ${req.body?.units} room(s)` })
  return r
}))
app.put('/api/admin/rooms/:id', writeLimit, requireUser, requireAdmin, handle(async (req) => {
  const { before, after, ...r } = await updateRoom(db, req.params.id, req.body)
  const changes = roomChanges(before, after)
  await logActivity(req.user, { action: 'room.updated', target: { type: 'room', id: r.id, label: after.name },
    summary: changes.length ? `Changed ${before.name}: ${changes.join('; ')}` : `Edited ${after.name} (description, photos or amenities)` })
  return r
}))
app.delete('/api/admin/rooms/:id', writeLimit, requireUser, requireAdmin, handle(async (req) => {
  const { name, ...r } = await deleteRoom(db, req.params.id)
  await logActivity(req.user, { action: 'room.deleted', target: { type: 'room', id: req.params.id, label: name }, summary: `Deleted room ${name}` })
  return r
}))
// Front desk (staff): walk-in / phone bookings, room blocks, check-in / check-out / no-show, notes
app.post('/api/admin/bookings', writeLimit, requireUser, requireAdmin, handle((req) => createStaffBooking(req.user, req.body)))
app.post('/api/admin/blocks', writeLimit, requireUser, requireAdmin, handle((req) => createBlock(req.user, req.body)))
app.delete('/api/admin/blocks/:id', writeLimit, requireUser, requireAdmin, handle((req) => deleteBlock(req.user, req.params.id)))
app.post('/api/admin/bookings/:ref/status', writeLimit, requireUser, requireAdmin, handle((req) => changeBookingStatus(req.user, req.params.ref, req.body?.action)))
app.post('/api/admin/bookings/:ref/notes', writeLimit, requireUser, requireAdmin, handle((req) => addNote(req.user, req.params.ref, req.body)))
app.delete('/api/admin/bookings/:ref/notes/:id', writeLimit, requireUser, requireAdmin, handle((req) => deleteNote(req.user, req.params.ref, req.params.id)))

// Pricing rules & promo codes (staff)
app.put('/api/admin/pricing', writeLimit, requireUser, requireAdmin, handle((req) => savePricingRules(req.user, req.body)))
app.post('/api/admin/promos', writeLimit, requireUser, requireAdmin, handle((req) => createPromo(req.user, req.body)))
app.put('/api/admin/promos/:code', writeLimit, requireUser, requireAdmin, handle((req) => updatePromo(req.user, req.params.code, req.body)))
app.delete('/api/admin/promos/:code', writeLimit, requireUser, requireAdmin, handle((req) => deletePromo(req.user, req.params.code)))

// Guest communication (staff)
app.post('/api/admin/bookings/:ref/email', writeLimit, requireUser, requireAdmin, handle(async (req) => {
  const r = await resendConfirmation(req.params.ref)
  await logActivity(req.user, { action: 'booking.email_resent', target: { type: 'booking', id: req.params.ref, label: req.params.ref }, summary: 'Resent the confirmation email to the guest' })
  return r
}))
app.put('/api/admin/messages/:id', requireUser, requireAdmin, handle((req) => setMessageStatus(req.user, req.params.id, req.body?.status)))
app.delete('/api/admin/messages/:id', writeLimit, requireUser, requireAdmin, handle((req) => deleteMessage(req.user, req.params.id)))

// Staff management (any staff member; owners in ADMIN_EMAILS can't be removed here)
app.get('/api/admin/staff', requireUser, requireAdmin, handle(() => listStaff()))
app.post('/api/admin/staff', writeLimit, requireUser, requireAdmin, handle(async (req) => {
  const r = await addStaff(req.user, req.body)
  await logActivity(req.user, { action: 'staff.added', target: { type: 'staff', id: r.email, label: r.email },
    summary: `Gave dashboard access to ${r.email}${r.hasAccount ? '' : ' (no account yet: access starts when they sign up and verify)'}` })
  return r
}))
app.delete('/api/admin/staff/:email', writeLimit, requireUser, requireAdmin, handle(async (req) => {
  const r = await removeStaff(req.user, req.params.email)
  await logActivity(req.user, { action: 'staff.removed', target: { type: 'staff', id: req.params.email, label: req.params.email },
    summary: `Removed dashboard access from ${req.params.email.toLowerCase()} (signed out everywhere)` })
  return r
}))

app.post('/api/admin/uploads/sign', requireUser, requireAdmin, handle(() => signRoomUpload()))

app.use((_req, _res, next) => next(new ApiError('not-found', 'Not found.')))

// One error format for everything; never leak stack traces or internals
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') err = new ApiError('invalid-argument', 'Request is too large.')
  else if (err.type === 'entity.parse.failed') err = new ApiError('invalid-argument', 'Request is not valid JSON.')
  else if (!(err instanceof ApiError)) {
    console.error(err)
    err = new ApiError('internal', 'Something went wrong. Please try again.')
  }
  res.status(err.status).json({ error: { code: err.code, message: err.message } })
})
