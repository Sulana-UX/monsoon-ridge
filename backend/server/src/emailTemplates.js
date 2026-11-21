/*
 * Email content. Pure functions: booking/message in → { subject, html, text } out.
 * Everything a guest typed is HTML-escaped. Inline styles only (email clients ignore <style>).
 */

export const HOTEL = {
  name: 'Monsoon Ridge Jungle Resort & Spa',
  short: 'Monsoon Ridge',
  address: '18 Cliffside Road, Ella, Sri Lanka',
  phone: '+94 11 234 5678',
  checkInTime: '2:00 pm',
  checkOutTime: '11:00 am',
}
const site = () => (process.env.SITE_URL || 'https://monsoon-ridge.web.app').replace(/\/$/, '')

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const lkr = (n) => 'LKR ' + Math.round(n || 0).toLocaleString('en-US')
const day = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const guestName = (b) => [b.guest?.firstName, b.guest?.lastName].filter(Boolean).join(' ') || 'Guest'

/* ---------- layout ---------- */

const C = { ink: '#10292d', muted: '#5f6f6f', gold: '#b8862f', line: '#ece5d8', cream: '#f6f1e7' }

function layout({ preheader, title, body }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.cream};font-family:Arial,Helvetica,sans-serif;color:${C.ink}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:${C.ink};padding:22px 28px;color:#ffffff">
  <div style="font-family:Georgia,serif;font-size:20px;font-weight:bold">${HOTEL.short}</div>
  <div style="font-size:11px;letter-spacing:2px;color:${C.gold};text-transform:uppercase;margin-top:2px">Jungle Resort &amp; Spa</div>
</td></tr>
<tr><td style="padding:28px">${body}</td></tr>
<tr><td style="padding:18px 28px;background:#faf7f1;font-size:12px;color:${C.muted};line-height:1.6">
  ${esc(HOTEL.name)} · ${esc(HOTEL.address)}<br>Front desk ${esc(HOTEL.phone)} (24 hours)
</td></tr>
</table></td></tr></table></body></html>`
}

const h1 = (t) => `<h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 8px;color:${C.ink}">${t}</h1>`
const p = (t) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.ink}">${t}</p>`
const rows = (pairs) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;font-size:14px">${pairs
    .map(([k, v, strong]) => `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.line};color:${C.muted}">${k}</td><td align="right" style="padding:8px 0;border-bottom:1px solid ${C.line};${strong ? 'font-weight:bold;font-size:16px;' : ''}">${v}</td></tr>`)
    .join('')}</table>`
const button = (href, label) =>
  `<a href="${esc(href)}" style="display:inline-block;background:${C.gold};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;font-size:14px">${label}</a>`
const refBox = (ref) =>
  `<div style="background:${C.cream};border:1px dashed ${C.gold};border-radius:10px;padding:12px 16px;margin:16px 0;font-size:13px;color:${C.muted}">Booking reference<br><span style="font-family:Consolas,monospace;font-size:20px;font-weight:bold;color:${C.ink};letter-spacing:1px">${esc(ref)}</span></div>`

function stayRows(b) {
  const pr = b.price || {}
  const out = [
    ['Room', esc(b.roomName)],
    ['Check-in', `${esc(day(b.checkIn))}, from ${HOTEL.checkInTime}`],
    ['Check-out', `${esc(day(b.checkOut))}, by ${HOTEL.checkOutTime}`],
    ['Guests', `${b.guests} · ${b.nights} night${b.nights === 1 ? '' : 's'}`],
  ]
  if (pr.discount > 0) out.push([`Promo ${esc(pr.promo?.code || '')}`, `− ${lkr(pr.discount)}`])
  out.push(['Service charge &amp; tax', lkr((pr.service || 0) + (pr.tax || 0))])
  out.push(['Total', lkr(b.total), true])
  out.push(['Payment', b.payment === 'card' ? 'Card' : 'Pay at the hotel'])
  return out
}

/* ---------- templates ---------- */

export function bookingConfirmation(b) {
  const name = esc(b.guest?.firstName || 'there')
  const link = `${site()}/my-bookings`
  const subject = `Booking confirmed: ${b.roomName}, ${day(b.checkIn)} (${b.ref})`
  const body = [
    h1('Your stay is confirmed'),
    p(`Hi ${name}, thank you for choosing ${HOTEL.short}. We're looking forward to welcoming you.`),
    refBox(b.ref),
    rows(stayRows(b)),
    b.guest?.requests ? p(`<strong>Your requests:</strong> ${esc(b.guest.requests)}`) : '',
    p(`Free cancellation until 48 hours before check-in. Need to change something? Call us on ${esc(HOTEL.phone)} and quote your reference.`),
    b.uid ? `<p style="margin:20px 0 0">${button(link, 'View my booking')}</p>` : '',
  ].join('')
  const text = `Your stay is confirmed\n\nHi ${b.guest?.firstName || 'there'}, thank you for choosing ${HOTEL.short}.\n\nReference: ${b.ref}\nRoom: ${b.roomName}\nCheck-in: ${day(b.checkIn)} from ${HOTEL.checkInTime}\nCheck-out: ${day(b.checkOut)} by ${HOTEL.checkOutTime}\nGuests: ${b.guests}, ${b.nights} night(s)\nTotal: ${lkr(b.total)}\n\nFree cancellation until 48 hours before check-in. Call ${HOTEL.phone} with your reference for changes.\n${b.uid ? link : ''}`
  return { subject, html: layout({ preheader: `Reference ${b.ref} · ${day(b.checkIn)} → ${day(b.checkOut)}`, title: subject, body }), text }
}

