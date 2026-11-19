/*
 * Staff access and roles.
 *   Owners: ADMIN_EMAILS in the server settings. Always role "admin"; can't be removed or
 *           demoted from the dashboard, so the hotel can never lock itself out.
 *   Staff:  staff/{email} { role: "admin" | "frontdesk" }, managed by admins on the Staff page.
 *
 * Roles
 *   admin      everything (rooms, prices & promos, reports, staff, activity log, front desk)
 *   frontdesk  day-to-day work only: bookings, calendar, check-in/out, walk-ins, blocks, guests, inbox
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
export const ROLES = ['admin', 'frontdesk']
export const ROLE_LABEL = { admin: 'Admin', frontdesk: 'Front desk' }

const bad = (msg) => {
  throw new ApiError('invalid-argument', msg)
}
export const parseStaffEmail = (v) => {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (e.length > 254 || !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(e)) bad('Enter a valid email address.')
  return e
}

const parseRole = (v) => {
  if (!ROLES.includes(v)) bad('Choose a role: Admin or Front desk.')
  return v
}

// Small cache so every staff request doesn't cost a database read
const cache = new Map() // email → { role, until }
const CACHE_MS = 30_000
export const forgetStaffCache = (email) => cache.delete(email)

/** 'admin' | 'frontdesk' | null (not staff). Read from the database, not from the token. */
export async function getStaffRole(emailIn) {
  const email = (emailIn || '').toLowerCase()
  if (!email) return null
  if (owners().includes(email)) return 'admin'
  const hit = cache.get(email)
  if (hit && hit.until > Date.now()) return hit.role
  const snap = await staffDoc(email).get()
  const role = snap.exists ? (ROLES.includes(snap.get('role')) ? snap.get('role') : 'admin') : null
  cache.set(email, { role, until: Date.now() + CACHE_MS })
  return role
}
export const isStaffEmail = async (email) => Boolean(await getStaffRole(email))

/** Sets the token claims the website uses ({ admin, role }); revoke = sign out everywhere now. */
async function setClaim(email, role, { revoke = false } = {}) {
  const user = await auth.getUserByEmail(email).catch(() => null)
  if (!user) return null
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: Boolean(role), role: role || null })
  if (revoke || !role) await auth.revokeRefreshTokens(user.uid)
  return user
}

export async function listStaff() {
  const docs = (await db.collection('staff').get()).docs.map((d) => d.data())
  const rows = [
    ...owners().map((email) => ({ email, owner: true, role: 'admin' })),
    ...docs.filter((d) => !owners().includes(d.email)).map((d) => ({
      email: d.email, owner: false, role: ROLES.includes(d.role) ? d.role : 'admin',
      addedBy: d.addedBy, addedAt: d.addedAt?.toDate?.().toISOString() ?? null,
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
  const role = parseRole(body?.role ?? 'frontdesk')
  if (owners().includes(email)) throw new ApiError('already-exists', `${email} is already an owner.`)
  try {
    await staffDoc(email).create({ email, role, addedBy: actor.email ?? 'staff', addedAt: FieldValue.serverTimestamp() })
  } catch (e) {
    if (e.code === 6) throw new ApiError('already-exists', `${email} is already staff.`)
    throw e
  }
  forgetStaffCache(email)
  const user = await setClaim(email, role)
  return { email, role, hasAccount: Boolean(user) }
}

/** Admin ↔ Front desk. A downgrade signs the person out everywhere, so it applies at once. */
export async function setStaffRole(actor, emailParam, body) {
  const email = parseStaffEmail(emailParam)
  const role = parseRole(body?.role)
  if (owners().includes(email)) throw new ApiError('failed-precondition', `${email} is an owner and is always Admin.`)
  if (email === (actor.email || '').toLowerCase()) throw new ApiError('failed-precondition', "You can't change your own role. Ask another admin.")
  const ref = staffDoc(email)
  const snap = await ref.get()
  if (!snap.exists) throw new ApiError('not-found', `${email} is not staff.`)
  const before = ROLES.includes(snap.get('role')) ? snap.get('role') : 'admin'
  if (before === role) return { email, role, before, changed: false }
  await ref.update({ role, roleBy: actor.email ?? 'staff', roleAt: FieldValue.serverTimestamp() })
  forgetStaffCache(email)
  await setClaim(email, role, { revoke: role === 'frontdesk' })
  return { email, role, before, changed: true }
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
  await setClaim(email, null)
  return { ok: true }
}
