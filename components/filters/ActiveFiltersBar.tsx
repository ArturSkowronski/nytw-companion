'use client'

import type { Filters } from '@/lib/filters'

interface ActiveFiltersBarProps {
  filters: Filters
  onToggleTag: (tag: string) => void
  onSetFilter: (key: 'editorsPicks' | 'freeFood' | 'hideInviteOnly', value: boolean) => void
  onReset: () => void
}

const TOGGLE_LABELS: Record<'editorsPicks' | 'freeFood' | 'hideInviteOnly', string> = {
  editorsPicks: "Editor's Picks",
  freeFood: 'Free food/drinks',
  hideInviteOnly: 'Hide invite-only',
}

function Chip({ label, ariaLabel, onClear }: { label: string; ariaLabel: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2A2A2A] bg-[#111111] px-2.5 py-1 font-mono text-[11px] text-[#A3A3A3]">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={ariaLabel}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[#666666] hover:text-[#FAFAFA] hover:bg-[#2A2A2A]"
      >
        ×
      </button>
    </span>
  )
}

export function ActiveFiltersBar({ filters, onToggleTag, onSetFilter, onReset }: ActiveFiltersBarProps) {
  const active =
    filters.tags.length > 0 ||
    filters.editorsPicks ||
    filters.freeFood ||
    filters.hideInviteOnly

  if (!active) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {filters.tags.map((tag) => (
        <Chip
          key={`tag-${tag}`}
          label={tag}
          ariaLabel={`Remove ${tag} filter`}
          onClear={() => onToggleTag(tag)}
        />
      ))}
      {filters.editorsPicks && (
        <Chip
          label={TOGGLE_LABELS.editorsPicks}
          ariaLabel="Remove Editor's Picks filter"
          onClear={() => onSetFilter('editorsPicks', false)}
        />
      )}
      {filters.freeFood && (
        <Chip
          label={TOGGLE_LABELS.freeFood}
          ariaLabel="Remove Free food/drinks filter"
          onClear={() => onSetFilter('freeFood', false)}
        />
      )}
      {filters.hideInviteOnly && (
        <Chip
          label={TOGGLE_LABELS.hideInviteOnly}
          ariaLabel="Remove Hide invite-only filter"
          onClear={() => onSetFilter('hideInviteOnly', false)}
        />
      )}
      <button
        type="button"
        onClick={onReset}
        className="ml-1 font-mono text-[11px] text-[#FF6B35] hover:underline"
      >
        Clear all
      </button>
    </div>
  )
}
