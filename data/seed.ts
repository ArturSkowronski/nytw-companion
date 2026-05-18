// data/seed.ts
// Run with: npx tsx data/seed.ts
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import events from './seed-events.json' with { type: 'json' }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seed() {
  console.log(`Seeding ${events.length} events...`)
  const { error } = await supabase
    .from('events')
    .upsert(events, { onConflict: 'id' })

  if (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }
  console.log('Done.')
}

seed()
