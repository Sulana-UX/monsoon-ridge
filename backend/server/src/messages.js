/*
 * Contact form → messages/{id} → dashboard Inbox (+ email alert to staff).
 * Public endpoint (guests don't need an account), so:
 *   - strict per-IP rate limit (in app.js)
 *   - a hidden "website" field: real people leave it empty, bots fill it in
 *   - length limits on every field; unknown fields are dropped
 */
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firebase.js'
import { ApiError } from './errors.js'
import { sendMail, staffRecipients } from './mailer.js'
import { staffNewMessage } from './emailTemplates.js'
import { logActivity } from './activity.js'

const bad = (msg) => {
  throw new ApiError('invalid-argument', msg)
}
const STATUSES = ['new', 'read', 'replied', 'archived']

const text = (v, label, { min = 0, max }) => {
  if (v != null && typeof v !== 'string') bad(`${label} is invalid.`)
  const s = (v || '').trim()
  if (s.length < min) bad(min === 1 ? `Please enter your ${label.toLowerCase()}.` : `${label} is too short.`)
  if (s.length > max) bad(`${label} is too long (max ${max} characters).`)
  return s
}

export function parseContact(data) {
  if (!data || typeof data !== 'object') bad('Missing message.')
  const m = {
    name: text(data.name, 'Name', { min: 1, max: 80 }),
    email: text(data.email, 'Email', { min: 3, max: 254 }).toLowerCase(),
    phone: text(data.phone, 'Phone', { max: 25 }),
    subject: text(data.subject, 'Subject', { max: 120 }),
    message: text(data.message, 'Message', { min: 10, max: 3000 }),
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) bad('Please enter a valid email address.')
  if (m.phone && !/^\+?[\d\s()-]{7,25}$/.test(m.phone)) bad('Phone number is invalid.')
  return { ...m, bot: typeof data.website === 'string' && data.website.trim() !== '' }
}

export async function createMessage(body) {
  const { bot, ...m } = parseContact(body)
  if (bot) return { ok: true } // looks like success to the bot; nothing is stored

  const ref = await db.collection('messages').add({ ...m, status: 'new', createdAt: FieldValue.serverTimestamp() })
  // staff alert in the background; the guest gets their answer straight away
  sendMail({ to: staffRecipients(), replyTo: { email: m.email, name: m.name }, ...staffNewMessage(m) })
    .then((r) => r.status === 'failed' && console.error('message alert failed', ref.id, r.error))
    .catch(() => {})
  return { ok: true }
}

const msgDoc = (id) => {
  if (typeof id !== 'string' || !/^[A-Za-z0-9]{1,40}$/.test(id)) bad('Unknown message.')
  return db.collection('messages').doc(id)
}

export async function setMessageStatus(staff, id, status) {
  if (!STATUSES.includes(status)) bad('Unknown status.')
  try {
    await msgDoc(id).update({ status, statusBy: staff.email ?? 'staff', statusAt: FieldValue.serverTimestamp() })
  } catch (e) {
    if (e.code === 5) throw new ApiError('not-found', 'Message not found.')
    throw e
  }
  return { ok: true }
}

export async function deleteMessage(staff, id) {
  const ref = msgDoc(id)
  const snap = await ref.get()
  await ref.delete()
  if (snap.exists) await logActivity(staff, { action: 'inbox.deleted', target: { type: 'message', id, label: snap.get('name') },
    summary: `Deleted a message from ${snap.get('name')} <${snap.get('email')}>: "${snap.get('subject') || 'No subject'}"` })
  return { ok: true }
}
