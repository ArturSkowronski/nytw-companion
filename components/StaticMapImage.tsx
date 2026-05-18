import { staticMapUrl } from '@/lib/geo'

interface StaticMapImageProps {
  lat: number
  lng: number
  zoom?: number
  width?: number
  height?: number
  alt?: string
  className?: string
}

export function StaticMapImage({
  lat,
  lng,
  zoom = 14,
  width = 400,
  height = 200,
  alt = 'Venue location',
  className = '',
}: StaticMapImageProps) {
  const url = staticMapUrl({ lat, lng, zoom, width, height })
  if (!url) {
    return (
      <div
        className={`bg-[#111111] border border-[#1A1A1A] rounded-md flex items-center justify-center text-[#666666] text-xs font-mono ${className}`}
        style={{ width, height }}
      >
        Map disabled
      </div>
    )
  }
  // Plain <img> — Mapbox Static API is external, no need for Next/Image optimization here.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      width={width}
      height={height}
      className={`rounded-md border border-[#1A1A1A] ${className}`}
    />
  )
}
