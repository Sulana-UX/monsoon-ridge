// Starter content. Rooms are managed in the admin dashboard (Firestore `rooms`);
// this `rooms` list is only used once by backend/server/scripts/seed-rooms.js.
const u = (id, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`

export const rooms = [
  {
    id: 'deluxe-garden',
    name: 'Deluxe Garden Room',
    type: 'Deluxe',
    price: 18500,
    size: 32,
    guests: 2,
    units: 6, // rooms of this type (keep in sync with backend/functions/src/rooms.js)
    beds: '1 King Bed',
    view: 'Garden View',
    rating: 4.7,
    reviews: 128,
    featured: true,
    image: u('photo-1611892440504-42a792e24d32'),
    gallery: [
      u('photo-1611892440504-42a792e24d32'),
      u('photo-1791444057586-ee2fe9a19571'),
      u('photo-1778500442301-1bb412cce15f'),
      u('photo-1778500442168-351b5e96b6f6'),
    ],
    short: 'A calm retreat opening onto lush tropical gardens.',
    description:
      'Wake up to birdsong in our Deluxe Garden Room. Warm timber floors, handwoven textiles and a private terrace that opens onto the hotel gardens make this the perfect hideaway for couples.',
    amenities: ['wifi', 'ac', 'tv', 'breakfast', 'minibar', 'shower'],
  },
  {
    id: 'river-view-suite',
    name: 'River View Suite',
    type: 'Suite',
    price: 32000,
    size: 54,
    guests: 3,
    units: 4, // rooms of this type (keep in sync with backend/functions/src/rooms.js)
    beds: '1 King + 1 Sofa Bed',
    view: 'River View',
    rating: 4.9,
    reviews: 214,
    featured: true,
    image: u('photo-1774280954999-9758f11f3d41'),
    gallery: [
      u('photo-1774280954999-9758f11f3d41'),
      u('photo-1759303313556-bd9a18a9e108'),
      u('photo-1791535767615-2fb43a41e8a8'),
      u('photo-1684262206285-f853809d7473'),
    ],
    short: 'Floor-to-ceiling windows framing the slow-moving river.',
    description:
      'Our signature suite with a separate living area and floor-to-ceiling windows overlooking the river. Watch the sunset from your private balcony, then unwind in the deep soaking tub.',
    amenities: ['wifi', 'ac', 'tv', 'breakfast', 'minibar', 'bathtub', 'balcony', 'coffee'],
  },
  {
    id: 'family-villa',
    name: 'Family Pool Villa',
    type: 'Villa',
    price: 54000,
    size: 110,
    guests: 5,
    units: 2, // rooms of this type (keep in sync with backend/functions/src/rooms.js)
    beds: '2 King Beds + 1 Single',
    view: 'Private Pool',
    rating: 4.8,
    reviews: 96,
    featured: true,
    image: u('photo-1605538032432-a9f0c8d9baac'),
    gallery: [
      u('photo-1605538032432-a9f0c8d9baac'),
      u('photo-1566073771259-6a8506099945'),
      u('photo-1774280954999-9758f11f3d41'),
      u('photo-1778500442315-87726b43656b'),
    ],
    short: 'Two bedrooms and a private plunge pool for the whole family.',
    description:
      'Spacious two-bedroom villa with its own plunge pool, outdoor dining pavilion and a kitchenette. Ideal for families who want room to breathe and memories to share.',
    amenities: ['wifi', 'ac', 'tv', 'breakfast', 'pool', 'kitchen', 'balcony', 'parking'],
  },
  {
    id: 'superior-twin',
    name: 'Superior Twin Room',
    type: 'Standard',
    price: 14500,
    size: 28,
    guests: 2,
    units: 6, // rooms of this type (keep in sync with backend/functions/src/rooms.js)
    beds: '2 Single Beds',
    view: 'Courtyard View',
    rating: 4.5,
    reviews: 167,
    featured: false,
    image: u('photo-1776500587879-5f8acadf4a69'),
    gallery: [
      u('photo-1776500587879-5f8acadf4a69'),
      u('photo-1776500588044-e42853f74ae4'),
      u('photo-1776500587875-8a0653e9c10e'),
    ],
    short: 'Bright and practical, perfect for friends travelling together.',
    description:
      'A bright, thoughtfully designed room with two comfortable single beds, a work desk and a rain shower. Great value for friends or colleagues travelling together.',
    amenities: ['wifi', 'ac', 'tv', 'shower', 'coffee'],
  },
  {
    id: 'honeymoon-suite',
    name: 'Honeymoon Suite',
    type: 'Suite',
    price: 38500,
    size: 60,
    guests: 2,
    units: 2, // rooms of this type (keep in sync with backend/functions/src/rooms.js)
    beds: '1 Canopy King Bed',
    view: 'River & Sunset',
    rating: 5.0,
    reviews: 74,
    featured: true,
    image: u('photo-1791535767615-2fb43a41e8a8'),
    gallery: [
      u('photo-1791535767615-2fb43a41e8a8'),
      u('photo-1774280954999-9758f11f3d41'),
      u('photo-1778500442301-1bb412cce15f'),
    ],
    short: 'Romantic canopy bed, outdoor bath and champagne on arrival.',
    description:
      'Celebrate love in our most romantic space: a canopy king bed, an open-air bathtub under the stars, and a complimentary couples spa ritual on your first evening.',
    amenities: ['wifi', 'ac', 'tv', 'breakfast', 'bathtub', 'balcony', 'minibar', 'spa'],
  },
  {
    id: 'standard-queen',
    name: 'Classic Queen Room',
    type: 'Standard',
    price: 12000,
    size: 24,
    guests: 2,
    units: 8, // rooms of this type (keep in sync with backend/functions/src/rooms.js)
    beds: '1 Queen Bed',
    view: 'Garden View',
    rating: 4.4,
    reviews: 201,
    featured: false,
    image: u('photo-1662841540530-2f04bb3291e8'),
    gallery: [
      u('photo-1662841540530-2f04bb3291e8'),
      u('photo-1776500587875-8a0653e9c10e'),
      u('photo-1776500588044-e42853f74ae4'),
    ],
    short: 'Cosy comfort at an easy price, with everything you need.',
    description:
      'Our cosy Classic Queen Room offers a plush queen bed, blackout curtains and a modern bathroom: everything you need for a restful stay at a great price.',
    amenities: ['wifi', 'ac', 'tv', 'shower'],
  },
]

export const roomTypes = ['All', 'Standard', 'Deluxe', 'Suite', 'Villa']

export const images = {
  // Tropical resort with cabanas and karst mountains (3456 × 2304, uncropped so lights stay pinned)
  hero: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&w=2400&q=80',
  exterior: u('photo-1684262206285-f853809d7473', 1400),
  lobby: u('photo-1778500442168-351b5e96b6f6', 1200),
  resort: u('photo-1759303313556-bd9a18a9e108', 2000),
  spa: u('photo-1778500442301-1bb412cce15f', 1000),
  dining: u('photo-1414235077428-338989a2e8c0', 1000),
  pool: u('photo-1566073771259-6a8506099945', 1000),
  boats: u('photo-1755891948002-4afec2115be2', 1400),
  banner: u('photo-1605538032432-a9f0c8d9baac', 2000),
}

export const galleryItems = [
  { src: u('photo-1520250497591-112f2f40a3f4', 900), caption: 'The lagoon pool' },
  { src: u('photo-1684262206285-f853809d7473', 900), caption: 'Beneath the limestone cliffs' },
  { src: u('photo-1605538032432-a9f0c8d9baac', 900), caption: 'Palm-shaded villas' },
  { src: u('photo-1759303313556-bd9a18a9e108', 900), caption: 'Morning mist on the river' },
  { src: u('photo-1774280954999-9758f11f3d41', 900), caption: 'Rooms open to the jungle' },
  { src: u('photo-1778500442301-1bb412cce15f', 900), caption: 'The water garden' },
  { src: u('photo-1755891948002-4afec2115be2', 900), caption: 'Longtail boat trips' },
  { src: u('photo-1791535767615-2fb43a41e8a8', 900), caption: 'The Honeymoon Suite' },
  { src: u('photo-1778500442168-351b5e96b6f6', 900), caption: 'Sunlit pavilions' },
]

export const testimonials = [
  {
    name: 'Nadeesha Perera',
    from: 'Colombo, Sri Lanka',
    text: 'Absolutely magical. The river view suite was spotless and the staff remembered our names from day one. We are already planning our next visit!',
    rating: 5,
  },
  {
    name: 'James Whitfield',
    from: 'London, UK',
    text: 'The best breakfast I had in all of Sri Lanka, and the sunset from the balcony is something I will never forget. Truly a hidden gem.',
    rating: 5,
  },
  {
    name: 'Aisha Rahman',
    from: 'Dubai, UAE',
    text: 'Our kids loved the private pool villa. Calm, safe and beautifully designed. Booking was effortless and check-in took two minutes.',
    rating: 5,
  },
]
