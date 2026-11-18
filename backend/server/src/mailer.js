/*
 * Sends email through Brevo's HTTP API (free plan: 300 emails/day).
 * HTTP instead of SMTP because free hosts such as Render block SMTP ports.
 *
 * Env:
 *   BREVO_API_KEY    Brevo → SMTP & API → API keys (SECRET)
 *   MAIL_FROM        a sender address verified in Brevo (Senders, domains & IPs)
 *   MAIL_FROM_NAME   shown as the sender name (default "Monsoon Ridge")
 *
 * If these aren't set, nothing is sent and callers get { status: 'skipped' }:
 * bookings and messages still work, they just don't send email.
 * sendMail never throws; an email problem must never break a booking.
 */

export const mailEnabled = () => Boolean(process.env.BREVO_API_KEY && process.env.MAIL_FROM)

/** to: [{ email, name? }] → { status: 'sent' | 'failed' | 'skipped', id?, error? } */
export async function sendMail({ to, subject, html, text, replyTo }) {
  if (!mailEnabled()) return { status: 'skipped', error: 'Email is not set up on the server.' }
  const recipients = (to || []).filter((r) => r?.email)
  if (recipients.length === 0) return { status: 'skipped', error: 'No email address.' }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: process.env.MAIL_FROM, name: process.env.MAIL_FROM_NAME || 'Monsoon Ridge' },
        to: recipients,
        subject,
        htmlContent: html,
        textContent: text,
        ...(replyTo?.email && { replyTo }),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('email failed', res.status, data?.code, data?.message)
      return { status: 'failed', error: data?.message || `Email service error ${res.status}` }
    }
    return { status: 'sent', id: data.messageId || null }
  } catch (e) {
    console.error('email failed', e.name, e.message)
    return { status: 'failed', error: e.name === 'TimeoutError' ? 'Email service timed out.' : 'Could not reach the email service.' }
  }
}

const list = (v) => (v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

/** Who gets "new booking" / "new message" alerts: STAFF_ALERT_EMAILS, else the admins. */
export const staffRecipients = () =>
  (list(process.env.STAFF_ALERT_EMAILS).length ? list(process.env.STAFF_ALERT_EMAILS) : list(process.env.ADMIN_EMAILS)).map((email) => ({ email }))
