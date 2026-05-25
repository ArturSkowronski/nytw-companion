#!/usr/bin/env node
// Transform raw tech-week.com scrapes into seed-events.json
// Run: node scripts/transform-scrape.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SCRAPE_DIR = path.join(ROOT, 'data/scrape')
const OUT = path.join(ROOT, 'data/seed-events.json')

// NYC neighborhood centroids — extended set covering all values observed on tech-week.com
const CENTROIDS = {
  'Flatiron':              { lat: 40.7411, lng: -73.9897 },
  'SoHo':                  { lat: 40.7233, lng: -74.0030 },
  'Williamsburg':          { lat: 40.7081, lng: -73.9571 },
  'DUMBO':                 { lat: 40.7033, lng: -73.9881 },
  'Hudson Yards':          { lat: 40.7536, lng: -74.0014 },
  'Chelsea':               { lat: 40.7465, lng: -74.0014 },
  'Tribeca':               { lat: 40.7163, lng: -74.0086 },
  'Nomad':                 { lat: 40.7445, lng: -73.9887 },
  'NoMad':                 { lat: 40.7445, lng: -73.9887 },
  'Midtown':               { lat: 40.7549, lng: -73.9840 },
  'Lower East Side':       { lat: 40.7150, lng: -73.9843 },
  'East Village':          { lat: 40.7265, lng: -73.9815 },
  'West Village':          { lat: 40.7359, lng: -74.0030 },
  'Greenwich Village':     { lat: 40.7336, lng: -74.0027 },
  'Financial District':    { lat: 40.7074, lng: -74.0113 },
  'Union Square':          { lat: 40.7359, lng: -73.9911 },
  'Gramercy Park':         { lat: 40.7378, lng: -73.9854 },
  'Murray Hill':           { lat: 40.7479, lng: -73.9759 },
  'Kips Bay':              { lat: 40.7415, lng: -73.9785 },
  'Korea Town':            { lat: 40.7480, lng: -73.9858 },
  'Meatpacking District':  { lat: 40.7407, lng: -74.0078 },
  'Upper East Side':       { lat: 40.7736, lng: -73.9566 },
  'Upper West Side':       { lat: 40.7870, lng: -73.9754 },
  'Upper Manhattan':       { lat: 40.8076, lng: -73.9626 },
  'Chinatown':             { lat: 40.7158, lng: -73.9970 },
  'Central Park':          { lat: 40.7829, lng: -73.9654 },
  'Brooklyn':              { lat: 40.6782, lng: -73.9442 },
  'Queens':                { lat: 40.7282, lng: -73.7949 },
  'Bronx':                 { lat: 40.8448, lng: -73.8648 },
  'Long Island':           { lat: 40.7891, lng: -73.1350 },
  'Virtual (NYC)':         { lat: 40.7589, lng: -73.9851 }, // NYC center fallback
}

const DAY_DATES = {
  'day-mon-2026-06-01.json': '2026-06-01',
  'day-tue-2026-06-02.json': '2026-06-02',
  'day-wed-2026-06-03.json': '2026-06-03',
  'day-thu-2026-06-04.json': '2026-06-04',
  'day-fri-2026-06-05.json': '2026-06-05',
  'day-sat-2026-06-06.json': '2026-06-06',
  'day-sun-2026-06-07.json': '2026-06-07',
}

// "4:00am" / "10:30pm" → { h: 16, m: 30 } in 24h
function parseTime(s) {
  if (!s) return null
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(s.trim())
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const pm = m[3].toLowerCase() === 'pm'
  if (h === 12) h = 0
  if (pm) h += 12
  return { h, m: min }
}

// Combine local NYC date+time → UTC ISO. NYC = UTC-4 in June (EDT).
function toIsoUtc(dateYmd, time) {
  const t = parseTime(time)
  if (!t) return null
  const [y, mo, d] = dateYmd.split('-').map(Number)
  // Local NYC time → UTC by adding 4 hours (EDT)
  const dt = new Date(Date.UTC(y, mo - 1, d, t.h + 4, t.m, 0))
  return dt.toISOString()
}

// Heuristic format detection from title/host
function inferFormat(title, host) {
  const t = `${title} ${host}`.toLowerCase()
  if (/\b(rooftop)\b/.test(t)) return 'rooftop'
  if (/\b(dinner|supper)\b/.test(t)) return 'dinner'
  if (/\b(breakfast|brunch|coffee|bagel|morning)\b/.test(t)) return 'breakfast'
  if (/\b(hackathon|hack|vibeathon|agentathon)\b/.test(t)) return 'hackathon'
  if (/\b(workshop|masterclass|clinic|office hours|lab|bootcamp)\b/.test(t)) return 'workshop'
  if (/\b(panel|fireside|talk|keynote|summit|forum|conference|showcase)\b/.test(t)) return 'panel'
  if (/\b(party|mixer|happy hour|cocktail|social)\b/.test(t)) return 'social'
  if (/\b(pitch|demo day|founder)\b/.test(t)) return 'pitch'
  if (/\b(run|walk|hike|workout|yoga|fitness|hiit)\b/.test(t)) return 'wellness'
  return 'other'
}

