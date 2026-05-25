#!/usr/bin/env node
// Enrich each KEEP event by fetching its partiful.com page and extracting
// og:description, og:title, og:image, and any JSON-LD start/end times.
//
// Runs after scripts/classify-events.mjs.
// Input:  data/seed-events.json (KEEP list)
// Output: same file, with enriched description/image_url/(maybe) end time.
// Side effect: data/scrape/enrichments.json — cache of raw extracts, so re-runs are cheap.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, process.env.SEED_FILE || 'data/seed-events.json')
const CACHE = path.join(ROOT, 'data/scrape/enrichments.json')

const CONCURRENCY = 20
const TIMEOUT_MS = 20000
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

function decodeHtml(s) {
  if (!s) return s
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function pickMeta(html, name) {
  // matches both name="..." and property="..."
  const re = new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]*)"`, 'i')
  const m = re.exec(html)
  return m ? decodeHtml(m[1]) : null
}

function pickJsonLd(html) {
  // Partiful sometimes embeds an Event JSON-LD with startDate/endDate/location
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  const out = []
  let m
  while ((m = re.exec(html))) {
    try {
      const j = JSON.parse(m[1])
      out.push(j)
    } catch {}
  }
  return out
}

function pickInviteOnly(html) {
  // "Invite Only" appears in the HTML somewhere — also og:description if visible
  return /invite[- ]only/i.test(html)
}

async function fetchWithTimeout(url) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
      signal: ctl.signal,
      redirect: 'follow',
    })
    if (!res.ok) return { ok: false, status: res.status }
    const text = await res.text()
    return { ok: true, status: res.status, text }
  } catch (e) {
    return { ok: false, error: e.message }
  } finally {
    clearTimeout(t)
  }
}

async function enrich(event) {
  const r = await fetchWithTimeout(event.rsvp_url)
  if (!r.ok) return { id: event.id, ok: false, error: r.error || `HTTP ${r.status}` }
  const html = r.text
  const description = pickMeta(html, 'og:description') || pickMeta(html, 'description')
  const ogTitle = pickMeta(html, 'og:title')
  const ogImage = pickMeta(html, 'og:image')
  const inviteOnly = pickInviteOnly(html)
  const lds = pickJsonLd(html)
  let startISO = null, endISO = null, locName = null
  for (const ld of lds) {
    const items = Array.isArray(ld) ? ld : [ld]
    for (const it of items) {
      if (it && (it['@type'] === 'Event' || it['@type'] === 'SocialEvent')) {
        startISO = startISO || it.startDate || null
        endISO = endISO || it.endDate || null
        if (it.location) {
          const loc = Array.isArray(it.location) ? it.location[0] : it.location
          if (typeof loc === 'string') locName = locName || loc
          else if (loc && loc.name) locName = locName || loc.name
        }
      }
    }
  }
  return {
    id: event.id,
    ok: true,
    description: description || null,
    ogTitle,
    ogImage,
    inviteOnly,
    startISO,
    endISO,
    locName,
  }
}

// ---- run ----
const events = JSON.parse(fs.readFileSync(SRC, 'utf8'))
let cache = {}
if (fs.existsSync(CACHE)) {
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')) } catch {}
}

const todo = events.filter(e => !cache[e.id])
console.log(`Total: ${events.length}  Cached: ${events.length - todo.length}  ToDo: ${todo.length}`)

let inFlight = 0, done = 0, ok = 0, fail = 0
let writeTimer = null
function persistCache() {
  if (writeTimer) return
  writeTimer = setTimeout(() => {
    fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2))
    writeTimer = null
  }, 1000)
}

async function worker(queue) {
  while (queue.length) {
    const ev = queue.shift()
    inFlight++
    const r = await enrich(ev)
    inFlight--
    cache[ev.id] = r
    done++
    if (r.ok) ok++; else fail++
    if (done % 25 === 0) {
      console.log(`  ${done}/${todo.length}  ok=${ok} fail=${fail} inFlight=${inFlight}`)
      persistCache()
    }
  }
}

const queue = [...todo]
const workers = Array(CONCURRENCY).fill().map(() => worker(queue))
await Promise.all(workers)
fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2))
console.log(`Done: ${done}  ok=${ok}  fail=${fail}`)

// Apply enrichments to the events file
let enrichedCount = 0
for (const ev of events) {
  const c = cache[ev.id]
  if (!c || !c.ok) continue
  if (c.description && !ev.description) {
    ev.description = c.description.trim().slice(0, 2000)
    enrichedCount++
  }
  if (c.ogImage) ev.image_url = c.ogImage
  if (c.inviteOnly) ev.is_invite_only = true
  if (c.locName && (!ev.venue_name || ev.venue_name === ev.neighborhood || ev.venue_name === 'TBD')) {
    ev.venue_name = c.locName
  }
  if (c.startISO) {
    const d = new Date(c.startISO)
    if (!Number.isNaN(d.getTime())) ev.starts_at = d.toISOString()
  }
  if (c.endISO) {
    const d = new Date(c.endISO)
    if (!Number.isNaN(d.getTime())) ev.ends_at = d.toISOString()
  }
}
fs.writeFileSync(SRC, JSON.stringify(events, null, 2) + '\n')
console.log(`Events with description added: ${enrichedCount}`)
