import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

const env = import.meta.env

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
export const db = getFirestore(app)

if (env.DEV && env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

/* ---------- Backend API (backend/server) ---------- */

const API_URL = (env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '')

class ApiError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

/** Calls our Express API with the signed-in user's Firebase ID token. */
async function call(path, body, method = 'POST') {
  const user = auth.currentUser
  if (!user) throw new ApiError('api/unauthenticated', 'Please sign in first.')
  const token = await user.getIdToken()

  let res
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: method === 'DELETE' || method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    })
  } catch {
    throw new ApiError('api/unavailable', 'Could not reach the booking server. Please try again in a moment.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(`api/${data.error?.code || 'internal'}`, data.error?.message || 'Something went wrong. Please try again.')
  }
  return { data }
}

export const api = {
  createBooking: (booking) => call('/api/bookings', booking),
  cancelBooking: ({ ref }) => call(`/api/bookings/${encodeURIComponent(ref)}/cancel`),
  syncAdminClaim: () => call('/api/me/sync-admin'),
  // staff only (the server checks the admin role)
  createRoom: (room) => call('/api/admin/rooms', room),
  updateRoom: (id, room) => call(`/api/admin/rooms/${encodeURIComponent(id)}`, room, 'PUT'),
  deleteRoom: (id) => call(`/api/admin/rooms/${encodeURIComponent(id)}`, null, 'DELETE'),
  signUpload: () => call('/api/admin/uploads/sign'),
  // front desk (staff)
  createStaffBooking: (booking) => call('/api/admin/bookings', booking),
  createBlock: (block) => call('/api/admin/blocks', block),
  deleteBlock: (id) => call(`/api/admin/blocks/${encodeURIComponent(id)}`, null, 'DELETE'),
  setBookingStatus: (ref, action, extra = {}) => call(`/api/admin/bookings/${encodeURIComponent(ref)}/status`, { action, ...extra }),
  // room numbers & housekeeping
  setRoomNumbers: (roomId, numbers) => call(`/api/admin/rooms/${encodeURIComponent(roomId)}/numbers`, { numbers }, 'PUT'),
  assignRoom: (ref, unit) => call(`/api/admin/bookings/${encodeURIComponent(ref)}/room`, { unit }),
  setHousekeeping: (number, changes) => call(`/api/admin/units/${encodeURIComponent(number)}`, changes, 'PUT'),
  addNote: (ref, text) => call(`/api/admin/bookings/${encodeURIComponent(ref)}/notes`, { text }),
  deleteNote: (ref, id) => call(`/api/admin/bookings/${encodeURIComponent(ref)}/notes/${encodeURIComponent(id)}`, null, 'DELETE'),
  // pricing rules & promo codes (staff)
  savePricing: (rules) => call('/api/admin/pricing', rules, 'PUT'),
  createPromo: (promo) => call('/api/admin/promos', promo),
  updatePromo: (code, changes) => call(`/api/admin/promos/${encodeURIComponent(code)}`, changes, 'PUT'),
  deletePromo: (code) => call(`/api/admin/promos/${encodeURIComponent(code)}`, null, 'DELETE'),
  // staff management
  listStaff: () => call('/api/admin/staff', null, 'GET'),
  addStaff: (email, role) => call('/api/admin/staff', { email, role }),
  setStaffRole: (email, role) => call(`/api/admin/staff/${encodeURIComponent(email)}`, { role }, 'PUT'),
  removeStaff: (email) => call(`/api/admin/staff/${encodeURIComponent(email)}`, null, 'DELETE'),
  // guest communication (staff)
  resendConfirmation: (ref) => call(`/api/admin/bookings/${encodeURIComponent(ref)}/email`),
  setMessageStatus: (id, status) => call(`/api/admin/messages/${encodeURIComponent(id)}`, { status }, 'PUT'),
  deleteMessage: (id) => call(`/api/admin/messages/${encodeURIComponent(id)}`, null, 'DELETE'),
  // Account emails through the hotel's own sender (Brevo). { status: 'sent' | 'already' | 'skipped' }
  sendVerification: async () => (await call('/api/auth/send-verification')).data,
  passwordReset: async (email) => {
    const res = await fetch(`${API_URL}/api/auth/password-reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(`api/${data.error?.code || 'internal'}`, data.error?.message || 'Something went wrong. Please try again.')
    return data
  },
  // Public: contact form (no account needed)
  sendContact: async (msg) => {
    let res
    try {
      res = await fetch(`${API_URL}/api/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg) })
    } catch {
      throw new ApiError('api/unavailable', 'Could not reach the server. Please try again in a moment, or call us.')
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(`api/${data.error?.code || 'internal'}`, data.error?.message || 'Something went wrong. Please try again.')
    return data
  },
  // Public: exact price of a stay (seasons, weekends, promo) => { quote, promoError }
  quote: async ({ roomId, checkIn, checkOut, promo }) => {
    const q = new URLSearchParams({ roomId, checkIn, checkOut, ...(promo && { promo }) })
    const res = await fetch(`${API_URL}/api/quote?${q}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(`api/${data.error?.code || 'internal'}`, data.error?.message || 'Could not get a price.')
    return data
  },
  // Public: rooms free for the whole stay, per room id
  availability: async (checkIn, checkOut) => {
    const res = await fetch(`${API_URL}/api/availability?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}`)
    if (!res.ok) throw new Error('availability')
    return (await res.json()).available
  },
  // The free server sleeps when idle; ping it early so it's awake by the time a guest books
  wake: () => fetch(API_URL + '/health').catch(() => {}),
}

/** Turns error codes into messages a guest can act on. */
export function friendlyError(err) {
  const code = err?.code || ''
  const map = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled. Please contact the hotel.',
    'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
    'auth/weak-password': 'Please choose a stronger password.',
    'auth/password-does-not-meet-requirements': 'Password must be at least 8 characters with letters and numbers.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
    'auth/network-request-failed': 'Network problem. Check your connection and try again.',
    'auth/popup-blocked': 'The sign-in popup was blocked. Please allow popups for this site.',
    'auth/account-exists-with-different-credential': 'This email is already registered with a password. Sign in with email instead.',
  }
  if (map[code]) return map[code]
  // Messages from our own API are written for guests already
  if (code.startsWith('api/') && err.message) return err.message
  return 'Something went wrong. Please try again.'
}
