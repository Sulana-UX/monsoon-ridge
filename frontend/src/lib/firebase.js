import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'

const env = import.meta.env

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})

// App Check proves requests come from this site, not a script (optional until a key is set)
if (env.VITE_RECAPTCHA_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
}

export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, 'asia-south1')

if (env.DEV && env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}

export const api = {
  createBooking: httpsCallable(functions, 'createBooking'),
  cancelBooking: httpsCallable(functions, 'cancelBooking'),
  syncAdminClaim: httpsCallable(functions, 'syncAdminClaim'),
}

/** Turns Firebase error codes into messages a guest can act on. */
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
    'functions/unavailable': 'The booking service is unavailable right now. Please try again.',
    'functions/internal': 'Something went wrong. Please try again.',
  }
  if (map[code]) return map[code]
  // Messages from our own functions are written for guests already
  if (code.startsWith('functions/') && err.message) return err.message
  return 'Something went wrong. Please try again.'
}
