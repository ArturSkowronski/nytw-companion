#!/usr/bin/env node
// Score-based filter for tech-week.com NYTW events.
// Goal: drop wellness / faith / lifestyle / marketing-fluff / consumer events
// and keep events with engineering / AI / devtools / founder / fintech relevance.
//
// Reads data/seed-events.json, writes:
//   data/seed-events.json           — filtered survivors (the canonical seed)
//   data/seed-events-rejected.json  — what was dropped, with reason+score, for audit

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'data/seed-events.json')
const REJECTED = path.join(ROOT, 'data/seed-events-rejected.json')

// ---- Bullshit (hard negative) patterns ----
// Each pattern: { re, weight, reason } — weight is subtracted from score.
const NEGATIVE = [
  // Wellness / fitness — explicit SPEC exclusion
  { re: /\b(yoga|pilates|hiit|zumba|spin class|spinning class|peloton|crossfit|kickbox|boxing class|barre class)\b/i, w: 10, r: 'wellness/fitness' },
  { re: /\b(morning run|fun run|founders run|prayer walk|recovery walk|tech walk|walk[ &-]+talk|trail walk|park walk|coffee walk|hike)\b/i, w: 8, r: 'walk/run' },
  { re: /\b(workout|sweat equity|breathwork|breathe & brief|breathwave|cold plunge|sauna|wellness studio|wellbeing lab|recovery room)\b/i, w: 8, r: 'wellness' },
  { re: /\b(meditation|mindful|mindfulness|self[- ]mastery|sanctum|inner|self[- ]care|consciousness|spiritual)\b/i, w: 8, r: 'mindfulness' },
  { re: /\b(soulcycle|soul cycle)\b/i, w: 6, r: 'soulcycle' },
  // Faith / religion
  { re: /\b(faith[- ]driven|christian|catholic|jewish|muslim|kabbalah|shabbat|prayer|biblical|gospel|church|psalm|interfaith)\b/i, w: 10, r: 'faith' },
  { re: /\b(synagogue|mosque|temple service)\b/i, w: 10, r: 'religious' },
  // Beauty / fashion / lifestyle consumer
  { re: /\b(beauty night|beauty ventures|skincare|makeup|cosmetic|fragrance|haircare|lipstick|nail|lash|brow|glam|salon)\b/i, w: 10, r: 'beauty' },
  { re: /\b(fashion tech|fashion week|fashion show|wardrobe|stylist)\b/i, w: 8, r: 'fashion' },
  { re: /\b(podcast & beauty|podcast and beauty)\b/i, w: 10, r: 'beauty podcast' },
  // Crypto/web3 trading (NOT crypto infra — keep that)
  { re: /\b(web3 vibe|web4|tokenization forum|memecoin|meme coin|nft drop|nft mint|nft party|nft launch|trading floor)\b/i, w: 6, r: 'web3 fluff' },
  { re: /\b(coin trading|degen|wagmi|gmgn|moonshot)\b/i, w: 6, r: 'crypto trading' },
  // Lifestyle / vague networking
  { re: /\b(vinyl|vinyl house|dance party|karaoke|trivia night|trivia happy hour|brews & bagels|brews and bagels|sip & learn|sip and learn|bagels & debrief|coffee chat|coffee mixer|tea time|wine tasting|cocktail class|cooking class|pasta night|pizza night)\b/i, w: 5, r: 'lifestyle social' },
  { re: /\b(art tech showcase|art showcase|gallery night|culture night|movie night|film screening|art & ai sip)\b/i, w: 5, r: 'art/culture' },
  { re: /\b(field trip|boat ride|sailing|yacht|brunch)\b/i, w: 4, r: 'leisure' },
  // Marketing/PR fluff signals
  { re: /\b(unfiltered edit|the edit|made in this room|the brick room|brand build|brand strategy|brand activation|live brand|pr boutique|earned media|content strategy session)\b/i, w: 5, r: 'marketing fluff' },
  { re: /\b(personal branding|thought leadership)\b/i, w: 5, r: 'pr fluff' },
  // Generic "happy hour" / mixer with no tech anchor (counter-weighted by tech keywords below)
  { re: /\bhappy hour\b/i, w: 1, r: 'generic happy hour' },
  { re: /\b(mixer|networking night|networking happy|cocktail hour|kickoff mixer)\b/i, w: 1, r: 'generic mixer' },
]

