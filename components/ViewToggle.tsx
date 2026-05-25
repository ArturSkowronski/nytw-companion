'use client'

import { useEffect, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { isTypingTarget } from '@/lib/keyboard'

type View = 'timeline' | 'map'

export function ViewToggle() {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const active: View = params.get('view') === 'map' ? 'map' : 'timeline'

  const setView = useCallback((next: View) => {
    const updated = new URLSearchParams(params.toString())
    if (next === 'map') updated.set('view', 'map')
    else updated.delete('view')
    const qs = updated.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [params, router, pathname])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== 'm' && e.key !== 'M') return
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      setView(active === 'map' ? 'timeline' : 'map')
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [active, setView])

  return (
    <div
      className="inline-flex rounded-md border border-[#262626] bg-[#0B0B0B] p-0.5"
      role="group"
      aria-label="View"
    >
      <button
        type="button"
        aria-pressed={active === 'timeline'}
        onClick={() => setView('timeline')}
        className={
          `font-mono text-xs px-3 py-1.5 rounded transition-colors ` +
          (active === 'timeline'
            ? 'bg-[#FF5B25] text-white'
            : 'text-[#9B9B9B] hover:text-[#F5F5F5]')
        }
      >
        Timeline
      </button>
      <button
        type="button"
        aria-pressed={active === 'map'}
        onClick={() => setView('map')}
        className={
          `font-mono text-xs px-3 py-1.5 rounded transition-colors ` +
          (active === 'map'
            ? 'bg-[#FF5B25] text-white'
            : 'text-[#9B9B9B] hover:text-[#F5F5F5]')
        }
      >
        Map
      </button>
    </div>
  )
}
