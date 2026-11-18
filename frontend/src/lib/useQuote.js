import { useEffect, useState } from 'react'
import { api } from './firebase'
import { nightsBetween, priceBreakdown } from '../utils'

/*
 * The exact price of a stay from the server (season %, weekend extra, promo code),
 * the same calculation the booking itself uses.
 * While loading, or if the free server is asleep, `quote` is an estimate at the
 * base rate (estimate: true) so the page never shows an empty price.
 */
export function useQuote(room, checkIn, checkOut, promo = '') {
  const nights = nightsBetween(checkIn, checkOut)
  const [state, setState] = useState({ quote: null, key: '', promoError: '', loading: false })
  const roomId = room?.id
  const key = `${roomId}|${checkIn}|${checkOut}`
  useEffect(() => {
    if (!roomId || nights < 1) return setState({ quote: null, key: '', promoError: '', loading: false })
    let live = true
    setState((s) => ({ ...s, loading: true }))
    // short pause so typing a promo code doesn't fire a request per letter
    const timer = setTimeout(() => {
      api.quote({ roomId, checkIn, checkOut, promo: promo.trim() })
        .then(({ quote, promoError }) => live && setState({ quote, key, promoError: promoError || '', loading: false }))
        .catch(() => live && setState({ quote: null, key: '', promoError: '', loading: false }))
    }, promo ? 400 : 0)
    return () => { live = false; clearTimeout(timer) }
  }, [roomId, checkIn, checkOut, promo, nights, key])

  const estimate = room && nights > 0 ? { ...priceBreakdown(room.price, nights), rate: room.price, nights, rooms: room.price * nights, discount: 0, estimate: !state.loading } : null
  // a quote for other dates / another room is never shown
  const fresh = state.key === key ? state.quote : null
  return { quote: fresh || estimate, promoError: state.key === key ? state.promoError : '', loading: state.loading }
}
