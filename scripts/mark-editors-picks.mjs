// One-shot script: mark curated big-player events as editor's picks.
// Idempotent — running twice produces the same result.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const picks = {
  'partiful-titpml1nw0dkwgl9b6cf':
    'Anthropic hosts a founder salon on the AI-native era — frontier-lab access most weeks don\'t offer.',
  'partiful-ivy3zwzg7htpujbnhy3e':
    'OpenAI\'s only Builder Lounge of the week. If you ship on their models, this is the room.',
  'partiful-fjbzcfpprgdmvp1o534z':
    'Hands-on AI Learning Lab straight from Google — practical, not a sales pitch.',
  'partiful-yflfyvxyl8mfysuapd3o':
    'Stripe + a16z supper club — payments meets the top AI fund. Tickets like these usually leak by invite only.',
  'partiful-xv4phzfi7e2cufqzaf1d':
    'Cursor — the IDE half of NYC is using — opens its kitchen. Rare in-person glimpse.',
  'partiful-hvn69qhhqkal72l700kb':
    'ElevenLabs pop-up: voice AI\'s loudest team running demos and meetups in person.',
  'partiful-bknsmiibldqn5rcekcyb':
    'AWS Build AI day — direct face time with the cloud that runs most of the agents you depend on.',
  'partiful-8zim85jjl6n9qzjztfyf':
    'Microsoft / GitHub Copilot 6-hour MVP sprint with a $25K Azure prize. Builders only.',
  'partiful-wcxp7cbcwqwc2dfnxgug':
    'MongoDB + AWS run an AI Builder Day — two of the most-deployed backends in production AI in one room.',
  'partiful-nhlbgkxd64icegk4dnks':
    'Datadog and Vercel together — observability and frontend infra most AI products quietly run on.',
  'partiful-jytnb4idg0hxwjnqdsgf':
    'Cloudflare + Shopify on building for the agent era — two platforms with real production agent traffic.',
  'partiful-n9ccymio7nyeqt2wkee3':
    'Bloomberg, Lux Capital, and Tech:NYC headline the defense-tech debate — heavyweight panel, sharp topic.',
}

const files = ['data/seed-events.json', 'data/all-events.json']
for (const rel of files) {
  const path = resolve(root, rel)
  const data = JSON.parse(readFileSync(path, 'utf8'))
  let changed = 0
  for (const event of data) {
    const blurb = picks[event.id]
    if (!blurb) continue
    if (event.is_editors_pick === true && event.editors_pick_blurb === blurb) continue
    event.is_editors_pick = true
    event.editors_pick_blurb = blurb
    changed++
  }
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
  console.log(`${rel}: updated ${changed} of ${Object.keys(picks).length} events`)
}
