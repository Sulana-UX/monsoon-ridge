export const formatLKR = (n) => 'LKR ' + Math.round(n).toLocaleString('en-US')

export const toISO = (d) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}

export const addDays = (iso, days) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export const today = () => toISO(new Date())

export const nightsBetween = (a, b) => {
  if (!a || !b) return 0
  const diff = (new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000
  return Math.max(0, Math.round(diff))
}

export const prettyDate = (iso) =>
  iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

export const SERVICE_RATE = 0.1
export const TAX_RATE = 0.08

export const priceBreakdown = (price, nights) => {
  const subtotal = price * nights
  const service = subtotal * SERVICE_RATE
  const tax = subtotal * TAX_RATE
  return { subtotal, service, tax, total: subtotal + service + tax }
}
