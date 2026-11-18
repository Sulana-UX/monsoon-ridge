import { createContext, useContext, useEffect, useState } from 'react'
import { addDays, today } from '../utils'

/*
 * Holds only the current search (dates + guests).
 * Bookings themselves live in Firestore (see lib/bookings.js).
 */
const BookingContext = createContext(null)

export function BookingProvider({ children }) {
  const [search, setSearch] = useState({
    checkIn: addDays(today(), 1),
    checkOut: addDays(today(), 3),
    guests: 2,
  })

  // Bookings used to be stored in the browser; clear those old copies.
  useEffect(() => {
    try {
      localStorage.removeItem('monsoon-ridge-bookings')
      localStorage.removeItem('diyamankada-bookings')
    } catch {
      /* storage unavailable */
    }
  }, [])

  return <BookingContext.Provider value={{ search, setSearch }}>{children}</BookingContext.Provider>
}

export const useBooking = () => useContext(BookingContext)
