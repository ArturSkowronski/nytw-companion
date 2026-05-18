'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type View = 'timeline' | 'map'

export function ViewToggle() {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const active: View = params.get('view') === 'map' ? 'map' : 'timeline'

  function setView(next: View) {
    const updated = new URLSearchParams(params.toString())
    if (next === 'map') updated.set('view', 'map')
    else updated.delete('view')
    const qs = updated.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div
      className="inline-flex rounded-md border border-[#2A2A2A] bg-[#111111] p-0.5"
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
            ? 'bg-[#FF6B35] text-white'
            : 'text-[#A3A3A3] hover:text-[#FAFAFA]')
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
            ? 'bg-[#FF6B35] text-white'
            : 'text-[#A3A3A3] hover:text-[#FAFAFA]')
        }
      >
        Map
      </button>
    </div>
  )
}
