#!/usr/bin/env node
// Second-pass classifier. Re-evaluates each KEEP event using the enriched
// description — catches false positives that slipped through Pass 1
// (title looks techy, description reveals marketing fluff / wellness / generic
// networking with no real tech content).
//
// Input:  data/seed-events.json (Pass-1 KEEP list, enriched with descriptions)
// Output: data/seed-events.json (Pass-2 KEEP list)
//         data/seed-events-rejected.json (Pass-1 drops + Pass-2 drops, merged)

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'data/seed-events.json')
const REJECTED = path.join(ROOT, 'data/seed-events-rejected.json')
const CACHE = path.join(ROOT, 'data/scrape/classifications-v2.json')

const BATCH_SIZE = 20
const MODEL = 'claude-sonnet-4-5'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set')
  process.exit(1)
}

const SYSTEM = `You are a strict curator. You're doing PASS 2 of curating NYTW events for engineers — you now have the event description and can read what the event ACTUALLY is.

For each event {id, title, host, description}, return verdict KEEP or DROP plus a one-phrase reason.

KEEP only if the event has REAL engineering / technical / VC-for-tech / founder-with-tech-angle content. The description should reveal:
- Concrete technical content (architecture, infra, tools, agents, code, security, data eng)
- Hands-on session (hackathon, workshop, masterclass, live build, vibe coding)
- Strategic VC/founder talk specifically about tech topics (not generic startup networking)
- Specific company / product / technology being discussed (Anthropic, Cloudflare, Snyk, MCP, agents, LLM eval, etc.)
- Hiring engineers / engineering culture / technical leadership content

DROP if the description reveals:
- Generic networking, dinner, brunch, mixer, coffee with no specific technical topic
- "Founders gathering" with no specified content
- Pure pitch competition with no engineering angle (e.g. "pitch your startup, win cash")
- AI used only as marketing buzzword without actual technical substance
- "Future of X" panels with no concrete technical content
- Workshops on personal branding, leadership, mindset, storytelling, public speaking
- Wellness disguised: founder yoga, sound bath, breathwork, meditation, walks
- Pure consumer / lifestyle even if AI-flavored (e.g. "AI for fashion enthusiasts")
- Generic "demo day" with no technical eval criteria
- Crypto/web3 trading or tokenization speculation (KEEP crypto INFRA / ZK / stablecoin engineering)
- Religious / faith-based
- Pure DEI or community events without a tech angle (KEEP if technical content present)
- Generic "AI for [vertical]" panels that are vendor pitches with no engineering substance
- Comedy shows, music shows, parties, vinyl nights, card games

Rule of thumb: Would a curious senior engineer / CTO read this description and learn or build something useful? If unclear, DROP.

OUTPUT FORMAT (strict JSON, no markdown fences):
{"results":[{"id":"...","verdict":"KEEP","reason":"max 10 words"}]}
`

async function classifyBatch(events) {
  const compact = events.map(e => ({
    id: e.id,
    title: e.title,
    host: e.host,
    desc: (e.description || '').slice(0, 800),
  }))
  const userMsg = `Classify these ${compact.length} events:\n${JSON.stringify(compact)}`

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  })

  const text = resp.content
    .filter(b => b.type === 'text').map(b => b.text).join('').trim()
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(clean).results || []
  } catch (e) {
    console.error('Parse failed:', clean.slice(0, 400))
    throw e
  }
}

const events = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const prevRejects = JSON.parse(fs.readFileSync(REJECTED, 'utf8'))

let cache = {}
if (fs.existsSync(CACHE)) {
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')) } catch {}
}

const todo = events.filter(e => !cache[e.id])
console.log(`Pass-1 KEEP: ${events.length}  Cached: ${events.length - todo.length}  ToDo: ${todo.length}`)

let batchNum = 0
for (let i = 0; i < todo.length; i += BATCH_SIZE) {
  batchNum++
  const slice = todo.slice(i, i + BATCH_SIZE)
  try {
    const results = await classifyBatch(slice)
    for (const r of results) {
      cache[r.id] = { verdict: r.verdict, reason: r.reason }
    }
    fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2))
    const kept = results.filter(r => r.verdict === 'KEEP').length
    console.log(`Batch ${batchNum}: ${slice.length} → ${kept} KEEP, ${slice.length - kept} DROP (done: ${i + slice.length}/${todo.length})`)
  } catch (e) {
    console.error(`Batch ${batchNum} failed:`, e.message)
    await new Promise(r => setTimeout(r, 2000))
  }
}

// Apply pass-2 results
const kept = []
const newDrops = []
for (const e of events) {
  const c = cache[e.id]
  if (!c) {
    console.warn(`No pass-2 classification for ${e.id}, keeping`)
    kept.push(e)
    continue
  }
  if (c.verdict === 'KEEP') {
    kept.push(e)
  } else {
    newDrops.push({
      id: e.id,
      title: e.title,
      host: e.host,
      url: e.rsvp_url,
      neighborhood: e.neighborhood,
      starts_at: e.starts_at,
      reason: `[pass2] ${c.reason}`,
    })
  }
}

fs.writeFileSync(SRC, JSON.stringify(kept, null, 2) + '\n')
fs.writeFileSync(REJECTED, JSON.stringify([...prevRejects, ...newDrops], null, 2) + '\n')

console.log()
console.log(`Pass-1 KEEP input:    ${events.length}`)
console.log(`Pass-2 KEEP output:   ${kept.length}`)
console.log(`Pass-2 new drops:     ${newDrops.length}`)
console.log(`Total rejected file:  ${prevRejects.length + newDrops.length}`)
