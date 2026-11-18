import { useEffect, useState } from 'react'
import { api } from './firebase'
import { nightsBetween } from '../utils'

/*
 * Free rooms per room id for the chosen dates: { [roomId]: number }.
 * `available` is null while loading or if the server can't be reached;
 * pages then just don't show availability (booking still re-checks on the server).
 */
export function useAvailability(checkIn, checkOut, refreshKey = 0) {
  const [state, setState] = useState({ available: null, loading: true })
  useEffect(() => {
    if (nightsBetween(checkIn, checkOut) < 1) {
      setState({ available: null, loading: false })
      return
    }
    let live = true
    setState((s) => ({ ...s, loading: true }))
    api.availability(checkIn, checkOut)
      .then((available) => live && setState({ available, loading: false }))
      .catch(() => live && setState({ available: null, loading: false }))
    return () => { live = false }
  }, [checkIn, checkOut, refreshKey])
  return state
}
