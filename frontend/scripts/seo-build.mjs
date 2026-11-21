/*
 * Runs after `vite build` (npm run build). Link previews (WhatsApp, Facebook, X) and some search
 * engines don't run JavaScript, so each public page gets its own HTML file with the right
 * <title>, description, link-preview tags and structured data already in it:
 *
 *   dist/index.html             home
 *   dist/rooms.html             /rooms          (served without ".html": firebase.json cleanUrls)
 *   dist/contact.html           /contact
 *   dist/rooms/<id>.html        /rooms/<id>     one per room shown on the website
 *   dist/sitemap.xml            every public page, for search engines
 *   dist/robots.txt             sitemap address updated to VITE_SITE_URL
 *
 * Rooms come from Firestore (the same public read the website does). If that fails, the
 * starter rooms in src/data/rooms.js are used and a warning is printed; the build still works.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { metaFor, roomMeta, hotelJsonLd, breadcrumbJsonLd, cleanUrl } from '../src/seo/meta.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const env = loadEnv('production', root, 'VITE_')
const SITE_URL = cleanUrl(env.VITE_SITE_URL)

/* ---------- rooms from Firestore (REST, public read: active rooms only) ---------- */

const value = (v) => {
  if (!v) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('timestampValue' in v) return v.timestampValue
  if ('nullValue' in v) return null
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(value)
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, value(x)]))
  return null
}

async function loadRooms() {
  const { VITE_FIREBASE_PROJECT_ID: project, VITE_FIREBASE_API_KEY: key } = env
  try {
    if (!project || !key) throw new Error('VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_API_KEY not set')
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:runQuery?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'rooms' }], where: { fieldFilter: { field: { fieldPath: 'active' }, op: 'EQUAL', value: { booleanValue: true } } } } }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Firestore said ${res.status}`)
    const rows = (await res.json()).filter((r) => r.document)
    const rooms = rows.map((r) => ({ ...value({ mapValue: r.document }), id: r.document.name.split('/').pop(), updated: r.document.updateTime }))
    if (!rooms.length) throw new Error('no rooms returned')
    return rooms
  } catch (e) {
    const { rooms } = await import('../src/data/rooms.js')
    console.warn(`seo-build: couldn't read rooms from Firestore (${e.message}); using the starter rooms instead.`)
    return rooms.map((r) => ({ ...r, active: true }))
  }
}

/* ---------- HTML ---------- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// JSON inside <script>: "<" can't close the tag
const jsonForHtml = (o) => JSON.stringify(o).replace(/</g, '\\u003c')

function render(template, m, jsonLd) {
  const url = `${SITE_URL}${m.path === '/' ? '/' : m.path}`
  const set = (html, re, val) => {
    if (!re.test(html)) throw new Error(`seo-build: index.html is missing ${re}`)
    return html.replace(re, (_, a, b) => `${a}${esc(val)}${b}`)
  }
  let html = template.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(m.title)}</title>`)
  html = set(html, /(<meta name="description" content=")[^"]*(")/, m.description)
  html = set(html, /(<meta name="robots" content=")[^"]*(")/, m.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
  html = set(html, /(<link rel="canonical" href=")[^"]*(")/, url)
  html = set(html, /(<meta property="og:type" content=")[^"]*(")/, 'website')
  html = set(html, /(<meta property="og:title" content=")[^"]*(")/, m.title)
  html = set(html, /(<meta property="og:description" content=")[^"]*(")/, m.description)
  html = set(html, /(<meta property="og:url" content=")[^"]*(")/, url)
  html = set(html, /(<meta property="og:image" content=")[^"]*(")/, m.image)
  html = set(html, /(<meta name="twitter:title" content=")[^"]*(")/, m.title)
  html = set(html, /(<meta name="twitter:description" content=")[^"]*(")/, m.description)
  html = set(html, /(<meta name="twitter:image" content=")[^"]*(")/, m.image)
  if (m.image !== metaFor('/').image) html = html.replace(/\s*<meta property="og:image:(width|height)" content="\d+" \/>/g, '')
  if (jsonLd) html = html.replace('</head>', () => `  <script type="application/ld+json" id="ld-json">${jsonForHtml(jsonLd)}</script>\n  </head>`)
  return html
}

const write = (rel, text) => {
  const file = join(dist, rel)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}

/* ---------- build ---------- */

const template = readFileSync(join(dist, 'index.html'), 'utf8')
const rooms = await loadRooms()
const hotel = hotelJsonLd(SITE_URL, rooms)
const pages = []

for (const path of ['/', '/rooms', '/contact']) {
  const m = metaFor(path, rooms)
  write(path === '/' ? 'index.html' : `${path.slice(1)}.html`, render(template, m, hotel))
  pages.push({ path, priority: path === '/' ? '1.0' : '0.8' })
}
for (const room of rooms) {
  if (!/^[a-z0-9-]{1,40}$/.test(room.id)) continue
  const m = { ...roomMeta(room), noindex: false }
  write(`rooms/${room.id}.html`, render(template, m, [hotel, breadcrumbJsonLd(SITE_URL, room)]))
  pages.push({ path: m.path, priority: room.featured ? '0.9' : '0.7', lastmod: room.updated?.slice(0, 10) })
}

const today = new Date().toISOString().slice(0, 10)
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${esc(SITE_URL + (p.path === '/' ? '/' : p.path))}</loc><lastmod>${p.lastmod || today}</lastmod><priority>${p.priority}</priority></url>`).join('\n')}
</urlset>
`)
write('robots.txt', readFileSync(join(dist, 'robots.txt'), 'utf8').replace(/^Sitemap: .*$/m, `Sitemap: ${SITE_URL}/sitemap.xml`))

console.log(`seo-build: ${pages.length} pages + sitemap.xml for ${SITE_URL} (${rooms.length} rooms)`)
