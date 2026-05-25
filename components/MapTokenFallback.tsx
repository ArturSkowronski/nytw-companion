'use client'

import { Button } from '@/components/ui/button'

interface MapTokenFallbackProps {
  message?: string
  onSwitchToTimeline?: () => void
}

export function MapTokenFallback({
  message,
  onSwitchToTimeline,
}: MapTokenFallbackProps) {
  const display =
    message ??
    'Map disabled — set NEXT_PUBLIC_MAPBOX_TOKEN to enable Mapbox.'
  return (
    <div className="flex flex-col items-center justify-center gap-4 min-h-[400px] bg-[#0B0B0B] border border-[#1A1A1A] rounded-md p-6 text-center">
      <p className="font-mono text-sm text-[#9B9B9B] max-w-md">{display}</p>
      {onSwitchToTimeline && (
        <Button
          variant="outline"
          className="border-[#333333] text-[#F5F5F5] hover:bg-[#1A1A1A] font-mono"
          onClick={onSwitchToTimeline}
        >
          Switch to timeline view →
        </Button>
      )}
    </div>
  )
}
