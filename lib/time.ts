// lib/time.ts
import { toZonedTime, format as formatTz } from 'date-fns-tz'
import type { Event, PlanItem } from './types'

const NYC_TZ = 'America/New_York'

export function nowInNYC(): Date {
  return toZonedTime(new Date(), NYC_TZ)
}

export function formatInNYC(date: Date | string, fmt: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatTz(toZonedTime(d, NYC_TZ), fmt, { timeZone: NYC_TZ })
}

export function isHappeningNow(starts_at: Date | string, ends_at: Date | string): boolean {
  const now = new Date()
  const start = typeof starts_at === 'string' ? new Date(starts_at) : starts_at
  const end = typeof ends_at === 'string' ? new Date(ends_at) : ends_at
  return now >= start && now <= end
}

// ── Festival mode helpers ────────────────────────────────────────────────────

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type DayKey = typeof DAY_KEYS[number]

const FESTIVAL_DAY_TO_ISO: Record<DayKey, string> = {
  mon: '2026-06-01T04:00:00.000Z',
  tue: '2026-06-02T04:00:00.000Z',
  wed: '2026-06-03T04:00:00.000Z',
  thu: '2026-06-04T04:00:00.000Z',
  fri: '2026-06-05T04:00:00.000Z',
  sat: '2026-06-06T04:00:00.000Z',
  sun: '2026-06-07T04:00:00.000Z',
}

export function festivalWindow(): { start: Date; end: Date } {
  return {
    start: new Date('2026-06-01T04:00:00.000Z'),
    end: new Date('2026-06-08T03:59:59.999Z'),
  }
}

export function festivalMode(now: Date): 'pre' | 'in' | 'post' {
  const { start, end } = festivalWindow()
  if (now < start) return 'pre'
  if (now > end) return 'post'
  return 'in'
}

export function dayKeyForDate(d: Date): DayKey {
  const zoned = toZonedTime(d, NYC_TZ)
  return DAY_KEYS[zoned.getDay()]
}

export function dateForDayKey(key: DayKey): Date {
  const iso = FESTIVAL_DAY_TO_ISO[key]
  if (!iso) throw new Error(`Unknown day key: ${key}`)
  return new Date(iso)
}

export function nextEventInPlan(
  items: PlanItem[],
  events: Event[],
  now: Date,
  withinHours = 2
): Event | null {
  const eligible = new Set(
    items
      .filter((i) => i.status !== 'declined' && i.status !== 'attended')
      .map((i) => i.event_id)
  )
  const horizon = now.getTime() + withinHours * 60 * 60 * 1000
  const candidates = events
    .filter((e) => eligible.has(e.id))
    .map((e) => ({ e, t: new Date(e.starts_at).getTime() }))
    .filter(({ t }) => t >= now.getTime() && t <= horizon)
    .sort((a, b) => a.t - b.t)
  return candidates[0]?.e ?? null
}

export function msUntil(
  target: Date,
  now: Date
): { days: number; hours: number; mins: number } {
  const ms = Math.max(0, target.getTime() - now.getTime())
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  return { days, hours, mins }
}
