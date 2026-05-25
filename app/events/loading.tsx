export default function EventsLoading() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex gap-8">
        <nav className="hidden lg:flex flex-col gap-2 min-w-[80px] shrink-0">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 bg-[#0B0B0B] rounded animate-pulse" />
          ))}
        </nav>
        <div className="flex-1 space-y-3">
          <div className="h-10 bg-[#0B0B0B] rounded animate-pulse" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-[#0B0B0B] rounded animate-pulse" />
          ))}
        </div>
      </div>
    </main>
  )
}
