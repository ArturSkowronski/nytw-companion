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
      <p className="font-mono text-xs text-[#555555]">No tags available in current data</p>
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
                ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                : 'bg-[#111111] text-[#A3A3A3] border-[#2A2A2A] hover:border-[#FF6B35] hover:text-[#FAFAFA]')
            }
          >
            <span className="truncate inline-block max-w-[160px] align-bottom">{tag}</span>
            <span className="ml-1 text-[#555555]">{count}</span>
          </button>
        )
      })}
      {!showAll && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="font-mono text-[11px] px-2 py-1 text-[#FF6B35] hover:underline"
        >
          Show all (+{hiddenCount})
        </button>
      )}
    </div>
  )
}
