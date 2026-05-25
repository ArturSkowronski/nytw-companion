'use client'

import { useEffect, useState } from 'react'
import { festivalMode, nowInNYC } from '@/lib/time'

const FESTIVAL_START = new Date('2026-06-01T00:00:00-04:00')

function daysUntil(now: Date): number {
  const diff = FESTIVAL_START.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function formatNYTime(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  }).format(d)
}

export function StatusBar() {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState(() => nowInNYC())

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard SSR hydration guard; single synchronous call on mount, no cascading risk
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const id = setInterval(() => setNow(nowInNYC()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!mounted) return null

  const mode = festivalMode(now)
  let modeLabel: string
  if (mode === 'in') modeLabel = 'Live · Tech Week'
  else if (mode === 'pre') modeLabel = `T-${daysUntil(now)}d`
  else modeLabel = 'Past'

  return (
    <div className="border-b border-[#1A1A1A] bg-black/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#737373]">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="w-1.5 h-1.5 rounded-full bg-[#4CC38A] shadow-[0_0_0_4px_rgba(76,195,138,0.18)] animate-pulse"
          />
          <span className="text-[#4CC38A]">{modeLabel}</span>
        </span>
        <span className="flex-1" />
        <span>NYC · {formatNYTime(now)}</span>
      </div>
    </div>
  )
}
