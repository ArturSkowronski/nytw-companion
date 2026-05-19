import Link from 'next/link'

export function MyPlanEmptyState() {
  return (
    <div className="text-center py-16 px-6">
      <p className="font-mono text-2xl font-bold text-[#FAFAFA] mb-2">
        Your plan is empty.
      </p>
      <p className="text-sm text-[#A3A3A3] mb-8">
        □ → □ → □
      </p>
      <div className="grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
        <Link
          href="/events"
          className="bg-[#111111] border border-[#1A1A1A] rounded-md p-5 text-left hover:border-[#FF6B35] transition-colors"
        >
          <p className="font-mono text-sm text-[#FAFAFA] font-bold mb-1">Browse events →</p>
          <p className="text-xs text-[#A3A3A3]">87 curated picks, day-grouped timeline</p>
        </Link>
        <Link
          href="/events"
          className="bg-[#111111] border border-[#1A1A1A] rounded-md p-5 text-left hover:border-[#FF6B35] transition-colors"
        >
          <p className="font-mono text-sm text-[#FAFAFA] font-bold mb-1">Editor&rsquo;s Picks →</p>
          <p className="text-xs text-[#A3A3A3]">5–7 must-attend events with a blurb each</p>
        </Link>
        <div
          aria-disabled="true"
          className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-md p-5 text-left cursor-not-allowed"
        >
          <p className="font-mono text-sm text-[#555555] font-bold mb-1">Plan with AI</p>
          <p className="text-xs text-[#333333]">Coming soon</p>
        </div>
      </div>
    </div>
  )
}
