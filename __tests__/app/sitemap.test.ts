import { describe, it, expect } from 'vitest'
import sitemap from '../../app/sitemap'

describe('sitemap', () => {
  it('lists the nine public routes', () => {
    const entries = sitemap()
    const urls = entries.map((e) => new URL(e.url).pathname)
    expect(urls).toEqual(
      expect.arrayContaining(['/', '/events', '/now', '/my-plan', '/plan', '/beyond', '/about', '/privacy', '/terms'])
    )
    expect(urls.length).toBe(9)
  })

  it('every URL is absolute', () => {
    const entries = sitemap()
    entries.forEach((e) => {
      expect(() => new URL(e.url)).not.toThrow()
    })
  })

  it('every entry has lastModified, changeFrequency, priority', () => {
    const entries = sitemap()
    entries.forEach((e) => {
      expect(e.lastModified).toBeInstanceOf(Date)
      expect(typeof e.changeFrequency).toBe('string')
      expect(typeof e.priority).toBe('number')
    })
  })
})
