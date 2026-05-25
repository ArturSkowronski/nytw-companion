#!/usr/bin/env node
// Classify each NYTW event as KEEP / DROP using Claude Sonnet 4.6.
// Input:  data/seed-events.json (currently the full 1,390-event raw scrape)
// Output:
//   data/seed-events.json           — KEEP-only list (canonical seed)
//   data/seed-events-rejected.json  — DROP list with verdict reasons
//
// Requires ANTHROPIC_API_KEY in env.

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'data/seed-events.json')
const REJECTED = path.join(ROOT, 'data/seed-events-rejected.json')
const CACHE = path.join(ROOT, 'data/scrape/classifications.json')

const BATCH_SIZE = 40
const MODEL = 'claude-sonnet-4-5' // robust + cheap; bump if quality is off

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set')
  process.exit(1)
}

const SYSTEM = `You are a strict curator for an engineering-focused Tech Week NYC tool.

For each event you receive {id, title, host, neighborhood}, return JSON with verdict KEEP or DROP and a one-phrase reason.

KEEP if the event plausibly serves software engineers / CTOs / technical founders / VCs investing in tech / data-engineers / security engineers / DevTools companies. Keep:
- AI / agentic / LLM / MCP / GenAI infra & application talks, panels, hackathons, builder sessions
- DevTools, platform engineering, observability, data eng, security, fintech infra, blockchain infra (NOT crypto trading), biotech infra, robotics, hardware, quantum, climate tech with engineering angle
- Founder/VC events with explicit technical angle (AI infra dinner, devtools fundraising, hiring engineers, demo days for tech startups)
- Big-tech / known dev-tool brand events (OpenAI, Anthropic, AWS, Google, Microsoft, Nvidia, Cloudflare, Vercel, Databricks, Stripe, Sentry, ElevenLabs, Snyk, Notion, Airtable, Datadog, Linear, GitHub, Hugging Face, Lovable, Composio, Fireworks AI, etc.)
- RegTech, healthtech, edtech, climate tech IF there's a clear tech/engineering content angle
- IPO / fundraising / cap-table / cap markets when oriented at tech founders

DROP if the event is:
- Pure wellness / fitness (yoga, pilates, HIIT, runs, walks, hikes, boxing, breathwork, recovery, mindfulness)
- Religious / faith-based (prayer walk, christian tech, faith-driven, gospel)
- Pure beauty / fashion / lifestyle / consumer (skincare, makeup, fashion show, vinyl party, dance party, comedy show, cooking class, art gallery)
- Pure crypto trading / memecoin / NFT party content (KEEP crypto infra, ZK, stablecoin infra)
- Generic "happy hour" / "mixer" / "networking" / "soiree" / "dinner" / "breakfast" with NO indication of tech content, technical host, or engineering audience
- Pure marketing/PR/brand strategy/agency activations
- Real-estate / proptech if non-technical
- Boat rides, field trips, brunches, recess, sidewalk games
- Vague self-help / personal branding / leadership coaching / "self-mastery" / "rise circle"
- Generic "women in tech", "founders breakfast", "tea time" with no technical content signal (UNLESS the host is a clearly technical company)

Borderline rule: prefer DROP when in doubt. We want a high signal-to-noise feed. A "founders dinner with no technical anchor" is DROP. A "founders dinner about AI infra" is KEEP.

OUTPUT FORMAT (strict JSON, no markdown fences, no prose):
{"results":[{"id":"...","verdict":"KEEP","reason":"short phrase, max 8 words","tags":["ai-infra","fundraising"]}]}

The "tags" array is an editorial improvement over my regex-inferred tags. Use only these tag slugs:
ai-infra, devtools, platform-eng, agentic-ai, open-source, security, data-eng, fundraising, hiring, founder-stories, fintech, healthtech, biotech, edtech, climatetech, robotics, hardware, quantum, web3-infra, fintech-infra, regtech, marketing-tech, salestech.
Pick 1–4 relevant tags for KEEP events. Empty array for DROP.
`

async function classifyBatch(events) {
  const compact = events.map(e => ({
    id: e.id,
    title: e.title,
    host: e.host,
    nbh: e.neighborhood,
  }))
  const userMsg = `Classify these ${compact.length} events:\n${JSON.stringify(compact)}`

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  })

  const text = resp.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()

  // strip markdown fences if any
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    const obj = JSON.parse(clean)
    return obj.results || []
  } catch (e) {
    console.error('Parse failed for batch. First 500 chars:', clean.slice(0, 500))
    throw e
  }
}

// ---- Main ----
const events = JSON.parse(fs.readFileSync(SRC, 'utf8'))
let cache = {}
if (fs.existsSync(CACHE)) {
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')) } catch {}
}

const todo = events.filter(e => !cache[e.id])
console.log(`Total: ${events.length}  Cached: ${events.length - todo.length}  ToDo: ${todo.length}`)

let batchNum = 0
for (let i = 0; i < todo.length; i += BATCH_SIZE) {
  batchNum++
  const slice = todo.slice(i, i + BATCH_SIZE)
  try {
    const results = await classifyBatch(slice)
    for (const r of results) {
      cache[r.id] = { verdict: r.verdict, reason: r.reason, tags: r.tags || [] }
    }
    fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2))
    const kept = results.filter(r => r.verdict === 'KEEP').length
    console.log(`Batch ${batchNum}: ${slice.length} → ${kept} KEEP, ${slice.length - kept} DROP   (done: ${i + slice.length}/${todo.length})`)
  } catch (e) {
    console.error(`Batch ${batchNum} failed:`, e.message)
    // small backoff and continue
    await new Promise(r => setTimeout(r, 2000))
  }
}

// ---- Split ----
const kept = []
const dropped = []
for (const e of events) {
  const c = cache[e.id]
  if (!c) {
    console.warn(`No classification for ${e.id}, keeping by default`)
    kept.push(e)
    continue
  }
  if (c.verdict === 'KEEP') {
    kept.push({
      ...e,
      tags: c.tags && c.tags.length ? c.tags : e.tags,
    })
  } else {
    dropped.push({
      id: e.id,
      title: e.title,
      host: e.host,
      url: e.rsvp_url,
      neighborhood: e.neighborhood,
      starts_at: e.starts_at,
      reason: c.reason,
    })
  }
}

fs.writeFileSync(SRC, JSON.stringify(kept, null, 2) + '\n')
fs.writeFileSync(REJECTED, JSON.stringify(dropped, null, 2) + '\n')

console.log()
console.log(`Input:   ${events.length}`)
console.log(`Kept:    ${kept.length} → ${path.relative(ROOT, SRC)}`)
console.log(`Dropped: ${dropped.length} → ${path.relative(ROOT, REJECTED)}`)
