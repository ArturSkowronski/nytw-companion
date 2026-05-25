// MCP server exposing the NYTW Engineer's Companion event catalogue to AI agents.
// Mounted at /api/mcp/[transport] — supports both streamable HTTP and SSE transports.
//
// Tools:
//   list_events       — paginated, optional filters by day/tag/format/host
//   search_events     — fuzzy search across title/host/description/tags
//   get_event         — full record by id
//   next_up           — events starting in the next N hours (NYC time)
//   plan_summary      — list events in a shared plan via the public ical_token
//                       (not implemented yet — left as future work)

import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'
import { toZonedTime, format as formatTz } from 'date-fns-tz'
// IMPORTANT: MCP exposes the FULL 1,390-event catalogue (data/all-events.json),
// not the human-curated 379-event subset (data/seed-events.json). The web UI
// curates aggressively for human attention; agents should get the raw signal
// and filter themselves.
import allEvents from '@/data/all-events.json' with { type: 'json' }
import type { Event } from '@/lib/types'

const NYC_TZ = 'America/New_York'
const EVENTS = allEvents as Event[]

// ----- helpers -----
function eventToMd(e: Event): string {
  const day = formatTz(toZonedTime(new Date(e.starts_at), NYC_TZ), 'EEE MMM d', { timeZone: NYC_TZ })
  const start = formatTz(toZonedTime(new Date(e.starts_at), NYC_TZ), 'h:mm aa', { timeZone: NYC_TZ })
  const end = formatTz(toZonedTime(new Date(e.ends_at), NYC_TZ), 'h:mm aa', { timeZone: NYC_TZ })
  const tags = e.tags?.length ? ` · tags: ${e.tags.join(', ')}` : ''
  return `**${e.title}**\n${e.host}\n${day} ${start}–${end} · ${e.neighborhood ?? '—'}${tags}\nRSVP: ${e.rsvp_url}\nID: ${e.id}`
}

function eventToJson(e: Event) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    host: e.host,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    neighborhood: e.neighborhood,
    venue_name: e.venue_name,
    address: e.address,
    lat: e.lat,
    lng: e.lng,
    tags: e.tags,
    format: e.format,
    rsvp_url: e.rsvp_url,
    rsvp_platform: e.rsvp_platform,
    is_invite_only: e.is_invite_only,
    image_url: e.image_url ?? null,
  }
}

function matchesScore(e: Event, q: string): number {
  const needle = q.toLowerCase()
  let score = 0
  if (e.title.toLowerCase().includes(needle)) score += 5
  if (e.host.toLowerCase().includes(needle)) score += 3
  if (e.description?.toLowerCase().includes(needle)) score += 2
  if (e.tags?.some((t) => t.toLowerCase().includes(needle))) score += 2
  if (e.neighborhood?.toLowerCase().includes(needle)) score += 1
  return score
}

