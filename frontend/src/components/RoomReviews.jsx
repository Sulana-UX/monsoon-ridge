import { useState } from 'react'
import { MessageSquareQuote, BadgeCheck } from 'lucide-react'
import { Stars } from './Stars'
import { useRoomReviews, summarize, stayMonth, RATING_WORD } from '../lib/reviews'

const PAGE = 5

/** Room page: rating summary + verified guest reviews. */
export default function RoomReviews({ roomId }) {
  const { reviews, loading, error } = useRoomReviews(roomId)
  const [shown, setShown] = useState(PAGE)
  const [only, setOnly] = useState(0) // 0 = all stars
  if (loading) return null

  const sum = summarize(reviews)
  const list = only ? reviews.filter((r) => r.rating === only) : reviews

  return (
    <div className="detail-block room-reviews" id="reviews">
      <h2>Guest reviews</h2>
      {error || sum.count === 0 ? (
        <p className="muted room-reviews-none"><MessageSquareQuote size={18} /> No reviews yet. Guests can review this room after their stay.</p>
      ) : (
        <>
          <div className="rv-summary">
            <div className="rv-score">
              <strong>{sum.avg.toFixed(1)}</strong>
              <Stars value={sum.avg} size={18} />
              <span className="muted">{RATING_WORD[Math.round(sum.avg)]} · {sum.count} review{sum.count === 1 ? '' : 's'}</span>
            </div>
            <ul className="rv-bars">
              {sum.bars.map((b) => (
                <li key={b.stars}>
                  <button type="button" className={only === b.stars ? 'is-on' : ''} disabled={!b.n}
                    onClick={() => { setOnly(only === b.stars ? 0 : b.stars); setShown(PAGE) }}
                    aria-pressed={only === b.stars} aria-label={`${b.stars} stars: ${b.n} review${b.n === 1 ? '' : 's'}${b.n ? '. Show only these' : ''}`}>
                    <span>{b.stars}★</span>
                    <span className="rv-bar"><i style={{ width: `${b.pct}%` }} /></span>
                    <span className="rv-n">{b.n}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {only > 0 && <p className="rv-filter muted small">Showing {only}-star reviews · <button type="button" className="text-btn" onClick={() => setOnly(0)}>Show all</button></p>}

          <ul className="rv-list">
            {list.slice(0, shown).map((r) => (
              <li key={r.id} className="review-card">
                <header>
                  <span className="avatar avatar--sm">{r.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</span>
                  <span className="rv-who">
                    <strong>{r.name}</strong>
                    <small className="muted"><BadgeCheck size={13} /> Stayed {stayMonth(r.stayMonth)}</small>
                  </span>
                  <Stars value={r.rating} size={15} />
                </header>
                {r.title && <strong className="rv-title">{r.title}</strong>}
                <blockquote>{r.text}</blockquote>
                {r.reply?.text && (
                  <div className="rv-reply">
                    <strong>Response from Monsoon Ridge</strong>
                    <p>{r.reply.text}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {list.length > shown && (
            <button type="button" className="btn btn-outline btn-sm rv-more" onClick={() => setShown((n) => n + PAGE * 2)}>
              Show more reviews ({list.length - shown})
            </button>
          )}
        </>
      )}
    </div>
  )
}
