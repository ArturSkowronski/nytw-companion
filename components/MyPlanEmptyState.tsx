// components/MyPlanEmptyState.tsx
import Link from 'next/link'

export function MyPlanEmptyState() {
  return (
    <div className="text-center py-16 px-6">
      <p className="font-mono text-2xl font-bold text-[#F5F5F5] mb-2">
        Your plan is empty.
      </p>
      <p className="text-sm text-[#9B9B9B] mb-8">
        □ → □ → □
      </p>
      <div className="grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
        <Link
          href="/events"
          className="bg-[#0B0B0B] border border-[#1A1A1A] rounded-md p-5 text-left hover:border-[#FF5B25] transition-colors"
        >
          <p className="font-mono text-sm text-[#F5F5F5] font-bold mb-1">Browse events →</p>
          <p className="text-xs text-[#9B9B9B]">LLM-curated picks, day-grouped timeline</p>
        </Link>
        <Link
          href="/events"
          className="bg-[#0B0B0B] border border-[#1A1A1A] rounded-md p-5 text-left hover:border-[#FF5B25] transition-colors"
        >
          <p className="font-mono text-sm text-[#F5F5F5] font-bold mb-1">Editor&rsquo;s Picks →</p>
          <p className="text-xs text-[#9B9B9B]">5–7 must-attend events with a blurb each</p>
        </Link>
        <Link
          href="/plan"
          className="bg-[#0B0B0B] border border-[#1A1A1A] rounded-md p-5 text-left hover:border-[#FF5B25] transition-colors"
        >
          <p className="font-mono text-sm text-[#F5F5F5] font-bold mb-1">Plan with AI →</p>
          <p className="text-xs text-[#9B9B9B]">Describe yourself, get 5–8 picks</p>
        </Link>
      </div>
    </div>
  )
}
