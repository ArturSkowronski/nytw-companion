import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SRC = resolve(ROOT, 'data/seed-events.json')
const OUT = resolve(ROOT, 'data/seed-events-load.json')

const TARGET_COUNT = 250
const SEED = 20260525

// Mulberry32 deterministic PRNG
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function main() {
  const seed = JSON.parse(await readFile(SRC, 'utf8'))
  const r = rng(SEED)
  const out = []
  for (let i = 0; i < TARGET_COUNT; i++) {
    const src = seed[i % seed.length]
    // Festival days Mon Jun 1 → Sun Jun 7, 2026
    const day = 1 + Math.floor(r() * 7)
    const hour = 8 + Math.floor(r() * 13) // 08:00..20:00
    const start = new Date(Date.UTC(2026, 5, day, hour, 0, 0))
    const end = new Date(start.getTime() + (1 + Math.floor(r() * 3)) * 3600_000)
    out.push({
      ...src,
      id: `load-${i.toString().padStart(4, '0')}`,
      title: `${src.title} [load #${i + 1}]`,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
    })
  }
  await writeFile(OUT, JSON.stringify(out, null, 2))
  console.log(`wrote ${out.length} events to ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
