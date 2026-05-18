// app/(marketing)/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: "NYTW Engineer's Companion — Tech Week NYC 2026",
  description:
    '87 hand-curated engineering events from AI infra, devtools, platform engineering, and more. Add to your plan in one click.',
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-[90vh] px-6 text-center gap-8">
        <div className="space-y-4 max-w-2xl">
          <p className="text-[#FF6B35] font-mono text-sm tracking-widest uppercase">
            Tech Week NYC · June 1–7, 2026
          </p>
          <h1 className="font-mono text-5xl md:text-7xl font-bold tracking-tight leading-none">
            NYTW Engineer&apos;s<br />Companion
          </h1>
          <p className="text-[#A3A3A3] text-lg md:text-xl leading-relaxed">
            1,000+ events. 168 hours. Plan the week you actually want.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/events"
            className="px-8 py-4 bg-[#FF6B35] text-white font-mono font-bold text-lg rounded-md hover:bg-[#e85a25] transition-colors inline-flex items-center justify-center"
          >
            Browse 87 events →
          </Link>
          <Link
            href="/plan"
            className="px-8 py-4 border border-[#A3A3A3] text-[#FAFAFA] font-mono font-bold text-lg rounded-md hover:border-[#FAFAFA] hover:bg-[#111111] transition-colors inline-flex items-center justify-center"
          >
            Plan my week with AI →
          </Link>
        </div>
      </section>

      {/* Editor's Picks placeholder */}
      <section className="px-6 py-20 border-t border-[#1A1A1A]">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-baseline gap-3 mb-2">
            <h2 className="font-mono text-2xl font-bold">Editor&apos;s Picks</h2>
            <span className="text-[#FF6B35] text-sm font-mono">curated by VirtusLab</span>
          </div>
          <p className="text-[#A3A3A3] text-sm mb-8">
            5–7 must-attend events with honest blurbs explaining why. Coming once curation is complete.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-[#1A1A1A] bg-[#111111] p-6 space-y-3"
              >
                <div className="h-4 bg-[#1A1A1A] rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-[#1A1A1A] rounded w-full animate-pulse" />
                <div className="h-3 bg-[#1A1A1A] rounded w-2/3 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1A1A1A] px-6 py-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[#A3A3A3]">
          <p>
            Made by{' '}
            <a
              href="https://virtuslab.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FF6B35] hover:underline"
            >
              VirtusLab
            </a>
          </p>
          <p>Not affiliated with a16z or Tech Week NYC</p>
        </div>
      </footer>
    </main>
  )
}
