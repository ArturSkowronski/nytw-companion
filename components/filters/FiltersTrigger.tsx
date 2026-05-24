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
      className="inline-flex items-center gap-2 rounded-md border border-[#2A2A2A] bg-[#111111] px-3 py-1.5 font-mono text-xs text-[#A3A3A3] hover:text-[#FAFAFA] hover:border-[#333333] transition-colors"
    >
      <span>Filters</span>
      {activeCount > 0 && (
        <span
          data-testid="filters-badge"
          className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#FF6B35] text-white text-[10px] px-1.5"
        >
          {activeCount}
        </span>
      )}
    </button>
  )
}
