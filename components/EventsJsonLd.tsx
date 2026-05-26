// JSON-LD Event schema for the /events page.
// Emits an ItemList of schema.org Event entities for the curated catalogue —
// AI agents and search engines can ingest the full schedule directly from
// the HTML without scraping the UI or hitting the MCP endpoint.
import type { Event } from '@/lib/types'
import { SITE_URL } from '@/lib/site-url'

interface Props {
  events: Event[]
}

function eventToLd(e: Event) {
  const location = e.lat != null && e.lng != null
    ? {
        '@type': 'Place',
        name: e.venue_name ?? e.neighborhood ?? 'NYC',
        address: e.address ?? `${e.neighborhood ?? 'New York'}, NY`,
        geo: {
          '@type': 'GeoCoordinates',
          latitude: e.lat,
          longitude: e.lng,
        },
      }
    : {
        '@type': 'VirtualLocation',
        url: e.rsvp_url,
      }

  return {
    '@type': 'Event',
    '@id': `${SITE_URL}/events#${e.id}`,
    name: e.title,
    description: e.description || `Tech Week NYC 2026 event hosted by ${e.host}.`,
    startDate: e.starts_at,
    endDate: e.ends_at,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: e.neighborhood === 'Virtual (NYC)'
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location,
    organizer: {
      '@type': 'Organization',
      name: e.host,
    },
    url: e.rsvp_url,
    image: e.image_url ?? undefined,
    keywords: (e.tags ?? []).join(', '),
    isAccessibleForFree: !e.is_invite_only,
  }
}

export function EventsJsonLd({ events }: Props) {
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'NYTW Engineer\'s Companion — Curated Tech Week NYC 2026 events',
    description: `Curated engineering events at Tech Week NYC, June 1–7, 2026.`,
    numberOfItems: events.length,
    url: `${SITE_URL}/events`,
    itemListElement: events.map((e, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: eventToLd(e),
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
    />
  )
}
