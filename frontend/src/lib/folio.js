// Guest bill helpers (same rules as backend/server/src/folioRules.js)

export const PAY_METHODS = { cash: 'Cash', card: 'Card', bank: 'Bank transfer', other: 'Other' }

export const HOTEL = {
  name: 'Monsoon Ridge Jungle Resort & Spa',
  address: '18 Cliffside Road, Ella, Sri Lanka',
  phone: '+94 11 234 5678',
  email: 'stay@monsoonridge.lk',
}

/** { room, extras, total, paid, balance } */
export function folioTotals(b) {
  const room = Math.round(b?.total || 0)
  const extras = (b?.charges || []).reduce((s, c) => s + (c.amount || 0), 0)
  const paid = (b?.payments || []).reduce((s, p) => s + (p.amount || 0), 0)
  return { room, extras, total: room + extras, paid, balance: room + extras - paid }
}

/** Firestore Timestamp inside an array → Date (fromSnap only converts top-level fields). */
export const tsDate = (v) => v?.toDate?.() ?? (v instanceof Date ? v : null)

export const shortWhen = (d) => (d ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
