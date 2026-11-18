import { useEffect, useRef, useState } from 'react'

/*
 * Animates its children into view the first time they scroll onto the screen.
 * variant: 'up' (rise), 'left' (slide in from the right, moving left),
 *          'zoom' (scale in), 'wipe' (image uncovers right-to-left)
 */
export default function Reveal({ as: Tag = 'div', variant = 'up', delay = 0, className = '', style, children, ...rest }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      // wipe targets are clipped to a thin sliver, so any visible pixel counts for them
      { threshold: variant === 'wipe' ? 0 : 0.12, rootMargin: '0px 0px -60px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [variant])

  return (
    <Tag
      ref={ref}
      className={`reveal reveal--${variant} ${shown ? 'is-visible' : ''} ${className}`}
      style={{ '--reveal-delay': `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
