'use client'

import { ConciergeProposalCard } from '@/components/ConciergeProposalCard'
import { Button } from '@/components/ui/button'
import type { Event } from '@/lib/types'
import type { Proposal } from '@/lib/concierge-schema'

interface ConciergeProposalsProps {
  proposals: Proposal[]
  events: Event[]
  notes: string | null
  acceptedIds: ReadonlySet<string>
  skippedIds: ReadonlySet<string>
  onAccept: (eventId: string) => void
  onSkip: (eventId: string) => void
  onAddAll: () => void
}

export function ConciergeProposals({
  proposals,
  events,
  notes,
  acceptedIds,
  skippedIds,
  onAccept,
  onSkip,
  onAddAll,
}: ConciergeProposalsProps) {
  const eventById = new Map(events.map((e) => [e.id, e]))
  const renderable = proposals.filter((p) => eventById.has(p.event_id))
  const undecidedCount = renderable.filter(
    (p) => !acceptedIds.has(p.event_id) && !skippedIds.has(p.event_id),
  ).length

  if (renderable.length === 0) {
    return (
      <div className="bg-[#0B0B0B] border border-[#1A1A1A] rounded-md p-6 text-center">
        <p className="font-mono text-sm text-[#9B9B9B]">
          No matches for that profile.
        </p>
        <p className="text-xs text-[#9B9B9B] mt-1">
          Try broader interests, or check{' '}
          <a href="/beyond" className="text-[#FF5B25] hover:underline">
            other aggregators →
          </a>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-sm text-[#F5F5F5]">
          {renderable.length} suggestion{renderable.length !== 1 ? 's' : ''} for you
        </p>
        {undecidedCount > 1 && (
          <Button
            onClick={onAddAll}
            variant="outline"
            className="border-[#FF5B25]/40 text-[#FF5B25] hover:bg-[#FF5B25]/10 font-mono text-sm"
          >
            Add all {undecidedCount} →
          </Button>
        )}
      </div>

      {notes && (
        <p className="text-xs italic text-[#9B9B9B] font-mono">{notes}</p>
      )}

      <div className="grid gap-3">
        {renderable.map((proposal) => {
          const event = eventById.get(proposal.event_id)!
          return (
            <ConciergeProposalCard
              key={proposal.event_id}
              event={event}
              proposal={proposal}
              accepted={acceptedIds.has(proposal.event_id)}
              skipped={skippedIds.has(proposal.event_id)}
              onAccept={() => onAccept(proposal.event_id)}
              onSkip={() => onSkip(proposal.event_id)}
            />
          )
        })}
      </div>
    </div>
  )
}
