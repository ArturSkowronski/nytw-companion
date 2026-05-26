'use client'

import { useEffect, useState } from 'react'
import { SharedPlanView } from '@/components/SharedPlanView'
import { decodePlan } from '@/lib/share-encoding'
import type { Event } from '@/lib/types'

interface SharedPlanClientProps {
  allEvents: Event[]
}

export function SharedPlanClient({ allEvents }: SharedPlanClientProps) {
  const [decoded, setDecoded] = useState<{ ids: string[]; name?: string } | null>(null)

  useEffect(() => {
    const hash = window.location.hash
    const plan = decodePlan(hash)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard SSR hydration guard: reads window.location.hash only after mount
    setDecoded(plan)
  }, [])

  if (!decoded) {
    return (
      <div className="bg-[#0B0B0B] border border-[#1A1A1A] rounded-md p-6">
        <p className="font-mono text-sm text-[#9B9B9B]">Loading shared plan…</p>
      </div>
    )
  }

  return <SharedPlanView ids={decoded.ids} senderName={decoded.name} allEvents={allEvents} />
}
