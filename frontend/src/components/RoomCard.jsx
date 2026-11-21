import { Link } from 'react-router-dom'
import { Star, Users, Maximize, BedDouble, ArrowRight, Heart } from 'lucide-react'
import { useState } from 'react'
import Amenity from './Amenity'
import { formatLKR } from '../utils'

/** left = rooms free for the guest's dates (undefined = unknown, don't show) */
export default function RoomCard({ room, left }) {
  const soldOut = left === 0
  const [liked, setLiked] = useState(false)
  return (
    <article className={`room-card ${soldOut ? 'is-sold-out' : ''}`}>
      <div className="room-card-media">
        <img src={room.image} alt={room.name} loading="lazy" />
        <span className="badge">{room.type}</span>
        {soldOut && <span className="avail-tag avail-tag--out">Sold out for your dates</span>}
        {left > 0 && left <= 2 && <span className="avail-tag">Only {left} left</span>}
        <button
          className={`like ${liked ? 'is-liked' : ''}`}
          onClick={() => setLiked((l) => !l)}
          aria-label="Save to favourites"
        >
          <Heart size={18} />
        </button>
        <div className="room-card-price">
          <strong>{formatLKR(room.price)}</strong>
          <span>/ night</span>
        </div>
      </div>
      <div className="room-card-body">
        <div className="room-card-top">
          <h3>{room.name}</h3>
          <span className="rating">
            {room.reviewCount > 0 ? <><Star size={14} fill="currentColor" /> {room.ratingAvg.toFixed(1)} <small>({room.reviewCount})</small></> : 'New'}
          </span>
        </div>
        <p className="muted">{room.short}</p>
        <div className="room-meta">
          <span><Maximize size={15} /> {room.size} m²</span>
          <span><Users size={15} /> Up to {room.guests}</span>
          <span><BedDouble size={15} /> {room.beds}</span>
        </div>
        <div className="room-card-amenities">
          {room.amenities.slice(0, 5).map((a) => (
            <Amenity key={a} id={a} showLabel={false} />
          ))}
          {room.amenities.length > 5 && <span className="more">+{room.amenities.length - 5}</span>}
        </div>
        <div className="room-card-actions">
          <Link to={`/rooms/${room.id}`} className="btn btn-outline">View Details</Link>
          {soldOut ? (
            <span className="btn btn-dark is-disabled" aria-disabled="true">Sold out</span>
          ) : (
            <Link to={`/booking/${room.id}`} className="btn btn-dark">
              Book Now <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
