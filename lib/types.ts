// lib/types.ts
export type PlanStatus =
  | 'interested'
  | 'rsvp_pending'
  | 'confirmed'
  | 'waitlist'
  | 'declined'
  | 'attended'

export type PlanItemSource = 'manual' | 'concierge' | 'editors_pick' | 'map'

export interface PlanItem {
  event_id: string
  status: PlanStatus
  notes?: string
  added_at: string // ISO 8601
  source: PlanItemSource
}

export interface Event {
  id: string
  title: string
  description: string
  host: string
  starts_at: string   // ISO 8601 UTC timestamptz
  ends_at: string     // ISO 8601 UTC timestamptz
  venue_name: string | null
  address: string | null
  lat: number | null
  lng: number | null
  neighborhood: string | null
  rsvp_url: string
  rsvp_platform: 'luma' | 'partiful' | 'eventbrite' | 'other'
  tags: string[]
  audience_tags: string[]
  format: string | null
  capacity: number | null
  is_invite_only: boolean
  has_free_food: boolean
  has_free_drinks: boolean
  is_editors_pick: boolean
  editors_pick_blurb: string | null
  is_virtuslab_event: boolean
  source: string
  source_url: string
  image_url?: string | null
  created_at: string
  updated_at: string
}

export interface ExternalSource {
  id: string
  name: string
  url: string
  description: string
  best_for: string
  category: 'aggregator' | 'newsletter' | 'official' | 'curated'
  sort_order: number
}