export function bookingCancelled(b) {
  const byHotel = b.cancelledBy === 'hotel'
  const subject = `Booking cancelled: ${b.ref}`
  const body = [
    h1('Your booking is cancelled'),
    p(`Hi ${esc(b.guest?.firstName || 'there')}, ${byHotel ? 'the hotel has cancelled' : 'we have cancelled'} your booking below.`),
    refBox(b.ref),
    rows([['Room', esc(b.roomName)], ['Dates', `${esc(day(b.checkIn))} → ${esc(day(b.checkOut))}`]]),
    p(byHotel ? `If you didn't expect this, please call us on ${esc(HOTEL.phone)}.` : "We hope to welcome you another time."),
    `<p style="margin:20px 0 0">${button(`${site()}/rooms`, 'Book another stay')}</p>`,
  ].join('')
  const text = `Your booking ${b.ref} (${b.roomName}, ${day(b.checkIn)} → ${day(b.checkOut)}) is cancelled.\n${byHotel ? `If you didn't expect this, call ${HOTEL.phone}.` : 'We hope to welcome you another time.'}`
  return { subject, html: layout({ preheader: `${b.ref} has been cancelled`, title: subject, body }), text }
}

export function staffNewBooking(b) {
  const link = `${site()}/admin/bookings/${b.ref}`
  const subject = `New booking ${b.ref}: ${guestName(b)}, ${b.roomName}, ${day(b.checkIn)}`
  const body = [
    h1('New booking'),
    p(`<strong>${esc(guestName(b))}</strong> booked online.`),
    rows([
      ['Reference', `<span style="font-family:Consolas,monospace">${esc(b.ref)}</span>`],
      ...stayRows(b),
      ['Email', esc(b.guest?.email || '-')],
      ['Phone', esc(b.guest?.phone || '-')],
      ['Country', esc(b.guest?.country || '-')],
      ...(b.guest?.arrival ? [['Arrival time', esc(b.guest.arrival)]] : []),
    ]),
    b.guest?.requests ? p(`<strong>Requests:</strong> ${esc(b.guest.requests)}`) : '',
    `<p style="margin:20px 0 0">${button(link, 'Open in dashboard')}</p>`,
  ].join('')
  const text = `New booking ${b.ref}\n${guestName(b)} · ${b.roomName}\n${day(b.checkIn)} → ${day(b.checkOut)} · ${b.guests} guests\nTotal ${lkr(b.total)}\nPhone ${b.guest?.phone || '-'} · Email ${b.guest?.email || '-'}\n${link}`
  return { subject, html: layout({ preheader: `${b.roomName} · ${day(b.checkIn)} · ${lkr(b.total)}`, title: subject, body }), text }
}

