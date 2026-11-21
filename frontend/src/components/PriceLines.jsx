import { formatLKR, prettyDate } from '../utils'

/*
 * Price breakdown for a quote or a saved booking price:
 *   room nights (with per-night detail when seasons / weekends change the rate),
 *   promo discount or the stay-longer offer's free night, service charge, tax, total.
 * Works with older bookings that only have { rate, nights, subtotal, service, tax, total }.
 */
export default function PriceLines({ price, className = 'price-lines' }) {
  if (!price) return null
  const nightly = price.nightly || []
  const rooms = price.rooms ?? price.subtotal
  const varies = nightly.some((n) => n.rate !== price.rate)
  const n = price.nights

  return (
    <div className={className}>
      {varies ? (
        <details className="price-nights">
          <summary>
            <span>Room, {n} night{n === 1 ? '' : 's'} <small>(see nights)</small></span>
            <span>{formatLKR(rooms)}</span>
          </summary>
          <ul>
            {nightly.map((x) => (
              <li key={x.date}>
                <span>{prettyDate(x.date).replace(/ \d{4}$/, '')}{x.season ? ` · ${x.season}` : ''}{x.weekend ? ' · weekend' : ''}</span>
                <span>{formatLKR(x.rate)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <div><span>{formatLKR(price.rate)} × {n} night{n === 1 ? '' : 's'}</span><span>{formatLKR(rooms)}</span></div>
      )}
      {price.discount > 0 && (
        <div className="price-discount"><span>Promo {price.promo?.code} (−{price.promo?.percent}%)</span><span>− {formatLKR(price.discount)}</span></div>
      )}
      {price.offer && (
        <>
          <div className="price-discount"><span>Free night ({prettyDate(price.offer.night).replace(/^\w+, /, '').replace(/ \d{4}$/, '')})</span><span>− {formatLKR(price.offer.amount)}</span></div>
          <div className="price-perks"><span>{price.offer.name}{price.offer.perks ? `. Includes ${price.offer.perks.charAt(0).toLowerCase()}${price.offer.perks.slice(1)}` : ''}.</span></div>
        </>
      )}
      <div><span>Service charge (10%)</span><span>{formatLKR(price.service)}</span></div>
      <div><span>Taxes (8%)</span><span>{formatLKR(price.tax)}</span></div>
      <div className="total"><span>Total{price.estimate ? ' (estimate)' : ''}</span><span>{formatLKR(price.total)}</span></div>
    </div>
  )
}
