import {
  Wifi, AirVent, Tv, Croissant, Wine, Bath, ShowerHead, Waves,
  CookingPot, Car, Sparkles, Sun, Coffee,
} from 'lucide-react'

export const AMENITIES = {
  wifi: { icon: Wifi, label: 'Free Wi-Fi' },
  ac: { icon: AirVent, label: 'Air Conditioning' },
  tv: { icon: Tv, label: 'Smart TV' },
  breakfast: { icon: Croissant, label: 'Breakfast Included' },
  minibar: { icon: Wine, label: 'Mini Bar' },
  bathtub: { icon: Bath, label: 'Soaking Tub' },
  shower: { icon: ShowerHead, label: 'Rain Shower' },
  pool: { icon: Waves, label: 'Private Pool' },
  kitchen: { icon: CookingPot, label: 'Kitchenette' },
  parking: { icon: Car, label: 'Free Parking' },
  spa: { icon: Sparkles, label: 'Spa Ritual' },
  balcony: { icon: Sun, label: 'Private Balcony' },
  coffee: { icon: Coffee, label: 'Coffee Maker' },
}

export default function Amenity({ id, showLabel = true }) {
  const a = AMENITIES[id]
  if (!a) return null
  const Icon = a.icon
  return (
    <div className="amenity" title={a.label}>
      <span className="amenity-icon"><Icon size={18} /></span>
      {showLabel && <span>{a.label}</span>}
    </div>
  )
}