export function staffNewMessage(m) {
  const link = `${site()}/admin/inbox`
  const subject = `New message: ${m.subject || 'Contact form'} (from ${m.name})`
  const body = [
    h1('New message from the website'),
    rows([['From', esc(m.name)], ['Email', esc(m.email)], ...(m.phone ? [['Phone', esc(m.phone)]] : []), ['Subject', esc(m.subject || '-')]]),
    `<div style="white-space:pre-wrap;background:${C.cream};border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.6">${esc(m.message)}</div>`,
    `<p style="margin:20px 0 0">${button(link, 'Open the inbox')}</p>`,
    p(`<span style="font-size:12px;color:${C.muted}">Reply to this email to answer ${esc(m.name)} directly.</span>`),
  ].join('')
  const text = `New message from ${m.name} <${m.email}>\nSubject: ${m.subject || '-'}\n\n${m.message}\n\n${link}`
  return { subject, html: layout({ preheader: m.message.slice(0, 90), title: subject, body }), text }
}

/* ---------- account emails (sent through Brevo instead of Firebase's default sender) ---------- */

export function verifyEmail({ name, link }) {
  const subject = `Confirm your email for ${HOTEL.short}`
  const body = [
    h1('Confirm your email'),
    p(`Hi ${esc(name || 'there')}, please confirm this is your email address. It keeps your bookings safe and lets us send your confirmations.`),
    `<p style="margin:22px 0">${button(link, 'Confirm my email')}</p>`,
    p(`<span style="font-size:13px;color:${C.muted}">The button doesn't work? Copy this link into your browser:<br><span style="word-break:break-all">${esc(link)}</span></span>`),
    p(`<span style="font-size:13px;color:${C.muted}">Didn't create an account? You can ignore this email.</span>`),
  ].join('')
  const text = `Confirm your email for ${HOTEL.short}\n\nOpen this link to confirm your email address:\n${link}\n\nDidn't create an account? Ignore this email.`
  return { subject, html: layout({ preheader: 'One click to confirm your email address', title: subject, body }), text }
}

export function passwordResetEmail({ link }) {
  const subject = `Reset your ${HOTEL.short} password`
  const body = [
    h1('Reset your password'),
    p('We got a request to reset the password for this email. Choose a new one with the button below.'),
    `<p style="margin:22px 0">${button(link, 'Choose a new password')}</p>`,
    p(`<span style="font-size:13px;color:${C.muted}">The link works once and expires after an hour. If you didn't ask for this, ignore this email; your password stays the same.</span>`),
  ].join('')
  const text = `Reset your ${HOTEL.short} password:\n${link}\n\nIf you didn't ask for this, ignore this email.`
  return { subject, html: layout({ preheader: 'Choose a new password', title: subject, body }), text }
}

/* ---------- staff reply to a contact-form message ---------- */

/** m = the guest's message, reply = what the staff member typed. */
export function guestReply(m, reply) {
  const subject = `Re: ${m.subject || 'Your message to ' + HOTEL.short}`
  const paras = reply.split(/\n{2,}/).map((x) => p(esc(x).replace(/\n/g, '<br>'))).join('')
  const body = [
    p(`Dear ${esc(m.name)},`),
    paras,
    p(`Kind regards,<br><strong>${esc(HOTEL.name)}</strong><br><span style="color:${C.muted};font-size:13px">${esc(HOTEL.phone)} · <a href="${esc(site())}" style="color:${C.gold}">${esc(site().replace(/^https?:\/\//, ''))}</a></span>`),
    `<div style="margin-top:22px;border-left:3px solid ${C.line};padding:4px 0 4px 14px;font-size:13px;line-height:1.6;color:${C.muted}">
      <div style="margin-bottom:6px">Your message:</div><div style="white-space:pre-wrap">${esc(m.message)}</div></div>`,
  ].join('')
  const text = `Dear ${m.name},\n\n${reply}\n\nKind regards,\n${HOTEL.name}\n${HOTEL.phone}\n\n> ${m.message.split('\n').join('\n> ')}`
  return { subject, html: layout({ preheader: reply.slice(0, 90), title: subject, body }), text }
}

