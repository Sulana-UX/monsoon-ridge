// Gives the admin role to every email in ADMIN_EMAILS (and nothing else).
// Usage (from backend/server): npm run sync-admins
// The account must already exist and have a verified email.
import { auth } from '../src/firebase.js'
import { syncAdminClaim } from '../src/bookings.js'

const emails = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean)
if (!emails.length) {
  console.log('ADMIN_EMAILS is empty in backend/server/.env')
  process.exit(1)
}

for (const email of emails) {
  try {
    const u = await auth.getUserByEmail(email)
    if (!u.emailVerified) {
      console.log(`✗ ${email}: email not verified yet (open the link in the verification email first)`)
      continue
    }
    const r = await syncAdminClaim({ uid: u.uid, email: u.email, admin: u.customClaims?.admin === true })
    console.log(`✓ ${email}: admin${r.changed ? ' (just granted, sign out and in again)' : ' (already)'}`)
  } catch (e) {
    console.log(`✗ ${email}: ${e.code === 'auth/user-not-found' ? 'no account yet, create it on the site first' : e.message}`)
  }
}
process.exit(0)
