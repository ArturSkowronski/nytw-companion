// components/MyPlanWidget.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePlanStore } from '@/lib/plan-store'

export function MyPlanWidget() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const { items } = usePlanStore()

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard SSR hydration guard; single synchronous call on mount, no cascading risk
  useEffect(() => setMounted(true), [])

  if (!mounted || items.length === 0 || pathname === '/my-plan') return null

  const recentItems = [...items].reverse().slice(0, 5)

  return (
    <>
      {/* Desktop: bottom-right floating button */}
      <div className="fixed bottom-6 right-6 z-50 hidden sm:flex flex-col items-end gap-2">
        {open && (
          <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-4 w-72 shadow-2xl">
            <p className="text-xs text-[#A3A3A3] font-mono mb-3">
              {items.length} event{items.length !== 1 ? 's' : ''} in your plan
            </p>
            <ul className="space-y-2 mb-3">
              {recentItems.map((item) => (
                <li key={item.event_id} className="text-xs text-[#FAFAFA] font-mono truncate">
                  · {item.event_id}
                </li>
              ))}
            </ul>
            <Link
              href="/my-plan"
              className="text-[#FF6B35] text-xs font-mono hover:underline"
              onClick={() => setOpen(false)}
            >
              Open full plan →
            </Link>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono font-bold text-sm px-4 py-2.5 rounded-full shadow-lg transition-colors flex items-center gap-2"
        >
          <span>My Plan ({items.length})</span>
        </button>
      </div>

      {/* Mobile: bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-[#111111] border-t border-[#2A2A2A]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <span className="font-mono font-bold text-[#FAFAFA] text-sm">
            My Plan ({items.length})
          </span>
          <span className="text-[#FF6B35] font-mono text-xs">
            {open ? 'close ✕' : 'view ›'}
          </span>
        </button>

        {open && (
          <div className="px-4 pb-4 border-t border-[#1A1A1A]">
            <ul className="space-y-2 py-3">
              {recentItems.map((item) => (
                <li key={item.event_id} className="text-xs text-[#A3A3A3] font-mono truncate">
                  · {item.event_id}
                </li>
              ))}
            </ul>
            <Link
              href="/my-plan"
              className="text-[#FF6B35] text-xs font-mono hover:underline"
              onClick={() => setOpen(false)}
            >
              Open full plan →
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
