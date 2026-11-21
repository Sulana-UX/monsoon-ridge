import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, where, limit } from 'firebase/firestore'
import { db } from './firebase'

// Firestore Timestamps (createdAt, checkedInAt, …) become JS Dates
const fromSnap = (d) => {
  const b = d.data()
  for (const k of Object.keys(b)) if (typeof b[k]?.toDate === 'function') b[k] = b[k].toDate()
  return { ...b, createdAt: b.createdAt ?? null }
}

/** Live list of bookings. uid = one guest's bookings; uid = null with all = every booking (admin). */
export function useBookings({ uid, all = false, max = 200 }) {
  const [state, setState] = useState({ bookings: [], loading: true, error: null })

  useEffect(() => {
    if (!uid && !all) return
    const base = collection(db, 'bookings')
    const q = all
      ? query(base, orderBy('createdAt', 'desc'), limit(max))
      : query(base, where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(max))
    return onSnapshot(
      q,
      (snap) => setState({ bookings: snap.docs.map(fromSnap), loading: false, error: null }),
      (error) => setState({ bookings: [], loading: false, error }),
    )
  }, [uid, all, max])

  return state
}

/** Live single booking by reference (rules only allow the owner or an admin). */
export function useBookingByRef(ref) {
  const [state, setState] = useState({ booking: null, loading: true })

  useEffect(() => {
    if (!/^MRR-[A-Z0-9]{8}$/.test(ref || '')) {
      setState({ booking: null, loading: false })
      return
    }
    return onSnapshot(
      doc(db, 'bookings', ref),
      (snap) => setState({ booking: snap.exists() ? fromSnap(snap) : null, loading: false }),
      () => setState({ booking: null, loading: false }),
    )
  }, [ref])

  return state
}

/** Live staff-only notes for a booking (rules allow admins only). */
export function useBookingNotes(ref) {
  const [state, setState] = useState({ notes: [], loading: true, error: null })
  useEffect(() => {
    if (!ref) return
    return onSnapshot(
      query(collection(db, 'bookings', ref, 'notes'), orderBy('at', 'desc')),
      (snap) => setState({ notes: snap.docs.map((d) => ({ id: d.id, ...d.data(), at: d.data().at?.toDate?.() ?? null })), loading: false, error: null }),
      (error) => setState({ notes: [], loading: false, error }),
    )
  }, [ref])
  return state
}

/** Live room blocks (maintenance / private events). Staff only. */
export function useBlocks() {
  const [state, setState] = useState({ blocks: [], loading: true, error: null })
  useEffect(() => onSnapshot(
    collection(db, 'blocks'),
    (snap) => setState({ blocks: snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => x.from.localeCompare(y.from)), loading: false, error: null }),
    (error) => setState({ blocks: [], loading: false, error }),
  ), [])
  return state
}

/** Staff: season / weekend price rules (settings/pricing). rules = null until saved once. */
export function usePricingRules() {
  const [state, setState] = useState({ rules: null, loading: true, error: null })
  useEffect(() => onSnapshot(
    doc(db, 'settings', 'pricing'),
    (snap) => setState({ rules: snap.exists() ? snap.data() : null, loading: false, error: null }),
    (error) => setState({ rules: null, loading: false, error }),
  ), [])
  return state
}

/** Staff: all promo codes, newest first. */
export function usePromos() {
  const [state, setState] = useState({ promos: [], loading: true, error: null })
  useEffect(() => onSnapshot(
    collection(db, 'promos'),
    (snap) => setState({
      promos: snap.docs.map(fromSnap).sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0)),
      loading: false, error: null,
    }),
    (error) => setState({ promos: [], loading: false, error }),
  ), [])
  return state
}

/** Staff: contact-form messages, newest first. */
export function useMessages() {
  const [state, setState] = useState({ messages: [], loading: true, error: null })
  useEffect(() => onSnapshot(
    query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(300)),
    (snap) => setState({ messages: snap.docs.map((d) => ({ id: d.id, ...fromSnap(d) })), loading: false, error: null }),
    (error) => setState({ messages: [], loading: false, error }),
  ), [])
  return state
}

/** Staff: activity log, newest first. `max` grows with "Load more". */
export function useActivity(max = 200) {
  const [state, setState] = useState({ entries: [], loading: true, error: null })
  useEffect(() => onSnapshot(
    query(collection(db, 'activity'), orderBy('at', 'desc'), limit(max)),
    (snap) => setState({ entries: snap.docs.map((d) => ({ id: d.id, ...fromSnap(d) })), loading: false, error: null }),
    (error) => setState({ entries: [], loading: false, error }),
  ), [max])
  return state
}

/** Staff: activity for one booking (equality filter only, so no extra index is needed). */
export function useActivityFor(targetId) {
  const [state, setState] = useState({ entries: [], loading: true, error: null })
  useEffect(() => onSnapshot(
    query(collection(db, 'activity'), where('target.id', '==', targetId), limit(100)),
    (snap) => setState({
      entries: snap.docs.map((d) => ({ id: d.id, ...fromSnap(d) })).sort((a, b) => (a.at?.getTime?.() ?? Infinity) - (b.at?.getTime?.() ?? Infinity)),
      loading: false, error: null,
    }),
    (error) => setState({ entries: [], loading: false, error }),
  ), [targetId])
  return state
}

/** Staff: room numbers with housekeeping status, sorted naturally (101, 102, …, V1). */
export function useUnits() {
  const [state, setState] = useState({ units: [], loading: true, error: null })
  useEffect(() => onSnapshot(
    collection(db, 'roomUnits'),
    (snap) => setState({
      units: snap.docs.map(fromSnap).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
      loading: false, error: null,
    }),
    (error) => setState({ units: [], loading: false, error }),
  ), [])
  return state
}

/*
 * The stay-longer offer (settings/offer), readable by everyone: { active, minNights, from, to, perks }.
 * offer = null until staff save it once. The server applies it to prices; this is only for showing it.
 */
export function useOffer() {
  const [state, setState] = useState({ offer: null, loading: true, error: null })
  useEffect(() => onSnapshot(
    doc(db, 'settings', 'offer'),
    (snap) => setState({ offer: snap.exists() ? snap.data() : null, loading: false, error: null }),
    (error) => setState({ offer: null, loading: false, error }),
  ), [])
  return state
}

export const offerName = (o) => `Stay ${o.minNights} nights, pay for ${o.minNights - 1}`

/** On, and guests can still check in under it (today = hotel date, YYYY-MM-DD) */
export const offerLive = (o, today) => Boolean(o?.active && o.minNights && o.to >= today)
