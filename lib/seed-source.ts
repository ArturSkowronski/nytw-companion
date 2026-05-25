import baseSeed from '@/data/seed-events.json' with { type: 'json' }
import loadSeed from '@/data/seed-events-load.json' with { type: 'json' }
import type { Event } from '@/lib/types'

export function selectSeed(): Event[] {
  if (process.env.NEXT_PUBLIC_USE_LOAD_FIXTURE === '1') {
    return loadSeed as Event[]
  }
  return baseSeed as Event[]
}
