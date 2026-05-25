import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: WorkerGlobalScope & typeof globalThis

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Mapbox tiles — cache-first, expire after 7 days, cap entries.
    {
      matcher: ({ url }) => url.origin === 'https://api.mapbox.com',
      handler: new CacheFirst({
        cacheName: 'mapbox-tiles',
        plugins: [
          new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }),
        ],
      }),
    },
    // /api/concierge — never cache (cost-bearing AI call).
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.startsWith('/api/concierge'),
      handler: new NetworkOnly(),
    },
    // Everything else same-origin → Serwist defaults (stale-while-revalidate).
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
})

serwist.addEventListeners()
