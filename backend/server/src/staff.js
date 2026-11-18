/*
 * Staff access.
 *   Owners: ADMIN_EMAILS in the server settings. Always staff; can't be removed from the
 *           dashboard, so the hotel can never lock itself out.
 *   Staff:  staff/{email} documents, added and removed from the dashboard by any staff member.
 *
 * The `admin` custom claim on the Firebase account is what the website checks; the server
 * sets it here, and also re-checks membership on every staff request (requireAdmin), so a
 * removed person loses access immediately, not when their token expires.
 */
import { FieldValue } from 'firebase-admin/firestore'
import { auth, db } from './firebase.js'
import { ApiError } from './errors.js'

const list = (v) => (v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
export const owners = () => list(process.env.ADMIN_EMAILS)
const staffDoc = (email) => db.collection('staff').doc(email)

const bad = (msg) => {
  throw new ApiError('invalid-argument', msg)
}
export const parseStaffEmail = (v) => {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (e.length > 254 || !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(e)) bad('Enter a valid email address.')
  return e
}

// Small cache so every staff request doesn't cost a database read
const cache = new Map() // email → { staff, until }
const CACHE_MS = 30_000
export const forgetStaffCache = (email) => cache.delete(email)

export async function isStaffEmail(emailIn) {
  const email = (emailIn || '').toLowerCase()
  if (!email) return false
  if (owners().includes(email)) return true
  const hit = cache.get(email)
  if (hit && hit.until > Date.now()) return hit.staff
  const staff = (await staffDoc(email).get()).exists
  cache.set(email, { staff, until: Date.now() + CACHE_MS })
  return staff
}

async function setClaim(email, admin) {
  const user = await auth.getUserByEmail(email).catch(() => null)
  if (!user) return null
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin })
  if (!admin) await auth.revokeRefreshTokens(user.uid) // signs them out everywhere, right now
  return user
}

export async function listStaff() {
  const docs = (await db.collection('staff').get()).docs.map((d) => d.data())
  const rows = [
    ...owners().map((email) => ({ email, owner: true })),
    ...docs.filter((d) => !owners().includes(d.email)).map((d) => ({
      email: d.email, owner: false, addedBy: d.addedBy, addedAt: d.addedAt?.toDate?.().toISOString() ?? null,
    })),
  ]
  // Account status for each (has the person signed up / verified / signed in?)
  const found = new Map()
  for (let i = 0; i < rows.length; i += 100) {
    const { users } = await auth.getUsers(rows.slice(i, i + 100).map((r) => ({ email: r.email })))
    users.forEach((u) => found.set(u.email.toLowerCase(), u))
  }
  return {
    members: rows.map((r) => {
      const u = found.get(r.email)
      return {
        ...r,
        name: u?.displayName || null,
        account: u ? { verified: u.emailVerified, disabled: u.disabled, lastSignIn: u.metadata.lastSignInTime || null } : null,
      }
    }),
  }
}

export async function addStaff(actor, body) {
  const email = parseStaffEmail(body?.email)
  if (owners().includes(email)) throw new ApiError('already-exists', `${email} is already an owner.`)
  try {
    await staffDoc(email).create({ email, addedBy: actor.email ?? 'staff', addedAt: FieldValue.serverTimestamp() })
  } catch (e) {
    if (e.code === 6) throw new ApiError('already-exists', `${email} is already staff.`)
    throw e
  }
  forgetStaffCache(email)
  const user = await setClaim(email, true)
  return { email, hasAccount: Boolean(user) }
}

export async function removeStaff(actor, emailParam) {
  const email = parseStaffEmail(emailParam)
  if (owners().includes(email)) {
    throw new ApiError('failed-precondition', `${email} is an owner (ADMIN_EMAILS in the server settings). Owners can only be removed there.`)
  }
  if (email === (actor.email || '').toLowerCase()) throw new ApiError('failed-precondition', "You can't remove yourself. Ask another staff member.")
  const ref = staffDoc(email)
  if (!(await ref.get()).exists) throw new ApiError('not-found', `${email} is not staff.`)
  await ref.delete()
  forgetStaffCache(email)
  await setClaim(email, false)
  return { ok: true }
}
