// Stoppers shown in the "From the makers" section on the landing page.
// Edit this file to plug in real RSVP URLs / dates once the events go live.
//
// Both events are hosted by VirtusLab at NY Tech Week 2026 and are explicitly
// disclosed as such — no hidden sponsorship.
export interface PartnerEvent {
  id: string
  /** "EVENT" / "BOOK" / etc. — small uppercase eyebrow. */
  eyebrow: string
  title: string
  /** 1-line, max ~80 chars. Pitch in plain English. */
  blurb: string
  /** NYC time, "Wed Jun 3 · 6:00 PM" format. null = "TBD". */
  when: string | null
  /** Neighborhood or venue name. null = "TBD". */
  where: string | null
  /** External RSVP URL. null = "TBD" (renders dimmed). */
  rsvp_url: string | null
}

export const PARTNER_EVENTS: PartnerEvent[] = [
  {
    id: 'build-with-visdom',
    eyebrow: 'Event',
    title: 'Build with Visdom',
    blurb:
      'Want to understand what Visdom is? Live build session with the VirtusLab AI engineering team — agents, infra, the lot.',
    when: null, // TODO: fill once date confirmed
    where: null, // TODO: fill venue
    rsvp_url: null, // TODO: paste partiful/luma URL
  },
  {
    id: 'virtuslab-event-2',
    eyebrow: 'Event',
    title: 'TBD — second VirtusLab session',
    blurb:
      'Second VirtusLab NYTW event. Update lib/partner-events.ts with title, date, and RSVP link.',
    when: null,
    where: null,
    rsvp_url: null,
  },
]
