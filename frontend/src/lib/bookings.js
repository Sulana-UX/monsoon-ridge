import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, where, limit } from 'firebase/firestore'
import { db } from './firebase'

const fromSnap = (d) => {
  const b = d.data()
  return { ...b, createdAt: b.createdAt?.toDate?.() ?? null }
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
