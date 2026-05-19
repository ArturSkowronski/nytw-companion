import { createEvents, type EventAttributes, type DateArray } from 'ics'
import type { Event, PlanItem } from './types'

const STATUS_PREFIX: Partial<Record<PlanItem['status'], string>> = {
  confirmed: '✅ ',
  rsvp_pending: '⏳ ',
  waitlist: '📋 ',
}

const EXPORT_STATUSES: ReadonlySet<PlanItem['status']> = new Set([
  'confirmed',
  'rsvp_pending',
  'waitlist',
])

function toDateArray(iso: string): DateArray {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`)
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ]
}

export function buildIcs(items: PlanItem[], events: Event[]): string {
  const eventById = new Map(events.map((e) => [e.id, e]))
  const attrs: EventAttributes[] = []

  for (const item of items) {
    if (!EXPORT_STATUSES.has(item.status)) continue
    const event = eventById.get(item.event_id)
    if (!event) continue

    const prefix = STATUS_PREFIX[item.status] ?? ''
    attrs.push({
      uid: `${event.id}@nytw-companion`,
      title: `${prefix}${event.title}`,
      description: `Host: ${event.host}\nRSVP: ${event.rsvp_url}`,
      location: event.address ?? event.venue_name ?? '',
      url: event.rsvp_url || undefined,
      start: toDateArray(event.starts_at),
      startInputType: 'utc',
      startOutputType: 'utc',
      end: toDateArray(event.ends_at),
      endInputType: 'utc',
      endOutputType: 'utc',
      productId: 'nytw-companion/ics',
      calName: 'NYTW Plan',
    })
  }

  const { error, value } = createEvents(attrs)
  if (error) throw error
  if (!value) {
    // Empty calendar — synthesize a valid skeleton (ics returns null for empty input).
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//nytw-companion/ics//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:NYTW Plan',
      'END:VCALENDAR',
      '',
    ].join('\r\n')
  }
  return value
}
