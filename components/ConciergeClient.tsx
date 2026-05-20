// components/ConciergeClient.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { usePlanStore } from '@/lib/plan-store'
import { ConciergeForm } from '@/components/ConciergeForm'
import { ConciergeProposals } from '@/components/ConciergeProposals'
import type { Event } from '@/lib/types'
import type { Proposal } from '@/lib/concierge-schema'

interface ConciergeClientProps {
  events: Event[]
}

export function ConciergeClient({ events }: ConciergeClientProps) {
  const [mounted, setMounted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposals, setProposals] = useState<Proposal[] | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set())
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())

  const items = usePlanStore((s) => s.items)
  const addItem = usePlanStore((s) => s.addItem)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard SSR hydration guard
  useEffect(() => setMounted(true), [])

  const existingIds = useMemo(() => items.map((i) => i.event_id), [items])

  async function handleSubmit(profileText: string) {
    setSubmitting(true)
    setError(null)
    setProposals(null)
    setNotes(null)
    setAcceptedIds(new Set())
    setSkippedIds(new Set())
    try {
      const res = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profile_text: profileText,
          existing_event_ids: existingIds,
        }),
      })
      if (res.status === 429) {
        const body = (await res.json()) as { retryAfterMs: number }
        const mins = Math.ceil(body.retryAfterMs / 60_000)
        throw new Error(`Too many requests — try again in ${mins} min.`)
      }
      if (!res.ok) {
        throw new Error("Concierge unavailable — please try again.")
      }
      const body = (await res.json()) as { proposals: Proposal[]; notes: string | null }
      setProposals(body.proposals)
      setNotes(body.notes)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach concierge.")
    } finally {
      setSubmitting(false)
    }
  }

  function acceptOne(eventId: string) {
    addItem(eventId, 'interested', 'concierge')
    setAcceptedIds((prev) => new Set(prev).add(eventId))
    toast('Added to plan')
  }

  function skipOne(eventId: string) {
    setSkippedIds((prev) => new Set(prev).add(eventId))
  }

  function addAll() {
    if (!proposals) return
    let added = 0
    const nextAccepted = new Set(acceptedIds)
    for (const p of proposals) {
      if (acceptedIds.has(p.event_id) || skippedIds.has(p.event_id)) continue
      addItem(p.event_id, 'interested', 'concierge')
      nextAccepted.add(p.event_id)
      added += 1
    }
    setAcceptedIds(nextAccepted)
    if (added > 0) toast(`Added ${added} event${added !== 1 ? 's' : ''} to plan`)
  }

  if (!mounted) {
    return (
      <div className="bg-[#111111] border border-[#1A1A1A] rounded-md p-6">
        <p className="font-mono text-sm text-[#666666]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ConciergeForm
        existingCount={items.length}
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
      />

      {proposals !== null && (
        <ConciergeProposals
          proposals={proposals}
          events={events}
          notes={notes}
          acceptedIds={acceptedIds}
          skippedIds={skippedIds}
          onAccept={acceptOne}
          onSkip={skipOne}
          onAddAll={addAll}
        />
      )}
    </div>
  )
}