// ---- Tech (positive) patterns ----
const POSITIVE = [
  // Core engineering
  { re: /\b(ai|llm|gpt|gen[- ]?ai|genai|agentic|agent|mcp|claude|gemini|anthropic|openai|mistral|llama|grok|copilot)\b/i, w: 4 },
  { re: /\b(devtools|developer|sdk|api|cli|kubernetes|k8s|docker|terraform|observability|telemetry|sre|devops|ci\/cd|pipeline)\b/i, w: 4 },
  { re: /\b(platform engineering|platform[- ]eng|infrastructure|infra|reliability|scalability|edge computing|serverless)\b/i, w: 4 },
  { re: /\b(open ?source|oss|github|gitlab|monorepo|self[- ]host)\b/i, w: 3 },
  { re: /\b(security|appsec|infosec|cyber|zero[- ]trust|identity|auth|authn|authz|sast|dast|threat model|penetration test)\b/i, w: 4 },
  { re: /\b(data engineering|data ?eng|data platform|warehouse|lakehouse|sql|etl|elt|stream(ing)?|kafka|spark|airflow|dbt|snowflake|databricks)\b/i, w: 4 },
  // Hands-on builder events
  { re: /\b(hackathon|vibeathon|agentathon|hack night|hack day|hack & build|vibe coding|live build|live ?coding|code jam|workshop|masterclass|technical deep dive|deep dive|build session)\b/i, w: 5 },
  { re: /\b(demo day|demos? and drinks|product demo|launch (event|night)|showcase)\b/i, w: 3 },
  // Founders / fundraising / VC (tech-startup context)
  { re: /\b(founder|cto|cpo|ctf|vc|venture capital|seed round|series [a-d]|fundrais|term ?sheet|cap ?table|pitch (clinic|workshop|night|day|fest)|pitch competition|founder.{0,12}(panel|story|fireside))\b/i, w: 2 },
  { re: /\b(a16z|sequoia|bessemer|founders fund|index ventures|kleiner|nea|accel|greylock|lightspeed|y combinator|yc)\b/i, w: 3 },
  // Hiring eng talent
  { re: /\b(hiring engineers|engineering hiring|hire (ai )?talent|technical recruiting|engineering jobs|tech recruiting|recruiting eng)\b/i, w: 3 },
  // Verticals adjacent to tech
  { re: /\b(fintech|crypto infra|blockchain infra|zk[- ]proof|stablecoin infra|payments infrastructure)\b/i, w: 3 },
  { re: /\b(biotech|healthtech|edtech|climate tech|cleantech|space tech|spacetech|robotics|hardware|iot|quantum)\b/i, w: 3 },
  // Big tech brands as hosts → strong signal
  { re: /\b(openai|anthropic|google|aws|amazon web|microsoft|azure|meta|nvidia|cloudflare|databricks|datadog|snowflake|stripe|vercel|sentry|elevenlabs|hugging ?face|cohere|fal\b|ramp|notion|figma|atlassian|github|gitlab|jetbrains|jfrog|hashicorp|fastly|cloudflare|netlify|render|fly\.io|supabase|neon|planetscale|mongodb|elastic|confluent|pulumi|temporal|prefect|airbyte|snyk|wiz|crowdstrike|okta|ory|auth0|clerk|workos|airtable|intercom|fin\b|harness|composio|exa ai|fireworks ai|turbopuffer|mirage|lovable|paradigm|dedalus|cherry hill|ibm|pwc|fenwick)\b/i, w: 3 },
]

// Title bias: "AI" inside a generic-sounding event (e.g. "wellness with AI") shouldn't rescue it.
// We track if the event ALSO matches strong negative; if so the positive score is capped.

function scoreEvent(ev) {
  const text = `${ev.title || ''} ${ev.host || ''}`
  let pos = 0
  const posMatches = []
  for (const p of POSITIVE) {
    if (p.re.test(text)) { pos += p.w; posMatches.push(p.re.source) }
  }
  let neg = 0
  const negMatches = []
  for (const n of NEGATIVE) {
    if (n.re.test(text)) { neg += n.w; negMatches.push(n.r) }
  }
  // Cap: if any single strong negative (w >= 8) hit and positive matches are weak (<6),
  // refuse to rescue.
  const hasStrongNeg = NEGATIVE.some(n => n.w >= 8 && n.re.test(text))
  if (hasStrongNeg && pos < 6) pos = Math.min(pos, 1)

  return { score: pos - neg, pos, neg, posMatches, negMatches }
}

// ---- Run ----
const events = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const kept = []
const dropped = []

for (const ev of events) {
  const s = scoreEvent(ev)
  // Threshold: keep if score >= 2 (need some positive signal beyond a single weak match)
  if (s.score >= 2) {
    kept.push({ ...ev, _score: s.score })
  } else {
    dropped.push({
      id: ev.id,
      title: ev.title,
      host: ev.host,
      url: ev.rsvp_url,
      neighborhood: ev.neighborhood,
      starts_at: ev.starts_at,
      score: s.score,
      pos: s.pos,
      neg: s.neg,
      reason: s.negMatches.length ? s.negMatches.join(', ') : 'no tech signal',
    })
  }
}

// Strip the _score helper before writing
const finalKept = kept.map(e => {
  const { _score, ...rest } = e
  return rest
})

fs.writeFileSync(SRC, JSON.stringify(finalKept, null, 2) + '\n')
fs.writeFileSync(REJECTED, JSON.stringify(dropped, null, 2) + '\n')

console.log(`Input:     ${events.length}`)
console.log(`Kept:      ${kept.length} → ${path.relative(ROOT, SRC)}`)
console.log(`Dropped:   ${dropped.length} → ${path.relative(ROOT, REJECTED)}`)
console.log()
console.log('Top drop reasons:')
const reasonCounts = new Map()
for (const d of dropped) {
  for (const r of d.reason.split(', ')) {
    reasonCounts.set(r, (reasonCounts.get(r) || 0) + 1)
  }
}
const sorted = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
for (const [r, c] of sorted) console.log(`  ${String(c).padStart(4)}  ${r}`)
