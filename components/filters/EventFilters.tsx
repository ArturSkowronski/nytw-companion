'use client'

import { TagFilterChips } from './TagFilterChips'
import type { Filters } from '@/lib/filters'

interface EventFiltersProps {
  filters: Filters
  tagPalette: { tag: string; count: number }[]
  onToggleTag: (tag: string) => void
  onSetFilter: (key: 'editorsPicks' | 'freeFood' | 'hideInviteOnly', value: boolean) => void
  onReset: () => void
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex items-center justify-between py-2 cursor-pointer">
      <span className="font-mono text-sm text-[#F5F5F5]">{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-[#FF5B25] cursor-pointer"
      />
    </label>
  )
}

export function EventFilters({
  filters,
  tagPalette,
  onToggleTag,
  onSetFilter,
  onReset,
}: EventFiltersProps) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="font-mono text-xs uppercase tracking-widest text-[#9B9B9B] mb-2">
          Quick toggles
        </h3>
        <ToggleRow
          id="filter-editors-picks"
          label="Editor's Picks only"
          checked={filters.editorsPicks}
          onChange={(v) => onSetFilter('editorsPicks', v)}
        />
        <ToggleRow
          id="filter-free-food"
          label="Free food/drinks"
          checked={filters.freeFood}
          onChange={(v) => onSetFilter('freeFood', v)}
        />
        <ToggleRow
          id="filter-hide-invite-only"
          label="Hide invite-only"
          checked={filters.hideInviteOnly}
          onChange={(v) => onSetFilter('hideInviteOnly', v)}
        />
      </section>

      <section>
        <h3 className="font-mono text-xs uppercase tracking-widest text-[#9B9B9B] mb-2">
          Tags
        </h3>
        <TagFilterChips
          tags={tagPalette}
          selected={filters.tags}
          onToggle={onToggleTag}
        />
      </section>

      <button
        type="button"
        onClick={onReset}
        className="self-start font-mono text-xs text-[#9B9B9B] hover:text-[#FF5B25] underline underline-offset-4"
      >
        Reset all
      </button>
    </div>
  )
}
