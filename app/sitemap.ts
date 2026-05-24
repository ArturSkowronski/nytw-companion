import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-url'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const route = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] = 'weekly'
  ): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  })

  return [
    route('/', 1.0, 'weekly'),
    route('/events', 1.0, 'daily'),
    route('/now', 0.8, 'daily'),
    route('/my-plan', 0.7, 'weekly'),
    route('/plan', 0.7, 'weekly'),
    route('/beyond', 0.7, 'monthly'),
    route('/about', 0.6, 'monthly'),
  ]
}
