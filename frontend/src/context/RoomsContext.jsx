import { createContext, useContext, useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'

/*
 * Live list of rooms from Firestore. Staff edits in the dashboard show up
 * on the website straight away, without a reload.
 */
const RoomsContext = createContext({ rooms: [], loading: true, error: null })

export const CATEGORIES = ['Single', 'Double', 'Family']

// Featured first, then cheapest first
const order = (a, b) => (b.featured === true) - (a.featured === true) || a.price - b.price

const fromDoc = (d) => ({ ...d.data(), id: d.id })

/** all = include hidden rooms (staff only; the rules refuse this for guests). */
function useRoomsQuery(all) {
  const [state, setState] = useState({ rooms: [], loading: true, error: null })
  useEffect(() => {
    const base = collection(db, 'rooms')
    const q = all ? base : query(base, where('active', '==', true))
    return onSnapshot(
      q,
      (snap) => setState({ rooms: snap.docs.map(fromDoc).sort(order), loading: false, error: null }),
      (error) => setState({ rooms: [], loading: false, error }),
    )
  }, [all])
  return state
}

export function RoomsProvider({ children }) {
  const state = useRoomsQuery(false)
  return <RoomsContext.Provider value={state}>{children}</RoomsContext.Provider>
}

/** Rooms shown on the website. */
export const useRooms = () => useContext(RoomsContext)

/** Every room, including hidden ones (admin dashboard). */
export const useAllRooms = () => useRoomsQuery(true)
