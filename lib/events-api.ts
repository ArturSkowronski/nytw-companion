// Pure (non-MCP) functions over the event catalogue, used by both the REST
// endpoints in /api/events/* and the MCP tools in lib/mcp-tools.ts.
import { toZonedTime, format as formatTz } from 'date-fns-tz'
import allEvents from '@/data/all-events.json' with { type: 'json' }
import type { Event } from '@/lib/types'

const NYC_TZ = 'America/New_York'
export const EVENTS = allEvents as Event[]

export function eventToJson(e: Event) {
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

export function listEvents(opts: {
  day?: string
  tag?: string
  format?: string
  hostContains?: string
  limit?: number
  offset?: number
}) {
  const { day, tag, format, hostContains } = opts
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100)
  const offset = Math.max(opts.offset ?? 0, 0)
  let filtered = EVENTS
  if (day) {
    filtered = filtered.filter((e) => {
      const d = formatTz(toZonedTime(new Date(e.starts_at), NYC_TZ), 'yyyy-MM-dd', { timeZone: NYC_TZ })
      return d === day
    })
  }
  if (tag) filtered = filtered.filter((e) => e.tags?.includes(tag))
  if (format) filtered = filtered.filter((e) => e.format === format)
  if (hostContains) {
    const q = hostContains.toLowerCase()
    filtered = filtered.filter((e) => e.host.toLowerCase().includes(q))
  }
  filtered = filtered.slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return { total: filtered.length, offset, limit, events: filtered.slice(offset, offset + limit).map(eventToJson) }
}

export function searchEvents(query: string, limit = 10) {
  const needle = query.toLowerCase()
  const scored = EVENTS.map((e) => {
    let s = 0
    if (e.title.toLowerCase().includes(needle)) s += 5
    if (e.host.toLowerCase().includes(needle)) s += 3
    if (e.description?.toLowerCase().includes(needle)) s += 2
    if (e.tags?.some((t) => t.toLowerCase().includes(needle))) s += 2
    if (e.neighborhood?.toLowerCase().includes(needle)) s += 1
    return { e, s }
  })
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.min(Math.max(limit, 1), 50))
  return { query, count: scored.length, events: scored.map((r) => ({ ...eventToJson(r.e), _score: r.s })) }
}

export function getEvent(id: string) {
  return EVENTS.find((e) => e.id === id) ?? null
}

export function nextUp(hours = 3, limit = 8) {
  const now = new Date()
  const horizon = new Date(now.getTime() + Math.min(Math.max(hours, 0.5), 48) * 3600_000)
  const upcoming = EVENTS.filter((e) => {
    const start = new Date(e.starts_at)
    return start >= now && start <= horizon
  })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, Math.min(Math.max(limit, 1), 20))
  return { now_iso: now.toISOString(), horizon_iso: horizon.toISOString(), count: upcoming.length, events: upcoming.map(eventToJson) }
}

export function catalogueStats() {
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
    total_events: EVENTS.length,
    source: 'tech-week.com (scrape) enriched with partiful.com descriptions — the full Tech Week NYC 2026 catalogue; filter on your own',
    by_day: sortMap(byDay),
    by_tag: sortMap(byTag),
    by_format: sortMap(byFormat),
  }
}
