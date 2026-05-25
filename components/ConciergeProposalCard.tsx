'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatEventTime } from '@/lib/events'
import type { Event } from '@/lib/types'
import type { Proposal } from '@/lib/concierge-schema'

const PRIORITY_TONE: Record<Proposal['priority'], string> = {
  'must-attend': 'bg-[#FF6B35]/20 text-[#FF6B35] border-[#FF6B35]/40',
  'high':        'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'medium':      'bg-[#1A1A1A] text-[#A3A3A3] border-[#2A2A2A]',
}

interface ConciergeProposalCardProps {
  event: Event
  proposal: Proposal
  accepted: boolean
  skipped: boolean
  onAccept: () => void
  onSkip: () => void
}

export function ConciergeProposalCard({
  event,
  proposal,
  accepted,
  skipped,
  onAccept,
  onSkip,
}: ConciergeProposalCardProps) {
  return (
    <div
      className={
        `bg-[#111111] border border-[#1A1A1A] rounded-md p-5 space-y-3 transition-opacity ` +
        (skipped ? 'opacity-40' : '')
      }
    >
      <div className="flex flex-wrap items-start gap-2">
        <Badge className={`text-[10px] ${PRIORITY_TONE[proposal.priority]}`}>
          {proposal.priority}
        </Badge>
        {proposal.is_stretch && (
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px]">
            Stretch
          </Badge>
        )}
      </div>

      <div>
        <p className="font-mono text-base font-bold text-[#FAFAFA]">{event.title}</p>
        <p className="text-xs text-[#A3A3A3] mt-1">
          {event.host} · {formatEventTime(event.starts_at, event.ends_at)}
          {event.neighborhood ? ` · ${event.neighborhood}` : ''}
        </p>
      </div>

      <div className="bg-[#0F0F0F] border-l-2 border-[#FF6B35]/40 pl-3 py-2">
        <p className="text-[10px] font-mono text-[#7A7A7A] uppercase tracking-widest mb-1">
          Why for you
        </p>
        <p className="text-sm text-[#A3A3A3]">{proposal.reasoning}</p>
      </div>

      {accepted ? (
        <p className="text-xs font-mono text-emerald-400">
          Added ✓ —{' '}
          <Link href="/my-plan" className="underline hover:text-emerald-300">
            see /my-plan
          </Link>
        </p>
      ) : (
        <div className="flex gap-2">
          <Button
            onClick={onAccept}
            className="bg-[#FF6B35] hover:bg-[#e85a25] text-white font-mono text-sm"
          >
            Accept
          </Button>
          <Button
            onClick={onSkip}
            variant="outline"
            className="border-[#333333] text-[#A3A3A3] hover:bg-[#1A1A1A] font-mono text-sm"
          >
            Skip
          </Button>
        </div>
      )}
    </div>
  )
}
