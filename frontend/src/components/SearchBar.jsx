import { useNavigate } from 'react-router-dom'
import { CalendarDays, Users, Search } from 'lucide-react'
import { useBooking } from '../context/BookingContext'
import { addDays, today, nightsBetween } from '../utils'

export default function SearchBar({ compact = false, onSearch }) {
  const { search, setSearch } = useBooking()
  const navigate = useNavigate()

  const update = (key, value) => {
    const next = { ...search, [key]: value }
    if (key === 'checkIn' && nightsBetween(value, next.checkOut) < 1) {
      next.checkOut = addDays(value, 1)
    }
    setSearch(next)
  }

  const submit = (e) => {
    e.preventDefault()
    if (onSearch) onSearch()
    else navigate('/rooms')
  }

  const nights = nightsBetween(search.checkIn, search.checkOut)

  return (
    <form className={`searchbar ${compact ? 'searchbar--compact' : ''}`} onSubmit={submit}>
      <label className="sb-field">
        <span className="sb-label"><CalendarDays size={15} /> Check-in</span>
        <input
          type="date"
          value={search.checkIn}
          min={today()}
          onChange={(e) => update('checkIn', e.target.value)}
          required
        />
      </label>
      <label className="sb-field">
        <span className="sb-label"><CalendarDays size={15} /> Check-out</span>
        <input
          type="date"
          value={search.checkOut}
          min={addDays(search.checkIn, 1)}
          onChange={(e) => update('checkOut', e.target.value)}
          required
        />
      </label>
      <label className="sb-field">
        <span className="sb-label"><Users size={15} /> Guests</span>
        <select value={search.guests} onChange={(e) => update('guests', Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn btn-gold sb-btn">
        <Search size={18} />
        <span>{compact ? 'Update' : 'Check Availability'}</span>
      </button>
      {!compact && nights > 0 && (
        <span className="sb-nights">{nights} night{nights > 1 ? 's' : ''} stay</span>
      )}
    </form>
  )
}
