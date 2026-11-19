/*
 * Account emails (verify email, reset password) sent through Brevo.
 * Firebase's own emails come from noreply@<project>.firebaseapp.com and often land in spam
 * or never reach Gmail / university inboxes. The server asks Firebase for the same secure
 * action link and sends it from the hotel's verified sender instead.
 * If Brevo isn't configured, { status: 'skipped' } tells the website to fall back to Firebase.
 */
import { auth } from './firebase.js'
import { ApiError } from './errors.js'
import { mailEnabled, sendMail } from './mailer.js'
import { verifyEmail, passwordResetEmail } from './emailTemplates.js'

const site = () => (process.env.SITE_URL || 'https://monsoon-ridge.web.app').replace(/\/$/, '')
/** Where "Continue" goes after the link is opened: the site the request came from, if it's ours. */
export const continueUrl = (origin, allowed) => `${origin && allowed.includes(origin) ? origin : site()}/login`

const linkError = (e) => {
  if (/TOO_MANY|too-many/i.test(e?.code + e?.message)) return new ApiError('resource-exhausted', 'Too many emails were requested. Please wait a few minutes and try again.')
  console.error('auth link failed', e?.code, e?.message)
  return new ApiError('failed-precondition', 'Could not create the link. Please try again.')
}

/** Signed-in (not yet verified) user asks for the verification email. */
export async function sendVerification(user, origin, allowed) {
  if (!mailEnabled()) return { status: 'skipped' }
  const record = await auth.getUser(user.uid)
  if (record.emailVerified) return { status: 'already' }
  if (!record.email) throw new ApiError('failed-precondition', 'This account has no email address.')
  let link
  try {
    link = await auth.generateEmailVerificationLink(record.email, { url: continueUrl(origin, allowed) })
  } catch (e) {
    throw linkError(e)
  }
  const r = await sendMail({ to: [{ email: record.email, name: record.displayName || undefined }], ...verifyEmail({ name: record.displayName?.split(' ')[0], link }) })
  if (r.status !== 'sent') throw new ApiError('failed-precondition', 'Could not send the email right now.')
  return { status: 'sent' }
}

/**
 * Public: password reset. Always answers the same way whether or not the email has an
 * account, so it can't be used to find out who is registered.
 */
export async function sendPasswordReset(body, origin, allowed) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ApiError('invalid-argument', 'Please enter a valid email address.')
  if (!mailEnabled()) return { status: 'skipped' }
  // No account (or Google-only account without a password)? Same answer as success, nothing sent.
  const user = await auth.getUserByEmail(email).catch(() => null)
  if (!user || !user.providerData.some((p) => p.providerId === 'password')) return { status: 'sent' }
  let link
  try {
    link = await auth.generatePasswordResetLink(email, { url: continueUrl(origin, allowed) })
  } catch (e) {
    throw linkError(e)
  }
  const r = await sendMail({ to: [{ email }], ...passwordResetEmail({ link }) })
  if (r.status !== 'sent') throw new ApiError('failed-precondition', 'Could not send the email right now.')
  return { status: 'sent' }
}
