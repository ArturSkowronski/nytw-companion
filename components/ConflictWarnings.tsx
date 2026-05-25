'use client'

import { useEffect, useState, type RefObject } from 'react'
import type { ConflictPair } from '@/lib/conflicts'

interface ConflictWarningsProps {
  pairs: ConflictPair[]
  cardRefs: Map<string, RefObject<HTMLDivElement | null>>
  containerRef: RefObject<HTMLDivElement | null>
}

interface BracketBox {
  key: string
  top: number
  height: number
}

export function ConflictWarnings({ pairs, cardRefs, containerRef }: ConflictWarningsProps) {
  const [brackets, setBrackets] = useState<BracketBox[]>([])

  useEffect(() => {
    function recompute() {
      const container = containerRef.current
      if (!container) {
        setBrackets([])
        return
      }
      const containerTop = container.getBoundingClientRect().top
      const next: BracketBox[] = []
      for (const pair of pairs) {
        const aRef = cardRefs.get(pair.a.event_id)
        const bRef = cardRefs.get(pair.b.event_id)
        const aEl = aRef?.current
        const bEl = bRef?.current
        if (!aEl || !bEl) continue
        const aRect = aEl.getBoundingClientRect()
        const bRect = bEl.getBoundingClientRect()
        const top = Math.min(aRect.top, bRect.top) - containerTop
        const bottom = Math.max(aRect.bottom, bRect.bottom) - containerTop
        next.push({
          key: `${pair.a.event_id}~${pair.b.event_id}`,
          top,
          height: bottom - top,
        })
      }
      setBrackets(next)
    }

    recompute()
    const ro = new ResizeObserver(recompute)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', recompute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recompute)
    }
  }, [pairs, cardRefs, containerRef])

  return (
    <>
      {brackets.map((b) => (
        <div
          key={b.key}
          className="pointer-events-none absolute left-0 w-1 border-l-2 border-t-2 border-b-2 border-red-500/60 rounded-sm"
          style={{ top: b.top, height: b.height }}
          aria-hidden="true"
        >
          <span
            className="pointer-events-auto absolute -left-1 -translate-x-full top-1/2 -translate-y-1/2 text-[10px] text-red-400 bg-[#000000] font-mono whitespace-nowrap pr-2"
          >
            Conflict
          </span>
        </div>
      ))}
    </>
  )
}
