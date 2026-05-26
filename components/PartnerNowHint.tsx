// Contextual hint shown on /now (festival mode) when "today" in NYC is
// Tuesday Jun 2 2026 — the day both VirtusLab sessions run — and neither
// session is in the user's plan yet. Subtle inline strip, not a banner;
// dismissable in one click; never repeats once any of the two events are
// added (or once the user dismisses).
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { format as formatTz, toZonedTime } from 'date-fns-tz'
import { usePlanStore } from '@/lib/plan-store'

const NYC_TZ = 'America/New_York'
const HOSTED_DATE = '2026-06-02' // NYC date for both VL sessions
const HOSTED_IDS = new Set([
  'partiful-m7pxmv8soxt11yhb9pkw',
  'partiful-bn5h1g13xzov6r5xklae',
])
const DISMISS_KEY = 'nytw-vl-now-hint-dismissed'

interface Props {
  now: Date
}

export function PartnerNowHint({ now }: Props) {
  const items = usePlanStore((s) => s.items)
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect -- standard SSR hydration guard; single synchronous batch on mount, no cascading risk */
  useEffect(() => {
    setMounted(true)
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!mounted || dismissed) return null

  // Only show on the actual day.
  const todayKey = formatTz(toZonedTime(now, NYC_TZ), 'yyyy-MM-dd', { timeZone: NYC_TZ })
  if (todayKey !== HOSTED_DATE) return null

  // Suppress once the user has either session in their plan.
  const planned = items.some((it) => HOSTED_IDS.has(it.event_id) && it.status !== 'declined')
  if (planned) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <aside
      className="bg-[#0B0B0B] border border-[#1A1A1A] border-l-2 border-l-[#92C83E] rounded-md px-4 py-3 flex items-start justify-between gap-3"
      aria-label="Also today — VirtusLab sessions"
    >
      <p className="text-xs text-[#9B9B9B] font-mono leading-relaxed">
        Also today, hosted by us:{' '}
        <Link href="/#meet-us" className="text-[#F5F5F5] hover:text-[#92C83E] underline underline-offset-4 decoration-[#262626] hover:decoration-[#92C83E]">
          Book launch · 12 PM
        </Link>
        {' / '}
        <Link href="/#meet-us" className="text-[#F5F5F5] hover:text-[#92C83E] underline underline-offset-4 decoration-[#262626] hover:decoration-[#92C83E]">
          Visdom session · 4 PM
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-[#737373] hover:text-[#F5F5F5] font-mono text-xs shrink-0"
      >
        ✕
      </button>
    </aside>
  )
}
