// Visual accent for an event. VirtusLab-hosted events use the VirtusLab
// brand lime green so they stand out from the rest of the catalogue.
// Everything else uses the site's orange brand accent.
//
// All values are inline hex (no Tailwind utility classes) so consumers can
// pass them straight into `style={{ color: ... }}` without worrying about
// JIT scanning. For background tints we keep the same hex and pair it with
// CSS `color-mix` or use inline rgba opacity helpers.
import type { Event } from './types'

export const BRAND_ACCENT = '#FF5B25' // orange — used everywhere by default
export const VL_ACCENT = '#92C83E'    // VirtusLab lime — used on our own events

export function accentFor(event: Pick<Event, 'is_virtuslab_event'>): string {
  return event.is_virtuslab_event ? VL_ACCENT : BRAND_ACCENT
}

/** rgba string for the same accent with a custom alpha (0–1). */
export function accentRgba(event: Pick<Event, 'is_virtuslab_event'>, alpha: number): string {
  if (event.is_virtuslab_event) {
    return `rgba(146, 200, 62, ${alpha})` // VL_ACCENT
  }
  return `rgba(255, 91, 37, ${alpha})` // BRAND_ACCENT
}
