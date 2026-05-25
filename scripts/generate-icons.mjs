import { mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '..', 'public', 'icons', 'icon-source.svg')
const OUT_DIR = resolve(__dirname, '..', 'public', 'icons')

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const svg = await readFile(SRC)
  for (const size of [192, 512]) {
    const out = resolve(OUT_DIR, `icon-${size}x${size}.png`)
    await sharp(svg).resize(size, size).png().toFile(out)
    console.log(`wrote ${out}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
