import { ImageResponse } from 'next/og'

// Note: runtime='edge' caused 1.06 MB function (over Vercel Hobby's 1 MB limit).
// Default Node.js runtime has a much higher limit and OG images are cached by
// social platforms anyway, so cold-start difference is irrelevant.
export const alt = "NYTW Engineer's Companion — 87 engineering-relevant events for Tech Week NYC 2026"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

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
          background: '#0A0A0A',
          padding: '72px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              color: '#FF6B35',
              fontSize: 28,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            Tech Week NYC · June 1–7, 2026
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', color: '#FAFAFA', fontSize: 96, fontWeight: 800, lineHeight: 1 }}>
            <span>NYTW Engineer&apos;s</span>
            <span>Companion</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', color: '#A3A3A3', fontSize: 36, lineHeight: 1.2 }}>
            <span>87 engineering-relevant events.</span>
            <span>Plan the week you actually want.</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            color: '#555555',
            fontSize: 24,
          }}
        >
          virtuslab.com
        </div>
      </div>
    ),
    { ...size }
  )
}
