'use client'

import { useState } from 'react'

interface TagFilterChipsProps {
  tags: { tag: string; count: number }[]
  selected: string[]
  onToggle: (tag: string) => void
}

const VISIBLE_LIMIT = 20

export function TagFilterChips({ tags, selected, onToggle }: TagFilterChipsProps) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? tags : tags.slice(0, VISIBLE_LIMIT)
  const hiddenCount = tags.length - VISIBLE_LIMIT

  if (tags.length === 0) {
    return (
      <p className="font-mono text-xs text-[#9B9B9B]">No tags available in current data</p>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map(({ tag, count }) => {
        const isSelected = selected.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            aria-pressed={isSelected}
            title={`${tag} (${count})`}
            className={
              `font-mono text-[11px] px-2 py-1 rounded border transition-colors ` +
              (isSelected
                ? 'bg-[#FF5B25] text-white border-[#FF5B25]'
                : 'bg-[#0B0B0B] text-[#9B9B9B] border-[#262626] hover:border-[#FF5B25] hover:text-[#F5F5F5]')
            }
          >
            <span className="truncate inline-block max-w-[160px] align-bottom">{tag}</span>
            <span className="ml-1 text-[#9B9B9B]">{count}</span>
          </button>
        )
      })}
      {!showAll && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="font-mono text-[11px] px-2 py-1 text-[#FF5B25] hover:underline"
        >
          Show all (+{hiddenCount})
        </button>
      )}
    </div>
  )
}
