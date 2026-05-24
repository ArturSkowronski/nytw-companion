import type { Event } from './types'

export interface Filters {
  tags: string[]
  editorsPicks: boolean
  freeFood: boolean
  hideInviteOnly: boolean
}

const BOOL_KEYS = ['editorsPicks', 'freeFood', 'hideInviteOnly'] as const

export function parseFilters(params: URLSearchParams): Filters {
  const raw = params.get('tags') ?? ''
  const tags = Array.from(
    new Set(
      raw
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    )
  )
  return {
    tags,
    editorsPicks: params.get('editorsPicks') === '1',
    freeFood: params.get('freeFood') === '1',
    hideInviteOnly: params.get('hideInviteOnly') === '1',
  }
}

export function serializeFilters(f: Filters): string {
  const out = new URLSearchParams()
  for (const key of BOOL_KEYS) {
    if (f[key]) out.set(key, '1')
  }
  if (f.tags.length > 0) {
    const sorted = [...f.tags].sort()
    out.set('tags', sorted.join(','))
  }
  // Sort keys alphabetically for stable URLs
  const sortedEntries = Array.from(out.entries()).sort(([a], [b]) => a.localeCompare(b))
  const result = new URLSearchParams()
  for (const [k, v] of sortedEntries) result.set(k, v)
  return result.toString()
}

export function applyFilters(events: Event[], f: Filters): Event[] {
  return events.filter((e) => {
    if (f.editorsPicks && !e.is_editors_pick) return false
    if (f.freeFood && !(e.has_free_food || e.has_free_drinks)) return false
    if (f.hideInviteOnly && e.is_invite_only) return false
    if (f.tags.length > 0 && !f.tags.some((t) => e.tags.includes(t))) return false
    return true
  })
}

export function tagFrequency(events: Event[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const e of events) {
    for (const t of e.tags) {
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count - a.count) || a.tag.localeCompare(b.tag))
}

export function activeFilterCount(f: Filters): number {
  let n = 0
  if (f.editorsPicks) n++
  if (f.freeFood) n++
  if (f.hideInviteOnly) n++
  n += f.tags.length
  return n
}
