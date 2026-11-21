import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useRooms } from '../context/RoomsContext'
import { metaFor, hotelJsonLd, breadcrumbJsonLd, cleanUrl } from '../seo/meta'

const SITE_URL = cleanUrl(import.meta.env.VITE_SITE_URL)

function setTag(selector, create, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement(create)
    document.head.appendChild(el)
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
}
const meta = (key, content, attr = 'name') => setTag(`meta[${attr}="${key}"]`, 'meta', { [attr]: key, content })

/** Keeps <title>, description, canonical link, robots, link-preview tags and JSON-LD in step with the page. */
export default function RouteSeo() {
  const { pathname } = useLocation()
  const { rooms, loading } = useRooms()

  useEffect(() => {
    const m = metaFor(pathname, rooms)
    // a room page while rooms are still loading: keep what the server-built HTML already had
    if (loading && /^\/rooms\/.+/.test(pathname)) return
    const url = `${SITE_URL}${m.path === '/' ? '/' : m.path}`

    document.title = m.title
    meta('description', m.description)
    meta('robots', m.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
    setTag('link[rel="canonical"]', 'link', { rel: 'canonical', href: url })
    meta('og:title', m.title, 'property')
    meta('og:description', m.description, 'property')
    meta('og:url', url, 'property')
    meta('og:image', m.image, 'property')
    meta('og:type', 'website', 'property')
    meta('twitter:title', m.title)
    meta('twitter:description', m.description)
    meta('twitter:image', m.image)

    const room = /^\/rooms\/([a-z0-9-]+)$/.exec(pathname) && rooms.find((r) => r.id === pathname.split('/')[2])
    const data = m.noindex ? null : room ? [hotelJsonLd(SITE_URL, rooms), breadcrumbJsonLd(SITE_URL, room)] : [hotelJsonLd(SITE_URL, rooms)]
    let ld = document.getElementById('ld-json')
    if (!data) ld?.remove()
    else {
      if (!ld) {
        ld = document.createElement('script')
        ld.type = 'application/ld+json'
        ld.id = 'ld-json'
        document.head.appendChild(ld)
      }
      ld.textContent = JSON.stringify(data.length === 1 ? data[0] : data)
    }
  }, [pathname, rooms, loading])

  return null
}