/* ---------- after check-out: ask for a review ---------- */

export function reviewRequest(b, link) {
  const name = esc(b.guest?.firstName || 'there')
  const subject = `How was your stay at ${HOTEL.short}?`
  const stars = [1, 2, 3, 4, 5]
    .map((n) => `<a href="${esc(link)}&amp;r=${n}" style="text-decoration:none;font-size:30px;color:${C.gold};padding:0 3px" title="${n} star${n > 1 ? 's' : ''}">&#9733;</a>`)
    .join('')
  const body = [
    h1('Thank you for staying with us'),
    p(`Hi ${name}, we hope you enjoyed your time in the ${esc(b.roomName)}. Would you tell us how it went? It takes a minute and helps other travellers choose.`),
    `<p style="margin:18px 0 6px;text-align:center">${stars}</p>`,
    `<p style="margin:0 0 20px;text-align:center;font-size:12px;color:${C.muted}">Tap a star to start</p>`,
    `<p style="margin:0 0 18px;text-align:center">${button(link, 'Write a review')}</p>`,
    p(`<span style="font-size:13px;color:${C.muted}">This link is just for you (booking ${esc(b.ref)}). Your first name and last initial are shown with your review, never your email.</span>`),
  ].join('')
  const text = `Hi ${b.guest?.firstName || 'there'},\n\nThank you for staying in the ${b.roomName}. Would you tell us how it went?\n\nWrite a review: ${link}\n\nThis link is just for you (booking ${b.ref}).`
  return { subject, html: layout({ preheader: 'Tell us about your stay: it takes a minute', title: subject, body }), text }
}

/* ---------- invoice / receipt ---------- */

const METHOD = { cash: 'Cash', card: 'Card', bank: 'Bank transfer', other: 'Other' }

/** The bill as an email table: room, extras, payments, balance. */
function invoiceTable(b, t) {
  const pr = b.price || {}
  const line = (label, amount, opts = {}) =>
    `<tr><td style="padding:7px 0;border-bottom:1px solid ${C.line};${opts.muted ? `color:${C.muted};` : ''}">${label}</td><td align="right" style="padding:7px 0;border-bottom:1px solid ${C.line};white-space:nowrap;${opts.bold ? 'font-weight:bold;font-size:16px;' : ''}${opts.muted ? `color:${C.muted};` : ''}">${amount}</td></tr>`
  const rowsHtml = [
    line(`${esc(b.roomName)}, ${b.nights} night${b.nights === 1 ? '' : 's'}<br><span style="font-size:12px;color:${C.muted}">${esc(day(b.checkIn))} → ${esc(day(b.checkOutActual || b.checkOut))}</span>`, lkr(pr.rooms ?? pr.subtotal ?? b.total)),
    pr.discount > 0 ? line(`Promo ${esc(pr.promo?.code || '')}`, `− ${lkr(pr.discount)}`, { muted: true }) : '',
    pr.service ? line('Service charge (10%)', lkr(pr.service), { muted: true }) : '',
    pr.tax ? line('Taxes (8%)', lkr(pr.tax), { muted: true }) : '',
    ...(b.charges || []).map((c) => line(`${esc(c.description)}${c.qty > 1 ? ` × ${c.qty}` : ''}`, lkr(c.amount))),
    line('<strong>Total</strong>', lkr(t.total), { bold: true }),
    ...(b.payments || []).map((p) => line(`Paid by ${METHOD[p.method]?.toLowerCase() || 'payment'} · ${esc(p.receipt || '')}`, `− ${lkr(p.amount)}`, { muted: true })),
    line(`<strong>${t.balance > 0 ? 'Balance due' : 'Balance'}</strong>`, t.balance > 0 ? lkr(t.balance) : `${lkr(0)} · Paid in full`, { bold: true }),
  ].join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;font-size:14px">${rowsHtml}</table>`
}

