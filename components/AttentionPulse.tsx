// Wraps its children in a span that gets the `attention-pulse-once` class
// the first time it scrolls into view. Animation defined in globals.css runs
// for 1.5s, exactly once. Respects prefers-reduced-motion.
'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Disable entirely if the page is already past the section on load. */
  threshold?: number
}

export function AttentionPulse({ children, threshold = 0.4 }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [pulse, setPulse] = useState(false)
  const firedRef = useRef(false)

  useEffect(() => {
    if (!ref.current || firedRef.current) return
    if (typeof IntersectionObserver === 'undefined') return
    const el = ref.current
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            firedRef.current = true
            setPulse(true)
            obs.disconnect()
          }
        }
      },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return (
    <span ref={ref} className={pulse ? 'attention-pulse-once inline-block' : 'inline-block'}>
      {children}
    </span>
  )
}
