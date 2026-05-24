import { describe, it, expect } from 'vitest'
import robots from '../../app/robots'

describe('robots', () => {
  it('allows / and disallows /api/', () => {
    const r = robots()
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules
    expect(rule.userAgent).toBe('*')
    expect(rule.allow).toEqual(expect.arrayContaining(['/']))
    expect(rule.disallow).toEqual(expect.arrayContaining(['/api/']))
  })

  it('references the sitemap URL', () => {
    const r = robots()
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/)
  })
})
