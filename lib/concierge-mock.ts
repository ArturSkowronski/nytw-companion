import type { Event } from './types'
import type { Proposal } from './concierge-schema'

const MOCK_NOTE =
  'Mock proposals (ANTHROPIC_API_KEY not configured — set it for real suggestions).'

export function buildMockProposals(
  candidates: Event[],
  count: number,
): { proposals: Proposal[]; notes: string } {
  const byStart = (a: Event, b: Event) =>
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()

  const picks = candidates.filter((e) => e.is_editors_pick).slice().sort(byStart)
  const rest = candidates.filter((e) => !e.is_editors_pick).slice().sort(byStart)
  const chosen = [...picks, ...rest].slice(0, count)

  const proposals: Proposal[] = chosen.map((event, idx) => ({
    event_id: event.id,
    reasoning: 'Editor pick — featured curated event for Tech Week.',
    priority: idx === 0 ? 'must-attend' : 'medium',
    is_stretch: false,
  }))

  return { proposals, notes: MOCK_NOTE }
}
