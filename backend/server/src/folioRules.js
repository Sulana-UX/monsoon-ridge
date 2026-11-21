/*
 * Guest bill ("folio"): the room price from the booking + extra charges added by staff
 * (restaurant, spa, transfers…) − payments taken at the desk = balance.
 * Pure rules, tested in test/validate.test.js. All amounts are whole rupees (LKR).
 */
import { randomBytes } from 'node:crypto'
import { ApiError } from './errors.js'

export const PAY_METHODS = { cash: 'Cash', card: 'Card', bank: 'Bank transfer', other: 'Other' }
const MAX_AMOUNT = 50_000_000

const bad = (msg) => {
  throw new ApiError('invalid-argument', msg)
}
const money = (v, label) => {
  const n = typeof v === 'string' ? Number(v.replace(/[,\s]/g, '')) : Number(v)
  if (!Number.isFinite(n) || n <= 0) bad(`${label} must be more than 0.`)
  if (n > MAX_AMOUNT) bad(`${label} is too large.`)
  return Math.round(n)
}

export const newId = () => randomBytes(6).toString('hex')

export function parseCharge(data) {
  if (!data || typeof data !== 'object') bad('Missing charge.')
  const description = typeof data.description === 'string' ? data.description.trim().replace(/\s+/g, ' ') : ''
  if (description.length < 2) bad('Describe the charge (e.g. "Dinner for two").')
  if (description.length > 80) bad('Description is too long (max 80 characters).')
  const qty = data.qty == null || data.qty === '' ? 1 : Number(data.qty)
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) bad('Quantity must be a whole number from 1 to 99.')
  const unitPrice = money(data.unitPrice, 'Price')
  return { description, qty, unitPrice, amount: qty * unitPrice }
}

export function parsePayment(data) {
  if (!data || typeof data !== 'object') bad('Missing payment.')
  const amount = money(data.amount, 'Amount')
  if (!Object.hasOwn(PAY_METHODS, data.method)) bad('Choose how the guest paid.')
  const note = typeof data.note === 'string' ? data.note.trim() : ''
  if (note.length > 120) bad('Note is too long (max 120 characters).')
  return { amount, method: data.method, note }
}

/** { room, extras, total, paid, balance } for a booking. */
export function folioTotals(b) {
  const room = Math.round(b?.total || 0)
  const extras = (b?.charges || []).reduce((s, c) => s + (c.amount || 0), 0)
  const paid = (b?.payments || []).reduce((s, p) => s + (p.amount || 0), 0)
  return { room, extras, total: room + extras, paid, balance: room + extras - paid }
}

/** Charges and payments can be added to live and finished stays, not cancelled ones. */
export function folioProblem(b) {
  if (b.status === 'Cancelled') return 'This booking was cancelled, so its bill is closed.'
  return null
}

const pad = (n) => String(n).padStart(5, '0')
export const invoiceNumber = (year, seq) => `INV-${year}-${pad(seq)}`
export const receiptNumber = (year, seq) => `RCT-${year}-${pad(seq)}`
