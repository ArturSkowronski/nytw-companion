'use client'

interface FiltersTriggerProps {
  activeCount: number
  onClick: () => void
}

export function FiltersTrigger({ activeCount, onClick }: FiltersTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={activeCount > 0 ? `Filters (${activeCount} active)` : 'Filters'}
      className="inline-flex items-center gap-2 rounded-md border border-[#262626] bg-[#0B0B0B] px-3 py-1.5 font-mono text-xs text-[#9B9B9B] hover:text-[#F5F5F5] hover:border-[#333333] transition-colors"
    >
      <span>Filters</span>
      {activeCount > 0 && (
        <span
          data-testid="filters-badge"
          className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#FF5B25] text-white text-[10px] px-1.5"
        >
          {activeCount}
        </span>
      )}
    </button>
  )
}