const invoiceText = (b, t) =>
  [`${b.roomName}, ${b.nights} night(s): ${lkr(b.total)}`, ...(b.charges || []).map((c) => `${c.description}${c.qty > 1 ? ` x ${c.qty}` : ''}: ${lkr(c.amount)}`),
    `Total: ${lkr(t.total)}`, ...(b.payments || []).map((p) => `Paid (${METHOD[p.method] || 'payment'}, ${p.receipt}): -${lkr(p.amount)}`),
    t.balance > 0 ? `Balance due: ${lkr(t.balance)}` : 'Paid in full'].join('\n')

const invoiceLink = (b) => (b.uid ? `${site()}/invoice/${b.ref}` : '')

/** Sent by staff from the booking page. */
export function invoiceEmail(b, t) {
  const number = b.invoice?.number || b.ref
  const subject = `Your invoice ${number} from ${HOTEL.short}`
  const body = [
    h1(t.balance > 0 ? 'Your invoice' : 'Your receipt'),
    p(`Hi ${esc(b.guest?.firstName || 'there')}, here is the bill for your stay. Keep this email for your records.`),
    rows([['Invoice', esc(number)], ['Booking', esc(b.ref)], ['Guest', esc(guestName(b))]]),
    invoiceTable(b, t),
    invoiceLink(b) ? `<p style="margin:0 0 14px">${button(invoiceLink(b), 'View or print the invoice')}</p>` : '',
    p(`<span style="font-size:13px;color:${C.muted}">Questions about this bill? Call ${esc(HOTEL.phone)} or reply to this email.</span>`),
  ].join('')
  const text = `Invoice ${number} (booking ${b.ref})\n\n${invoiceText(b, t)}\n\n${invoiceLink(b)}`
  return { subject, html: layout({ preheader: `${t.balance > 0 ? `Balance due ${lkr(t.balance)}` : 'Paid in full'} · ${number}`, title: subject, body }), text }
}

/** At check-out: thank you + the bill + "How was your stay?" stars, in one email. */
export function checkoutEmail(b, t, reviewLink) {
  const name = esc(b.guest?.firstName || 'there')
  const subject = `Thank you for staying at ${HOTEL.short}`
  const stars = [1, 2, 3, 4, 5]
    .map((n) => `<a href="${esc(reviewLink)}&amp;r=${n}" style="text-decoration:none;font-size:30px;color:${C.gold};padding:0 3px" title="${n} star${n > 1 ? 's' : ''}">&#9733;</a>`)
    .join('')
  const body = [
    h1('Thank you for staying with us'),
    p(`Hi ${name}, we hope you enjoyed your time in the ${esc(b.roomName)}. Safe travels!`),
    `<div style="background:${C.cream};border-radius:12px;padding:16px 18px;margin:18px 0;text-align:center">
      <div style="font-family:Georgia,serif;font-size:18px;font-weight:bold;margin-bottom:4px">How was your stay?</div>
      <div style="font-size:13px;color:${C.muted};margin-bottom:6px">Tap a star. It takes a minute and helps other travellers.</div>
      <div>${stars}</div>
    </div>`,
    `<h2 style="font-family:Georgia,serif;font-size:18px;margin:22px 0 4px">${t.balance > 0 ? 'Your invoice' : 'Your receipt'}${b.invoice?.number ? ` <span style="font-size:13px;color:${C.muted};font-family:Arial,sans-serif;font-weight:normal">${esc(b.invoice.number)}</span>` : ''}</h2>`,
    invoiceTable(b, t),
    invoiceLink(b) ? `<p style="margin:0 0 14px">${button(invoiceLink(b), 'View or print the invoice')}</p>` : '',
    p(`<span style="font-size:13px;color:${C.muted}">The review link is just for you (booking ${esc(b.ref)}). Your first name and last initial are shown with your review, never your email.</span>`),
  ].join('')
  const text = `Thank you for staying in the ${b.roomName}, ${b.guest?.firstName || ''}!\n\nHow was your stay? ${reviewLink}\n\nYour bill${b.invoice?.number ? ` (${b.invoice.number})` : ''}:\n${invoiceText(b, t)}\n\n${invoiceLink(b)}`
  return { subject, html: layout({ preheader: 'Your receipt, and how was your stay?', title: subject, body }), text }
}
