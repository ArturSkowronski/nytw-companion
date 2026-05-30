import { ImageResponse } from 'next/og'
import { SITE_URL } from '@/lib/site-url'

// Note: runtime='edge' caused 1.06 MB function (over Vercel Hobby's 1 MB limit).
// Default Node.js runtime has a much higher limit and OG images are cached by
// social platforms anyway, so cold-start difference is irrelevant.
export const alt = `A friend shared their NYTW plan with you — open to see what they picked for Tech Week NYC 2026`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const HOST = SITE_URL.replace(/^https?:\/\//, '')

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#000000',
          padding: '72px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              color: '#FF5B25',
              fontSize: 28,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            Tech Week NYC · June 1–7, 2026
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              color: '#F5F5F5',
              fontSize: 80,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            <span>Someone shared their</span>
            <span>NYTW plan with you.</span>
          </div>
          <div
            style={{
              display: 'flex',
              color: '#9B9B9B',
              fontSize: 36,
              lineHeight: 1.2,
            }}
          >
            <span>Open to see what they picked.</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            color: '#9B9B9B',
            fontSize: 24,
          }}
        >
          {HOST}/plan
        </div>
      </div>
    ),
    { ...size }
  )
}
