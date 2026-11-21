import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

/*
 * Service-account credentials (SECRET: never commit, never send to the browser).
 *  - On Render: env var FIREBASE_SERVICE_ACCOUNT = the whole JSON file contents
 *  - Locally:   put the file at backend/server/service-account.json (git-ignored)
 */
function loadCredentials() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS || new URL('../service-account.json', import.meta.url)
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new Error(
      'Firebase credentials missing. Set FIREBASE_SERVICE_ACCOUNT, or save the key as backend/server/service-account.json (see README).',
    )
  }
}

// Local emulators (npm run emulators) need no key: the Admin SDK talks to them directly.
const emulated = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST)
const app = emulated && !process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'monsoon-ridge' })
  : initializeApp({ credential: cert(loadCredentials()) })
export const auth = getAuth(app)
export const db = getFirestore(app)
