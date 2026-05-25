import type { Metadata } from 'next'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'
import sources from '@/data/external-sources.json'

export const metadata: Metadata = {
  title: "Beyond — NYTW Engineer's Companion",
  description:
    'Honest list of other Tech Week NYC aggregators — Yorkseed, GarysGuide, Vibecal, Carly AI, and more. We cover the engineering layer; these cover the rest.',
  alternates: { canonical: '/beyond' },
}

export default function BeyondPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="font-mono text-3xl md:text-4xl font-bold mb-4">
          Other places to find Tech Week NYC events
        </h1>
        <p className="text-[#A3A3A3] text-base md:text-lg leading-relaxed max-w-3xl">
          We curate 87 engineering-relevant events from 1,000+. We skip a lot.
          Here&apos;s where to find the rest.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-10">
          {sources.map((s) => (
            <article
              key={s.slug}
              className="rounded-lg border border-[#1A1A1A] bg-[#111111] p-5 flex flex-col gap-3"
            >
              <h2 className="font-mono text-lg font-bold text-[#FAFAFA]">{s.name}</h2>
              <p className="text-[#A3A3A3] text-sm leading-relaxed">{s.tagline}</p>
              <p className="font-mono text-xs">
                <span className="text-[#FF6B35]">Best for:</span>{' '}
                <span className="text-[#A3A3A3]">{s.bestFor}</span>
              </p>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start mt-1 font-mono text-xs text-[#FAFAFA] border border-[#2A2A2A] rounded px-3 py-1.5 hover:bg-[#1A1A1A] hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors"
              >
                Visit →
              </a>
            </article>
          ))}
        </div>

        <section className="mt-16 max-w-3xl">
          <h2 className="font-mono text-xl font-bold mb-3">
            Why we link the competition
          </h2>
          <p className="text-[#A3A3A3] text-base leading-relaxed">
            Tech Week is too big for one tool. We&apos;re the curated engineering
            layer; these cover what we don&apos;t.
          </p>
        </section>
      </section>

      <VirtusLabFooter />
    </main>
  )
}
