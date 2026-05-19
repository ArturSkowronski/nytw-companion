import type { Event, PlanItem } from './types'

export type ConflictPair = { a: PlanItem; b: PlanItem }

const ELIGIBLE_STATUSES: ReadonlySet<PlanItem['status']> = new Set([
  'confirmed',
  'rsvp_pending',
])

export function detectConflicts(items: PlanItem[], events: Event[]): ConflictPair[] {
  const eventById = new Map(events.map((e) => [e.id, e]))

  const eligible = items
    .filter((i) => ELIGIBLE_STATUSES.has(i.status))
    .map((i) => {
      const event = eventById.get(i.event_id)
      if (!event) return null
      return {
        item: i,
        startMs: new Date(event.starts_at).getTime(),
        endMs: new Date(event.ends_at).getTime(),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.startMs - b.startMs)

  const pairs: ConflictPair[] = []
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      if (eligible[j].startMs >= eligible[i].endMs) break
      pairs.push({ a: eligible[i].item, b: eligible[j].item })
    }
  }
  return pairs
}
