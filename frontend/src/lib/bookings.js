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