// Heuristic tag detection
function inferTags(title, host) {
  const t = `${title} ${host}`.toLowerCase()
  const tags = []
  if (/\b(ai|llm|gpt|gen-?ai|agentic|agent|claude|gemini|anthropic|openai|mistral)\b/.test(t)) tags.push('ai-infra')
  if (/\b(devtools|developer|tooling|sdk|api|platform|infra|infrastructure|cloud|kubernetes|terraform|observability)\b/.test(t)) tags.push('devtools')
  if (/\b(platform|infrastructure|reliability|sre|devops)\b/.test(t)) tags.push('platform-eng')
  if (/\b(agent|agentic|mcp|autonomous)\b/.test(t)) tags.push('agentic-ai')
  if (/\b(fundrais|seed|pre-?seed|series [a-d]|investor|vc|venture|capital|term ?sheet|cap ?table)\b/.test(t)) tags.push('fundraising')
  if (/\b(hiring|talent|recruit|jobs?|career)\b/.test(t)) tags.push('hiring')
  if (/\b(open ?source|oss)\b/.test(t)) tags.push('open-source')
  if (/\b(data|analytics|warehouse|etl|pipeline|sql)\b/.test(t)) tags.push('data-eng')
  if (/\b(founder|startup|story|journey|acquir|exit|ipo)\b/.test(t)) tags.push('founder-stories')
  if (/\b(security|auth|identity|zero ?trust|appsec)\b/.test(t)) tags.push('security')
  if (/\b(fintech|finance|banking|payments|crypto|web3|defi)\b/.test(t)) tags.push('fintech')
  if (/\b(health|biotech|medical|wellness|life ?sci)\b/.test(t)) tags.push('healthtech')
  return tags
}

// Audience tag inference
function inferAudience(title, host) {
  const t = `${title} ${host}`.toLowerCase()
  const a = []
  if (/\b(founder|ceo|entrepreneur|startup)\b/.test(t)) a.push('founder')
  if (/\b(cto|engineering|engineer|developer|builder)\b/.test(t)) a.push('engineer')
  if (/\bcto\b/.test(t)) a.push('cto')
  if (/\b(vc|investor|capital|venture|lp)\b/.test(t)) a.push('vc')
  if (/\b(designer|design|product)\b/.test(t)) a.push('designer')
  if (a.length === 0) a.push('engineer') // default
  return a
}

// Time-of-day defaults for ends_at (start + 2h)
function endsAtFromStart(startIso) {
  if (!startIso) return null
  const d = new Date(startIso)
  d.setUTCHours(d.getUTCHours() + 2)
  return d.toISOString()
}

function slugFromUrl(url, title, dateYmd) {
  // partiful.com/e/XYZ → use XYZ; otherwise sanitize title
  const m = /partiful\.com\/e\/([^/?#]+)/.exec(url || '')
  if (m) return `partiful-${m[1].toLowerCase()}`
  const safe = (title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  return `${safe}-${dateYmd}`
}

function platformFromUrl(url) {
  if (!url) return 'other'
  if (/partiful\.com/i.test(url)) return 'partiful'
  if (/lu\.ma|luma\.com/i.test(url)) return 'luma'
  if (/eventbrite\.com/i.test(url)) return 'eventbrite'
  return 'other'
}

// ---- Load all day files ----
const files = fs.readdirSync(SCRAPE_DIR).filter(f => f.startsWith('day-') && f.endsWith('.json'))
const seen = new Map() // url → event
let totalRaw = 0
let skippedNoUrl = 0
let skippedNoTime = 0

for (const f of files) {
  const dateYmd = DAY_DATES[f]
  if (!dateYmd) {
    console.warn(`Unknown day file: ${f}`)
    continue
  }
  const payload = JSON.parse(fs.readFileSync(path.join(SCRAPE_DIR, f), 'utf8'))
  const rows = payload.rows || []
  totalRaw += rows.length
  for (const row of rows) {
    if (!row.url) { skippedNoUrl++; continue }
    const startsAt = toIsoUtc(dateYmd, row.time)
    if (!startsAt) { skippedNoTime++; continue }
    // Dedupe by url — pick the earliest-day occurrence
    if (seen.has(row.url)) {
      const prior = seen.get(row.url)
      if (new Date(startsAt) >= new Date(prior.starts_at)) continue
    }

    const neighborhood = row.neighborhood && row.neighborhood !== 'null' ? row.neighborhood : null
    const centroid = (neighborhood && CENTROIDS[neighborhood]) || CENTROIDS['Midtown']
    const title = (row.title || 'Untitled event').trim()
    const host = (row.host || 'Unknown host').trim()
    const id = slugFromUrl(row.url, title, dateYmd)

    seen.set(row.url, {
      id,
      title,
      description: '', // not available from tech-week.com listing
      host,
      starts_at: startsAt,
      ends_at: endsAtFromStart(startsAt),
      venue_name: neighborhood || 'TBD',
      address: neighborhood && neighborhood !== 'Virtual (NYC)' ? `${neighborhood}, New York, NY` : 'Virtual',
      lat: centroid.lat,
      lng: centroid.lng,
      neighborhood: neighborhood || 'Unknown',
      rsvp_url: row.url,
      rsvp_platform: platformFromUrl(row.url),
      tags: inferTags(title, host),
      audience_tags: inferAudience(title, host),
      format: inferFormat(title, host),
      capacity: null,
      is_invite_only: false,
      has_free_food: false,
      has_free_drinks: false,
      is_editors_pick: false,
      editors_pick_blurb: null,
      is_virtuslab_event: false,
      source: 'tech-week.com',
      source_url: 'https://tech-week.com/calendar/nyc',
    })
  }
}

const events = Array.from(seen.values()).sort((a, b) => a.starts_at.localeCompare(b.starts_at))

fs.writeFileSync(OUT, JSON.stringify(events, null, 2) + '\n')
console.log(`Raw rows: ${totalRaw}`)
console.log(`Skipped (no url): ${skippedNoUrl}`)
console.log(`Skipped (no time): ${skippedNoTime}`)
console.log(`Unique events written: ${events.length} → ${path.relative(ROOT, OUT)}`)
