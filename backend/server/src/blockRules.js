// Pure validation for room blocks (no database), used by blocks.js
import { ApiError } from './errors.js'
import { isValidISODate, daysBetween } from './validate.js'
import { parseRoomId } from './rooms.js'

const MAX_BLOCK_NIGHTS = 120
const bad = (msg) => {
  throw new ApiError('invalid-argument', msg)
}

/** Validates a block request (pure). */
export function parseBlockInput(data, today) {
  if (!data || typeof data !== 'object') bad('Block details are missing.')
  const roomId = parseRoomId(data.roomId)
  const { from, to } = data
  if (!isValidISODate(from) || !isValidISODate(to)) bad('Please choose valid dates.')
  if (from < today) bad('A block cannot start in the past.')
  const nights = daysBetween(from, to)
  if (nights < 1) bad('The end date must be after the start date.')
  if (nights > MAX_BLOCK_NIGHTS) bad(`A block can be at most ${MAX_BLOCK_NIGHTS} nights.`)
  const units = typeof data.units === 'string' ? Number(data.units) : data.units
  if (!Number.isInteger(units) || units < 1 || units > 200) bad('Number of rooms must be a whole number.')
  const reason = typeof data.reason === 'string' ? data.reason.trim() : ''
  if (reason.length < 2) bad('Please give a reason (e.g. Renovation).')
  if (reason.length > 120) bad('Reason must be at most 120 characters.')
  return { roomId, from, to, nights, units, reason }
}
