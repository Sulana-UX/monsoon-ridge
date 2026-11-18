import { useEffect, useState } from 'react'

/*
 * Tropical resort at dusk: evening falls, then the cabana's own lights come on.
 *
 * The scene is drawn in a frame that keeps the photo's exact aspect ratio, so every
 * light is pinned to a real spot in the picture (in % of the photo). The photo is
 * mirrored so the lit cabana sits on the right, clear of the headline.
 * "Lit" layers reuse the original photo, warm-graded and masked around each light,
 * so the light falls on the photo's real timber, thatch and water.
 */

// Positions in % of the original photo (3456 × 2304), before mirroring
const LAMP = { x: 22.8, y: 57.2 } // wall lantern on the front of the main cabana

// Every visible light source: x/y in % of the photo, s = halo size, delay = switch-on time
const LAMPS = [
  { x: LAMP.x, y: LAMP.y, s: 1.2, delay: 4.6 },  // main cabana wall lantern
  { x: 36.8, y: 56.6, s: 0.9, delay: 5.2 },      // main cabana porch, by the door
  { x: 69.4, y: 51.4, s: 0.75, delay: 6.5 },     // lantern under the 1st umbrella
  { x: 79, y: 51.4, s: 0.75, delay: 6.8 },       // 2nd umbrella
  { x: 91.8, y: 51, s: 0.75, delay: 7.1 },       // 3rd umbrella
  { x: 32.6, y: 58.4, s: 0.7, delay: 5.4 },      // cabana side wall sconce
]

// Small sconces set into the stone wall beside the pool deck, plus the deck's far edge
const WALL_LAMPS = [
  { x: 3, y: 76.6, delay: 7.6 },
  { x: 9.5, y: 76.4, delay: 7.75 },
  { x: 16, y: 76.2, delay: 7.9 },
  { x: 22.5, y: 76, delay: 8.05 },
  { x: 40, y: 74.4, delay: 8.2 },
  { x: 49, y: 72.6, delay: 8.35 },
]

const ellipse = (x, y, rx, ry, core = 0, mid = 0.55) =>
  `radial-gradient(ellipse ${rx}% ${ry}% at ${x}% ${y}%, #000 ${core}%, rgba(0,0,0,${mid}) 45%, transparent 100%)`

const LIGHTS = [
  // lantern spill across the cabana's timber wall, eave and deck
  { key: 'lamp', tone: 'warm', delay: 4.6, mask: ellipse(LAMP.x + 1, LAMP.y + 2.5, 10, 8.5, 10, 0.6) },
  // porch light by the door washes the eave and the loungers
  { key: 'porch', tone: 'warm', delay: 5.2, mask: ellipse(37, 59, 6.5, 5.5, 8, 0.55) },
  // the cabana's two windows glow from inside
  {
    key: 'windows', tone: 'room', delay: 5.5,
    mask: [ellipse(19.7, 62.6, 2.4, 3.6, 45, 0.8), ellipse(26.2, 60, 2.4, 3, 45, 0.8)].join(','),
  },
  // middle cabana veranda: soft glow only, no visible bulb (it sits behind the headline)
  { key: 'porch-mid', tone: 'warm', delay: 6.0, mask: ellipse(52, 57, 7, 3.5, 20, 0.5) },
  // lanterns under the orange umbrellas make the canopies glow
  {
    key: 'umbrellas', tone: 'warm', delay: 6.5,
    mask: [ellipse(69.4, 50.5, 4.5, 3.6, 25, 0.7), ellipse(79, 50.5, 4.5, 3.6, 25, 0.7), ellipse(91.8, 50, 4.5, 3.6, 25, 0.7)].join(','),
  },
  // cabana side-wall sconce washes the timber
  { key: 'cabana-wall', tone: 'warm', delay: 5.4, mask: ellipse(32.6, 60.5, 4, 5, 15, 0.6) },
  // underwater pool lights: whole pool lit, brightest near the middle
  { key: 'pool', tone: 'pool', delay: 7.4, mask: ellipse(58, 85, 50, 24, 30, 0.7) },
  { key: 'pool-core', tone: 'pool-core', delay: 7.8, mask: ellipse(55, 87, 26, 12, 15, 0.5) },
  // wall sconces wash the stone downwards
  {
    key: 'wall', tone: 'warm', delay: 7.6,
    mask: WALL_LAMPS.map((l) => ellipse(l.x, l.y + 2, 2.6, 3, 8, 0.45)).join(','),
  },
]

export default function NightScene({ image, night, onReady }) {
  const bg = { backgroundImage: `url(${image})` }
  const [loaded, setLoaded] = useState(false)

  // Wait for the photo before starting, so visitors always see daylight first
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      setLoaded(true)
      onReady?.()
    }
    img.src = image
    return () => { img.onload = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image])

  return (
    <div className={`hero-scene ${loaded ? 'is-loaded' : ''} ${night ? 'is-night' : ''}`} aria-hidden="true">
      <div className="scene-frame">
        <div className="scene-flip">
          <div className="sf-layer sf-base" style={bg} />
          <div className="sf-layer sf-dusk" />
          <div className="sf-layer sf-night" />

          {LIGHTS.map((l) => (
            <div
              key={l.key}
              className={`sf-layer sf-lit sf-lit--${l.tone}`}
              style={{ ...bg, WebkitMaskImage: l.mask, maskImage: l.mask, '--delay': `${l.delay}s` }}
            />
          ))}

          {LAMPS.map((l, i) => (
            <div
              key={i}
              className="lamp"
              style={{ left: `${l.x}%`, top: `${l.y}%`, '--delay': `${l.delay}s`, '--s': l.s }}
            >
              <span className="lamp-halo" />
              <span className="lamp-bulb" />
            </div>
          ))}

          {WALL_LAMPS.map((l, i) => (
            <div
              key={`w${i}`}
              className="lamp lamp--wall"
              style={{ left: `${l.x}%`, top: `${l.y}%`, '--delay': `${l.delay}s`, '--s': 0.45 }}
            >
              <span className="lamp-halo" />
              <span className="lamp-bulb" />
            </div>
          ))}
        </div>
      </div>
      <div className="hero-overlay" />
    </div>
  )
}
