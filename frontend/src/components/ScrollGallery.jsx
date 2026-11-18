import { useEffect, useRef } from 'react'
import Reveal from './Reveal'

/*
 * Pinned horizontal gallery.
 * When the section reaches the top of the screen it stays pinned; scrolling down then
 * slides the photos right-to-left. Only after the last photo has arrived does the page
 * carry on scrolling down.
 *
 * The section is made taller by exactly the horizontal distance to travel, and an inner
 * sticky panel holds the photos in place while that extra height is scrolled through.
 * - The card nearest the centre grows and brightens; cards towards the edges recede.
 * - Each photo drifts inside its frame (parallax) for a sense of depth.
 */
export default function ScrollGallery({ eyebrow, title, items }) {
  const sectionRef = useRef(null)
  const trackRef = useRef(null)
  const barRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    const track = trackRef.current
    if (!section || !track) return

    let raf = 0
    let current = null
    let running = false
    let startX = 0
    let travel = 0

    // Work out how far the track must slide: from the first card centred to the last card centred
    const measure = () => {
      const vw = window.innerWidth
      const cards = track.children
      if (!cards.length) return
      const first = cards[0]
      const last = cards[cards.length - 1]
      startX = vw / 2 - (first.offsetLeft + first.offsetWidth / 2)
      const endX = vw / 2 - (last.offsetLeft + last.offsetWidth / 2)
      travel = Math.max(0, startX - endX)
      section.style.height = `${window.innerHeight + travel}px`
    }

    const frame = () => {
      const vh = window.innerHeight
      const vw = window.innerWidth
      const pinLength = section.offsetHeight - vh
      const progress = pinLength > 0 ? Math.min(1, Math.max(0, -section.getBoundingClientRect().top / pinLength)) : 0
      const target = startX - progress * travel

      current = current === null ? target : current + (target - current) * 0.14
      track.style.transform = `translate3d(${current.toFixed(1)}px, 0, 0)`
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress.toFixed(3)})`

      const mid = vw / 2
      for (const el of track.children) {
        const r = el.getBoundingClientRect()
        const d = Math.max(-1, Math.min(1, (r.left + r.width / 2 - mid) / (vw * 0.65)))
        el.style.setProperty('--d', d.toFixed(3))
        el.style.setProperty('--a', (1 - Math.abs(d)).toFixed(3))
      }

      if (running) raf = requestAnimationFrame(frame)
    }

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) {
        running = true
        raf = requestAnimationFrame(frame)
      } else if (!entry.isIntersecting) {
        running = false
        cancelAnimationFrame(raf)
      }
    })

    const onResize = () => {
      measure()
      current = null
    }

    measure()
    frame()
    io.observe(section)
    window.addEventListener('resize', onResize)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('resize', onResize)
      section.style.height = ''
    }
  }, [items])

  return (
    <section className="scroll-gallery" ref={sectionRef}>
      <div className="sg-sticky">
        <div className="container">
          <Reveal className="section-head section-head--center sg-head">
            <span className="eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </Reveal>
        </div>
        <div className="sg-track" ref={trackRef}>
          {items.map((it, i) => (
            <figure key={i} className="sg-item">
              <div className="sg-frame">
                <img src={it.src} alt={it.caption} />
              </div>
              <figcaption>
                <span className="sg-num">{String(i + 1).padStart(2, '0')}</span>
                {it.caption}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="container">
          <div className="sg-progress"><span ref={barRef} /></div>
        </div>
      </div>
    </section>
  )
}
