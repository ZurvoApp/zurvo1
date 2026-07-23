'use client'

import { useEffect, useRef } from 'react'

/* Reveals its children one after another as it scrolls into view.
   `i` sets the stagger position; the delay is applied in CSS via --i. */
export default function Reveal({ children, i = 0, as: Tag = 'div', className = '', ...rest }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('in')
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('in')
          io.unobserve(el) // reveal once — re-animating on scroll-back is nausea, not delight
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ '--i': i }} {...rest}>
      {children}
    </Tag>
  )
}
