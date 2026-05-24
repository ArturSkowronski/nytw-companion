import { describe, it, expect } from 'vitest'
import {
  parseFilters,
  serializeFilters,
  applyFilters,
  tagFrequency,
  type Filters,
} from '../../lib/filters'
import type { Event } from '../../lib/types'

function mkEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'e1',
    title: 't',
    description: 'd',
    host: 'h',
    starts_at: '2026-06-03T22:00:00Z',
    ends_at: '2026-06-04T01:00:00Z',
    venue_name: null,
    address: null,
    lat: null,
    lng: null,
    neighborhood: null,
    rsvp_url: 'https://lu.ma/x',
    rsvp_platform: 'luma',
    tags: [],
    audience_tags: [],
    format: null,
    capacity: null,
    is_invite_only: false,
    has_free_food: false,
    has_free_drinks: false,
    is_editors_pick: false,
    editors_pick_blurb: null,
    is_virtuslab_event: false,
    source: 's',
    source_url: 's',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('parseFilters', () => {
  it('returns defaults for empty params', () => {
    const f = parseFilters(new URLSearchParams(''))
    expect(f).toEqual({ tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: false })
  })

  it('parses comma-separated tags', () => {
    expect(parseFilters(new URLSearchParams('tags=ai-infra,devtools')).tags)
      .toEqual(['ai-infra', 'devtools'])
  })

  it('treats empty tags param as no tags', () => {
    expect(parseFilters(new URLSearchParams('tags=')).tags).toEqual([])
  })

  it('drops empty tokens, lowercases, and dedupes tags', () => {
    expect(parseFilters(new URLSearchParams('tags=,,,Foo,FOO,foo,')).tags)
      .toEqual(['foo'])
  })

  it('parses literal 1 as true for editorsPicks', () => {
    expect(parseFilters(new URLSearchParams('editorsPicks=1')).editorsPicks).toBe(true)
  })

  it('treats 0/true/missing as false for bool params', () => {
    expect(parseFilters(new URLSearchParams('editorsPicks=0')).editorsPicks).toBe(false)
    expect(parseFilters(new URLSearchParams('editorsPicks=true')).editorsPicks).toBe(false)
    expect(parseFilters(new URLSearchParams('')).editorsPicks).toBe(false)
  })

  it('ignores unknown params', () => {
    const f = parseFilters(new URLSearchParams('tags=ai-infra&unknownParam=foo'))
    expect(f.tags).toEqual(['ai-infra'])
  })
})

describe('serializeFilters', () => {
  it('returns empty string for defaults', () => {
    expect(serializeFilters({ tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: false }))
      .toBe('')
  })

  it('serializes booleans as 1', () => {
    expect(serializeFilters({ tags: [], editorsPicks: true, freeFood: false, hideInviteOnly: false }))
      .toBe('editorsPicks=1')
  })

  it('sorts tag tokens alphabetically', () => {
    expect(serializeFilters({ tags: ['devtools', 'ai-infra'], editorsPicks: false, freeFood: false, hideInviteOnly: false }))
      .toBe('tags=ai-infra%2Cdevtools')
  })

  it('round-trips parse → serialize for canonical input', () => {
    const input = 'editorsPicks=1&tags=ai-infra%2Cdevtools'
    const parsed = parseFilters(new URLSearchParams(input))
    expect(serializeFilters(parsed)).toBe(input)
  })
})

describe('applyFilters', () => {
  const evs: Event[] = [
    mkEvent({ id: 'a', is_editors_pick: true,  tags: ['ai-infra'] }),
    mkEvent({ id: 'b', has_free_food: true,    tags: ['devtools'] }),
    mkEvent({ id: 'c', has_free_drinks: true,  tags: ['ai-infra', 'devtools'] }),
    mkEvent({ id: 'd', is_invite_only: true,   tags: ['founders'] }),
    mkEvent({ id: 'e' }),
  ]

  it('identity when no filters', () => {
    const f: Filters = { tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: false }
    expect(applyFilters(evs, f).map(e => e.id)).toEqual(['a','b','c','d','e'])
  })

  it('editorsPicks keeps only is_editors_pick', () => {
    expect(applyFilters(evs, { tags: [], editorsPicks: true, freeFood: false, hideInviteOnly: false })
      .map(e => e.id)).toEqual(['a'])
  })

  it('freeFood matches has_free_food OR has_free_drinks', () => {
    expect(applyFilters(evs, { tags: [], editorsPicks: false, freeFood: true, hideInviteOnly: false })
      .map(e => e.id)).toEqual(['b','c'])
  })

  it('hideInviteOnly drops invite-only events', () => {
    expect(applyFilters(evs, { tags: [], editorsPicks: false, freeFood: false, hideInviteOnly: true })
      .map(e => e.id)).toEqual(['a','b','c','e'])
  })

  it('tag filter is OR across selected tags', () => {
    expect(applyFilters(evs, { tags: ['ai-infra', 'founders'], editorsPicks: false, freeFood: false, hideInviteOnly: false })
      .map(e => e.id)).toEqual(['a','c','d'])
  })

  it('combines categories with AND', () => {
    expect(applyFilters(evs, { tags: ['ai-infra'], editorsPicks: true, freeFood: false, hideInviteOnly: false })
      .map(e => e.id)).toEqual(['a'])
  })
})

describe('tagFrequency', () => {
  it('counts and sorts desc, ties broken alphabetically', () => {
    const evs = [
      mkEvent({ id: '1', tags: ['ai-infra', 'devtools'] }),
      mkEvent({ id: '2', tags: ['ai-infra'] }),
      mkEvent({ id: '3', tags: ['founders'] }),
    ]
    expect(tagFrequency(evs)).toEqual([
      { tag: 'ai-infra', count: 2 },
      { tag: 'devtools', count: 1 },
      { tag: 'founders', count: 1 },
    ])
  })

  it('returns empty for empty input', () => {
    expect(tagFrequency([])).toEqual([])
  })
})
