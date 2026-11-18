import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { auth } from './firebase.js'
import { ApiError } from './errors.js'
import { createBooking, cancelBooking, syncAdminClaim } from './bookings.js'
import { createRoom, updateRoom, deleteRoom } from './rooms.js'
import { signRoomUpload } from './uploads.js'
import { getAvailability } from './availability.js'
import { changeBookingStatus, addNote, deleteNote } from './bookingStatus.js'
import { db } from './firebase.js'

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

/** Staff only: the `admin` claim is set by the server (syncAdminClaim), never by the browser. */
function requireAdmin(req, _res, next) {
  next(req.user?.admin === true ? undefined : new ApiError('permission-denied', 'Staff access only.'))
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

app.post('/api/bookings', writeLimit, requireUser, handle((req) => createBooking(req.user, req.body)))
app.post('/api/bookings/:ref/cancel', writeLimit, requireUser, handle((req) => cancelBooking(req.user, req.params.ref)))
app.post('/api/me/sync-admin', requireUser, handle((req) => syncAdminClaim(req.user)))

// Room management (staff)
app.post('/api/admin/rooms', writeLimit, requireUser, requireAdmin, handle((req) => createRoom(db, req.body)))
app.put('/api/admin/rooms/:id', writeLimit, requireUser, requireAdmin, handle((req) => updateRoom(db, req.params.id, req.body)))
app.delete('/api/admin/rooms/:id', writeLimit, requireUser, requireAdmin, handle((req) => deleteRoom(db, req.params.id)))
// Front desk (staff): check-in / check-out / no-show, and internal notes
app.post('/api/admin/bookings/:ref/status', writeLimit, requireUser, requireAdmin, handle((req) => changeBookingStatus(req.user, req.params.ref, req.body?.action)))
app.post('/api/admin/bookings/:ref/notes', writeLimit, requireUser, requireAdmin, handle((req) => addNote(req.user, req.params.ref, req.body)))
app.delete('/api/admin/bookings/:ref/notes/:id', writeLimit, requireUser, requireAdmin, handle((req) => deleteNote(req.params.ref, req.params.id)))

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
