import { useMemo, useState } from 'react'
import { SlidersHorizontal, SearchX } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SearchBar from '../components/SearchBar'
import RoomCard from '../components/RoomCard'
import Reveal from '../components/Reveal'
import { images } from '../data/rooms'
import { useRooms, CATEGORIES } from '../context/RoomsContext'
import { useBooking } from '../context/BookingContext'
import { formatLKR } from '../utils'

export default function Rooms() {
  const { search } = useBooking()
  const { rooms, loading, error } = useRooms()
  const MAX_PRICE = useMemo(() => Math.max(10000, ...rooms.map((r) => r.price)), [rooms])
  const [type, setType] = useState('All')
  const [maxPrice, setMaxPrice] = useState(Infinity)
  const priceCap = Math.min(maxPrice, MAX_PRICE)
  const [sort, setSort] = useState('recommended')
  const [showFilters, setShowFilters] = useState(false)

  const list = useMemo(() => {
    let r = rooms.filter(
      (x) => (type === 'All' || x.type === type) && x.price <= priceCap && x.guests >= search.guests
    )
    if (sort === 'price-asc') r = [...r].sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') r = [...r].sort((a, b) => b.price - a.price)
    if (sort === 'rating') r = [...r].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    return r
  }, [rooms, type, priceCap, sort, search.guests])

  const reset = () => {
    setType('All')
    setMaxPrice(Infinity)
    setSort('recommended')
  }

  return (
    <>
      <PageHeader
        title="Rooms & Suites"
        subtitle="Each space is a quiet celebration of comfort, nature and craft."
        image={images.banner}
      />

      <div className="container overlap-search">
        <SearchBar compact onSearch={() => {}} />
      </div>

      <section className="section section--tight">
        <div className="container rooms-layout">
          <aside className={`filters ${showFilters ? 'is-open' : ''}`}>
            <div className="filters-head">
              <h3>Filters</h3>
              <button className="text-btn" onClick={reset}>Reset</button>
            </div>

            <div className="filter-group">
              <h4>Room Type</h4>
              <div className="chips">
                {['All', ...CATEGORIES].map((t) => (
                  <button
                    key={t}
                    className={`chip ${type === t ? 'is-active' : ''}`}
                    onClick={() => setType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <h4>Max Price / Night</h4>
              <input
                type="range"
                min={10000}
                max={MAX_PRICE}
                step={500}
                value={priceCap}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
              />
              <div className="range-labels">
                <span>{formatLKR(10000)}</span>
                <strong>{formatLKR(priceCap)}</strong>
              </div>
            </div>

            <div className="filter-group filter-note">
              Showing rooms for <strong>{search.guests} guest{search.guests > 1 ? 's' : ''}</strong>.
              Change guests in the search bar above.
            </div>
          </aside>

          <div className="rooms-main">
            <div className="rooms-toolbar">
              <p><strong>{list.length}</strong> room{list.length !== 1 ? 's' : ''} available</p>
              <div className="toolbar-right">
                <button className="btn btn-outline btn-sm filter-toggle" onClick={() => setShowFilters((s) => !s)}>
                  <SlidersHorizontal size={16} /> Filters
                </button>
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="select">
                  <option value="recommended">Recommended</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="page-loading"><span className="spinner" /></div>
            ) : error ? (
              <div className="empty">
                <SearchX size={42} />
                <h3>Couldn't load rooms</h3>
                <p className="muted">Please check your connection and refresh the page.</p>
              </div>
            ) : list.length ? (
              <div className="room-grid room-grid--two">
                {list.map((r, i) => (
                  <Reveal key={r.id} variant="left" delay={(i % 2) * 160}>
                    <RoomCard room={r} />
                  </Reveal>
                ))}
              </div>
            ) : (
              <div className="empty">
                <SearchX size={42} />
                <h3>No rooms match your filters</h3>
                <p className="muted">Try a different room type, a higher budget or fewer guests.</p>
                <button className="btn btn-dark" onClick={reset}>Clear Filters</button>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
