import { describe, it, expect } from 'vitest'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..', '..')

describe('PWA icons', () => {
  it('icon-source.svg exists and is non-empty', () => {
    const p = resolve(ROOT, 'public/icons/icon-source.svg')
    expect(existsSync(p)).toBe(true)
    expect(statSync(p).size).toBeGreaterThan(100)
  })

  it('icon-192x192.png exists and is non-empty (committed)', () => {
    const p = resolve(ROOT, 'public/icons/icon-192x192.png')
    expect(existsSync(p)).toBe(true)
    expect(statSync(p).size).toBeGreaterThan(500)
  })

  it('icon-512x512.png exists and is non-empty (committed)', () => {
    const p = resolve(ROOT, 'public/icons/icon-512x512.png')
    expect(existsSync(p)).toBe(true)
    expect(statSync(p).size).toBeGreaterThan(500)
  })

  it('generator script exists', () => {
    const p = resolve(ROOT, 'scripts/generate-icons.mjs')
    expect(existsSync(p)).toBe(true)
  })
})
