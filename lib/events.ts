// lib/events.ts
import { toZonedTime, format as formatTz } from 'date-fns-tz'
import type { Event } from './types'

const NYC_TZ = 'America/New_York'

export type TimePeriod = 'EARLY' | 'MID' | 'LATE'

export function getTimePeriod(starts_at: string): TimePeriod {
  const d = toZonedTime(new Date(starts_at), NYC_TZ)
  const hour = d.getHours()
  if (hour < 12) return 'EARLY'
  if (hour < 17) return 'MID'
  return 'LATE'
}

export function groupEventsByDay(events: Event[]): Record<string, Event[]> {
  const groups: Record<string, Event[]> = {}
  for (const event of events) {
    const day = formatTz(toZonedTime(new Date(event.starts_at), NYC_TZ), 'yyyy-MM-dd', { timeZone: NYC_TZ })
    if (!groups[day]) groups[day] = []
    groups[day].push(event)
  }
  for (const day of Object.keys(groups)) {
    groups[day].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  }
  return groups
}

export function formatEventTime(starts_at: string, ends_at: string): string {
  const start = toZonedTime(new Date(starts_at), NYC_TZ)
  const end = toZonedTime(new Date(ends_at), NYC_TZ)
  const dayAbbr = formatTz(start, 'EEE', { timeZone: NYC_TZ })
  const startTime = formatTz(start, 'h:mm aa', { timeZone: NYC_TZ })
  const endTime = formatTz(end, 'h:mm aa', { timeZone: NYC_TZ })
  return `${dayAbbr} ${startTime} – ${endTime}`
}

export function formatStartTime(iso: string): string {
  const d = toZonedTime(new Date(iso), NYC_TZ)
  return formatTz(d, 'h:mm aa', { timeZone: NYC_TZ })
}

export function formatEndTime(iso: string): string {
  const d = toZonedTime(new Date(iso), NYC_TZ)
  return formatTz(d, 'h:mm aa', { timeZone: NYC_TZ })
}

export function formatDayHeading(dateKey: string): string {
  // dateKey = 'YYYY-MM-DD' in NYC
  const [year, month, day] = dateKey.split('-').map(Number)
  // Construct date at noon UTC to avoid any timezone edge on the date itself
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return formatTz(toZonedTime(d, NYC_TZ), 'EEEE MMMM d', { timeZone: NYC_TZ })
}

export function formatDayShort(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return formatTz(toZonedTime(d, NYC_TZ), 'EEE d', { timeZone: NYC_TZ })
}