const handler = createMcpHandler(
  (server) => {
    // -------------------- list_events --------------------
    server.registerTool(
      'list_events',
      {
        title: 'List events',
        description:
          'List curated NYTW 2026 events. Optionally filter by day (YYYY-MM-DD, NYC time), tag slug, format, or host substring. Results are paginated.',
        inputSchema: {
          day: z.string().optional().describe('NYC-local date, e.g. "2026-06-03". Omit for all days.'),
          tag: z.string().optional().describe('Tag slug filter, e.g. "ai-infra", "devtools", "agentic-ai".'),
          format: z.string().optional().describe('Event format filter, e.g. "hackathon", "panel", "dinner".'),
          host_contains: z.string().optional().describe('Case-insensitive substring match on host.'),
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
        },
      },
      async ({ day, tag, format, host_contains, limit, offset }) => {
        let filtered = EVENTS
        if (day) {
          filtered = filtered.filter((e) => {
            const d = formatTz(toZonedTime(new Date(e.starts_at), NYC_TZ), 'yyyy-MM-dd', { timeZone: NYC_TZ })
            return d === day
          })
        }
        if (tag) filtered = filtered.filter((e) => e.tags?.includes(tag))
        if (format) filtered = filtered.filter((e) => e.format === format)
        if (host_contains) {
          const q = host_contains.toLowerCase()
          filtered = filtered.filter((e) => e.host.toLowerCase().includes(q))
        }
        filtered = filtered.slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        const page = filtered.slice(offset, offset + limit)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  total: filtered.length,
                  offset,
                  limit,
                  events: page.map(eventToJson),
                },
                null,
                2,
              ),
            },
          ],
        }
      },
    )

    // -------------------- search_events --------------------
    server.registerTool(
      'search_events',
      {
        title: 'Search events',
        description:
          'Fuzzy-search events by free-text query across title, host, description, tags, and neighborhood. Returns the top matches sorted by relevance.',
        inputSchema: {
          query: z.string().min(2).describe('Search terms, e.g. "agentic AI", "Snyk", "Brooklyn dinner".'),
          limit: z.number().int().min(1).max(50).default(10),
        },
      },
      async ({ query, limit }) => {
        const scored = EVENTS.map((e) => ({ e, s: matchesScore(e, query) }))
          .filter((r) => r.s > 0)
          .sort((a, b) => b.s - a.s)
          .slice(0, limit)
          .map((r) => ({ ...eventToJson(r.e), _score: r.s }))
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ query, count: scored.length, events: scored }, null, 2),
            },
          ],
        }
      },
    )

    // -------------------- get_event --------------------
    server.registerTool(
      'get_event',
      {
        title: 'Get event',
        description: 'Fetch the full record of one event by its id (e.g. "partiful-xyz...").',
        inputSchema: {
          id: z.string().min(1),
        },
      },
      async ({ id }) => {
        const e = EVENTS.find((x) => x.id === id)
        if (!e) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'not_found', id }) }],
            isError: true,
          }
        }
        return {
          content: [
            { type: 'text', text: JSON.stringify(eventToJson(e), null, 2) },
            { type: 'text', text: eventToMd(e) },
          ],
        }
      },
    )

    // -------------------- next_up --------------------
    server.registerTool(
      'next_up',
      {
        title: 'Next up',
        description:
          'Events starting within the next `hours` hours from now (NYC time). Useful for in-festival "what should I go to" queries.',
        inputSchema: {
          hours: z.number().min(0.5).max(48).default(3),
          limit: z.number().int().min(1).max(20).default(8),
        },
      },
      async ({ hours, limit }) => {
        const now = new Date()
        const horizon = new Date(now.getTime() + hours * 3600_000)
        const upcoming = EVENTS.filter((e) => {
          const start = new Date(e.starts_at)
          return start >= now && start <= horizon
        })
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          .slice(0, limit)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { now_iso: now.toISOString(), horizon_iso: horizon.toISOString(), count: upcoming.length, events: upcoming.map(eventToJson) },
                null,
                2,
              ),
            },
          ],
        }
      },
    )

    // -------------------- catalogue_stats --------------------
    server.registerTool(
      'catalogue_stats',
      {
        title: 'Catalogue stats',
        description: 'Summary of the curated catalogue: counts by day, tag, format. Use this first to know what data is available.',
        inputSchema: {},
      },
      async () => {
        const byDay = new Map<string, number>()
        const byTag = new Map<string, number>()
        const byFormat = new Map<string, number>()
        for (const e of EVENTS) {
          const d = formatTz(toZonedTime(new Date(e.starts_at), NYC_TZ), 'yyyy-MM-dd', { timeZone: NYC_TZ })
          byDay.set(d, (byDay.get(d) ?? 0) + 1)
          for (const t of e.tags ?? []) byTag.set(t, (byTag.get(t) ?? 0) + 1)
          if (e.format) byFormat.set(e.format, (byFormat.get(e.format) ?? 0) + 1)
        }
        const sortMap = (m: Map<string, number>) =>
          [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, c]) => ({ key: k, count: c }))
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  total_events: EVENTS.length,
                  source: 'tech-week.com (scrape) enriched with partiful.com descriptions — the full Tech Week NYC 2026 catalogue; filter on your own',
                  by_day: sortMap(byDay),
                  by_tag: sortMap(byTag),
                  by_format: sortMap(byFormat),
                },
                null,
                2,
              ),
            },
          ],
        }
      },
    )
  },
  {
    serverInfo: {
      name: 'nytw-engineers-companion',
      version: '1.0.0',
    },
    capabilities: {
      tools: {},
    },
  },
  {
    basePath: '/api/mcp',
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== 'production',
  },
)

export { handler as GET, handler as POST, handler as DELETE }
