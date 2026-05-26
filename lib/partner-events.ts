// Stoppers shown in the "From the makers" section on the landing page.
// Both events are hosted by VirtusLab at NY Tech Week 2026 and are
// explicitly disclosed as such on the landing.
export interface PartnerEvent {
  id: string
  /** Small uppercase eyebrow above the title — Event / Book / Workshop / etc. */
  eyebrow: string
  title: string
  /** 1–2 sentence pitch in plain English, max ~180 chars. */
  blurb: string
  /** NYC-localised "Tue Jun 2 · 4:00 PM" format. null = "TBD". */
  when: string | null
  /** Neighborhood or venue name. null = hidden. */
  where: string | null
  /** External RSVP URL. null = renders dimmed. */
  rsvp_url: string | null
  /** Partiful og:image — used as the card cover. null = no cover, text-only. */
  cover_url: string | null
}

export const PARTNER_EVENTS: PartnerEvent[] = [
  {
    id: 'visdom-control-plane',
    eyebrow: 'Event',
    title: 'From Copilot to Control Plane',
    blurb:
      'Live session on building an AI-native SDLC with VISDOM 2.0. What works, what breaks, and how teams push AI coding past the early-excitement-then-ROI-cliff.',
    when: 'Tue Jun 2 · 4:00 PM',
    where: 'NYC',
    rsvp_url: 'https://partiful.com/e/bn5h1g13xzOV6R5XkLaE',
    cover_url:
      'https://partiful.imgix.net/external/user/AWwvoutHk1OjFIiagLtQzMDgDxW2/RLVDQbQGb4eOMhAZwfgyz?w=1000&h=1000&fit=clip',
  },
  {
    id: 'book-on-ai-sdlc',
    eyebrow: 'Book launch',
    title: 'How to Write a Book on AI in Enterprise SDLC',
    blurb:
      'Artur Skowroński and Tomek Lelek on what they learned shipping AI-assisted code for a year across enterprise clients — and why they bet on the patterns that survive the next model drop.',
    when: 'Tue Jun 2 · 12:00 PM',
    where: 'NYC',
    rsvp_url: 'https://partiful.com/e/M7pXmV8sOXT11yHb9pKw',
    cover_url:
      'https://partiful.imgix.net/external/user/AWwvoutHk1OjFIiagLtQzMDgDxW2/aKCopnPRMwbJE-iGIhmjB?w=1000&h=1000&fit=clip',
  },
]
