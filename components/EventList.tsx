// components/EventList.tsx
'use client'

import { useState, useMemo, useRef, Suspense } from 'react'
import Fuse from 'fuse.js'
import { EventCard } from '@/components/EventCard'
import { EventSearch } from '@/components/EventSearch'
import { EditorsPicksCarousel } from '@/components/EditorsPicksCarousel'
import { groupEventsByDay, formatDayHeading, formatDayShort, getTimePeriod, type TimePeriod } from '@/lib/events'
import type { Event } from '@/lib/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FiltersTrigger } from '@/components/filters/FiltersTrigger'
import { ActiveFiltersBar } from '@/components/filters/ActiveFiltersBar'
import { EventFilters } from '@/components/filters/EventFilters'
import { useFilters } from '@/lib/use-filters'
import { applyFilters, tagFrequency } from '@/lib/filters'

interface EventListProps {
  events: Event[]
}

const TIME_PERIOD_ORDER: TimePeriod[] = ['EARLY', 'MID', 'LATE']

export function EventList(props: EventListProps) {
  return (
    <Suspense fallback={null}>
      <EventListInner {...props} />
    </Suspense>
  )
}

function EventListInner({ events }: EventListProps) {
  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const dayRefs = useRef<Record<string, HTMLElement | null>>({})
  const { filters, toggleTag, setFilter, reset, activeCount } = useFilters()

  const fuse = useMemo(
    () =>
      new Fuse(events, {
        keys: ['title', 'host', 'description', 'tags', 'neighborhood'],
        threshold: 0.35,
        includeScore: true,
      }),
    [events]
  )

  const filtered = useMemo(() => applyFilters(events, filters), [events, filters])

  const filteredEvents = useMemo(() => {
    if (!query.trim()) return filtered
    const ids = new Set(filtered.map((e) => e.id))
    return fuse.search(query).map((r) => r.item).filter((e) => ids.has(e.id))
  }, [query, fuse, filtered])

  const tagPalette = useMemo(() => tagFrequency(events), [events])

  function handleTagClick(tag: string) {
    toggleTag(tag)
    setDrawerOpen(true)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const editorsPicks = useMemo(
    () => events.filter((e) => e.is_editors_pick),
    [events]
  )

  const grouped = useMemo(() => groupEventsByDay(filteredEvents), [filteredEvents])
  const dayKeys = Object.keys(grouped).sort()

  function scrollToDay(key: string) {
    dayRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-20 text-[#9B9B9B]">
        <p className="font-mono text-lg mb-2">No events loaded yet.</p>
        <p className="text-sm">Run the seed script or check your Supabase connection.</p>
      </div>
    )
  }

  return (
    <div className="flex gap-8 relative">
      {/* Sticky left day nav — desktop only */}
      {dayKeys.length > 0 && (
        <nav className="hidden lg:flex flex-col gap-1 sticky top-6 h-fit min-w-[80px] shrink-0">
          {dayKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => scrollToDay(key)}
              className="text-left font-mono text-xs text-[#9B9B9B] hover:text-[#9B9B9B] transition-colors py-1 px-2 rounded hover:bg-[#0B0B0B]"
            >
              {formatDayShort(key)}
              <span className="block text-[#333333] text-[10px]">
                {grouped[key].length} events
              </span>
            </button>
          ))}
        </nav>
      )}

      <div className="flex-1 min-w-0">
        {/* Filter toolbar */}
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <FiltersTrigger activeCount={activeCount} onClick={() => setDrawerOpen(true)} />
          {filteredEvents.length !== events.length && (
            <p className="font-mono text-xs text-[#9B9B9B]">
              Showing {filteredEvents.length} of {events.length} events
            </p>
          )}
        </div>

        <ActiveFiltersBar
          filters={filters}
          onToggleTag={toggleTag}
          onSetFilter={setFilter}
          onReset={reset}
        />

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="right" className="w-[360px] sm:w-[420px] p-6 overflow-y-auto">
            <SheetHeader className="mb-6 p-0">
              <SheetTitle className="font-mono text-base text-[#F5F5F5] text-left">
                Filters
              </SheetTitle>
            </SheetHeader>
            <EventFilters
              filters={filters}
              tagPalette={tagPalette}
              onToggleTag={toggleTag}
              onSetFilter={setFilter}
              onReset={reset}
            />
          </SheetContent>
        </Sheet>

        {/* Search */}
        <div className="mb-6">
          <EventSearch onSearch={setQuery} />
        </div>

        {/* Mobile day nav — horizontal chips */}
        {dayKeys.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 lg:hidden">
            {dayKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => scrollToDay(key)}
                className="shrink-0 font-mono text-xs text-[#9B9B9B] bg-[#0B0B0B] border border-[#262626] px-3 py-1.5 rounded-full hover:border-[#FF5B25] hover:text-[#FF5B25] transition-colors whitespace-nowrap"
              >
                {formatDayShort(key)}
                <span className="ml-1 text-[#9B9B9B]">({grouped[key].length})</span>
              </button>
            ))}
          </div>
        )}

        {/* Editor's Picks carousel — only when not searching */}
        {!query && editorsPicks.length > 0 && (
          <EditorsPicksCarousel picks={editorsPicks} />
        )}

        {/* Filter-aware empty state */}
        {filteredEvents.length === 0 && (query || activeCount > 0) && (
          <div className="text-center py-16 text-[#9B9B9B]">
            {query ? (
              <p className="font-mono text-base mb-2">
                No matches for &ldquo;{query}&rdquo;{activeCount > 0 ? ' under current filters' : ''}.
              </p>
            ) : (
              <p className="font-mono text-base mb-2">No matches under current filters.</p>
            )}
            <p className="text-sm">
              Try {activeCount > 0 ? 'removing filters' : 'broader terms'}, or{' '}
              <a href="/beyond" className="text-[#FF5B25] hover:underline">
                browse other aggregators →
              </a>
            </p>
          </div>
        )}

        {/* Day-grouped timeline */}
        {dayKeys.map((dayKey) => {
          const dayEvents = grouped[dayKey]

          // Group events by time period within the day
          const byPeriod: Record<string, Event[]> = {}
          for (const event of dayEvents) {
            const period = getTimePeriod(event.starts_at)
            if (!byPeriod[period]) byPeriod[period] = []
            byPeriod[period].push(event)
          }

          return (
            <section
              key={dayKey}
              id={`day-${dayKey}`}
              ref={(el) => { dayRefs.current[dayKey] = el }}
              className="mb-12 scroll-mt-6"
            >
              {/* Day header */}
              <div className="sticky top-0 z-10 bg-[#000000] border-b border-[#1A1A1A] py-3 mb-4 flex items-baseline justify-between">
                <h2 className="font-mono font-bold text-[#F5F5F5] text-lg">
                  {formatDayHeading(dayKey)}
                </h2>
                <span className="text-[#9B9B9B] text-xs font-mono">
                  {dayEvents.length} events
                </span>
              </div>

              {/* Events grouped by time period */}
              {TIME_PERIOD_ORDER.filter((p) => byPeriod[p]?.length > 0).map((period) => (
                <div key={period} className="mb-6">
                  <p className="text-[#333333] text-xs font-mono uppercase tracking-widest mb-3 pl-1">
                    {period}
                  </p>
                  <div className="grid gap-3">
                    {byPeriod[period].map((event) => (
                      <EventCard key={event.id} event={event} onTagClick={handleTagClick} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}
