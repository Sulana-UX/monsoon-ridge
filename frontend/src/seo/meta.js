/*
 * Page titles, descriptions and structured data for search engines and link previews.
 * Plain JS with no browser APIs: used by the site (components/RouteSeo.jsx) AND by the
 * build step (scripts/seo-build.mjs), which writes one HTML file per page with these tags
 * already in it, for WhatsApp / Facebook previews (they don't run JavaScript).
 */

export const SITE = {
  name: 'Monsoon Ridge Jungle Resort & Spa',
  short: 'Monsoon Ridge',
  description: 'A jungle resort in Ella, Sri Lanka: garden rooms, river-view suites and private villas, an Ayurveda spa and mountain views. Book direct for the best rate.',
  image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&h=630&q=80',
  phone: '+94 11 234 5678',
  email: 'stay@monsoonridge.lk',
  street: '18 Cliffside Road',
  city: 'Ella',
  country: 'LK',
  checkIn: '14:00',
  checkOut: '11:00',
}

export const DEFAULT_URL = 'https://monsoon-ridge.web.app'
export const cleanUrl = (u) => (u || DEFAULT_URL).replace(/\/+$/, '')

/** Pages search engines should not list (accounts, payments, staff). */
const PRIVATE = ['/admin', '/my-bookings', '/booking/', '/confirmation/', '/invoice/', '/review/', '/login', '/register']
export const isPrivate = (path) => PRIVATE.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p || path.startsWith(`${p}/`)))

const clip = (s, n = 158) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…`
}
const lkr = (n) => 'LKR ' + Math.round(n || 0).toLocaleString('en-US')

const STATIC = {
  '/': { title: `${SITE.name} | Ella, Sri Lanka`, description: SITE.description },
  '/rooms': { title: `Rooms & Suites | ${SITE.short}, Ella`, description: 'Garden rooms, river-view suites, family villas and a honeymoon suite in the hills of Ella. Compare rooms, see live availability and book direct.' },
  '/contact': { title: `Contact Us | ${SITE.short}`, description: `Questions about your stay, airport transfers or special occasions? Call ${SITE.phone}, email ${SITE.email} or send us a message. ${SITE.street}, ${SITE.city}.` },
}

/** Meta for one room page. */
export function roomMeta(room) {
  const facts = [room.view, room.beds, room.guests && `up to ${room.guests} guests`, room.size && `${room.size} m²`].filter(Boolean).join(' · ')
  return {
    title: `${room.name} | ${SITE.short}, Ella`,
    description: clip(`${room.short || room.description || ''} ${facts}. From ${lkr(room.price)} a night.`),
    image: room.image || room.gallery?.[0] || SITE.image,
    path: `/rooms/${room.id}`,
  }
}

/**
 * { title, description, image, path, noindex } for any path.
 * rooms = live room list (for /rooms/:id); unknown pages are noindex.
 */
export function metaFor(path, rooms = []) {
  const p = path.length > 1 ? path.replace(/\/+$/, '') : path
  if (STATIC[p]) return { ...STATIC[p], image: SITE.image, path: p, noindex: false }
  const m = /^\/rooms\/([a-z0-9-]+)$/.exec(p)
  if (m) {
    const room = rooms.find((r) => r.id === m[1])
    if (room) return { ...roomMeta(room), noindex: room.active === false }
  }
  if (isPrivate(p)) {
    const label = p.startsWith('/admin') ? 'Dashboard' : p.startsWith('/my-bookings') ? 'My Bookings' : p.startsWith('/login') ? 'Sign in'
      : p.startsWith('/register') ? 'Create account' : p.startsWith('/invoice') ? 'Invoice' : p.startsWith('/review') ? 'Your review' : 'Booking'
    return { title: `${label} | ${SITE.short}`, description: SITE.description, image: SITE.image, path: p, noindex: true }
  }
  return { title: `Page not found | ${SITE.short}`, description: SITE.description, image: SITE.image, path: p, noindex: true }
}

/** schema.org Hotel: name, address, phone, check-in times, price range. */
export function hotelJsonLd(url, rooms = []) {
  const prices = rooms.filter((r) => r.active !== false && r.price).map((r) => r.price)
  return {
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name: SITE.name,
    url: `${url}/`,
    image: SITE.image,
    description: SITE.description,
    telephone: SITE.phone,
    email: SITE.email,
    address: { '@type': 'PostalAddress', streetAddress: SITE.street, addressLocality: SITE.city, addressCountry: SITE.country },
    checkinTime: SITE.checkIn,
    checkoutTime: SITE.checkOut,
    ...(prices.length && { priceRange: `${lkr(Math.min(...prices))} – ${lkr(Math.max(...prices))} per night` }),
    amenityFeature: ['Free Wi-Fi', 'Ayurveda spa', 'Outdoor pool', 'Restaurant', 'Airport transfers'].map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
  }
}

/** Home › Rooms › Room name, for the room pages. */
export function breadcrumbJsonLd(url, room) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${url}/` },
      { '@type': 'ListItem', position: 2, name: 'Rooms & Suites', item: `${url}/rooms` },
      { '@type': 'ListItem', position: 3, name: room.name, item: `${url}/rooms/${room.id}` },
    ],
  }
}
