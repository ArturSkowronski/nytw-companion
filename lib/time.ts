// lib/time.ts
import { toZonedTime, format as formatTz } from 'date-fns-tz'

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
