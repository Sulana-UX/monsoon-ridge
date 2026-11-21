import { useState } from 'react'
import { Star } from 'lucide-react'
import { RATING_WORD } from '../lib/reviews'

/** Read-only stars. value can be fractional (4.5 → four and a half). */
export function Stars({ value = 0, size = 16, className = '' }) {
  return (
    <span className={`stars-row ${className}`} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)))
        return (
          <span key={n} className="star-slot" style={{ width: size, height: size }}>
            <Star size={size} className="star-empty" />
            {fill > 0 && <span className="star-fill" style={{ width: `${fill * 100}%` }}><Star size={size} fill="currentColor" /></span>}
          </span>
        )
      })}
    </span>
  )
}

/** Pick 1–5 stars (keyboard: arrow keys, or 1–5). */
export function StarPicker({ value, onChange, size = 38, disabled = false }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  const key = (e) => {
    if (/^[1-5]$/.test(e.key)) onChange(Number(e.key))
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(5, (value || 0) + 1)) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(1, (value || 1) - 1)) }
  }
  return (
    <div className="star-picker">
      <div role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)} onKeyDown={key}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}, ${RATING_WORD[n]}`}
            tabIndex={value ? (value === n ? 0 : -1) : n === 1 ? 0 : -1} disabled={disabled}
            className={n <= shown ? 'is-on' : ''} onMouseEnter={() => setHover(n)} onClick={() => onChange(n)}>
            <Star size={size} fill={n <= shown ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <span className="star-word" aria-live="polite">{shown ? RATING_WORD[shown] : 'Tap a star'}</span>
    </div>
  )
}
