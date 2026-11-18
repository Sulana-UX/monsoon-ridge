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

/** POST to our Express API with the signed-in user's Firebase ID token. */
async function call(path, body) {
  const user = auth.currentUser
  if (!user) throw new ApiError('api/unauthenticated', 'Please sign in first.')
  const token = await user.getIdToken()

  let res
  try {
    res = await fetch(API_URL + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
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
