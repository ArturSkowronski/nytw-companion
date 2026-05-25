import type { Metadata } from 'next'
import Link from 'next/link'
import { EditorsPicksCarousel } from '@/components/EditorsPicksCarousel'
import { VirtusLabFooter } from '@/components/VirtusLabFooter'
import seedEvents from '@/data/seed-events.json' with { type: 'json' }
import type { Event } from '@/lib/types'

export const metadata: Metadata = {
  title: "NYTW Engineer's Companion — Tech Week NYC 2026",
  description:
    '87 hand-curated engineering events from AI infra, devtools, platform engineering, and more. Add to your plan in one click.',
}

export const revalidate = 3600

export default function HomePage() {
  const picks = (seedEvents as Event[]).filter((e) => e.is_editors_pick)

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center gap-8 pt-10">
        <div className="space-y-4 max-w-2xl">
          <p className="text-[#FF6B35] font-mono text-sm tracking-widest uppercase">
            Tech Week NYC · June 1–7, 2026
          </p>
          <h1 className="font-mono text-5xl md:text-7xl font-bold tracking-tight leading-none">
            NYTW Engineer&apos;s<br />Companion
          </h1>
          <p className="text-[#A3A3A3] text-lg md:text-xl leading-relaxed">
            1,047 events. 168 hours. Plan the week you actually want.
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

        <p className="text-[#737373] text-sm font-mono">
          or{' '}
          <Link href="/beyond" className="hover:text-[#A3A3A3] underline underline-offset-4">
            see /beyond if you want it all →
          </Link>
        </p>
      </section>

      {/* 3-step flow strip */}
      <section className="px-6 py-16 border-t border-[#1A1A1A]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { n: '①', label: 'Browse or AI-plan', body: '87 curated events, day-grouped, or describe yourself and let the AI propose a week.' },
            { n: '②', label: 'Add to My Plan', body: 'One-click add. Status tracking, conflict warnings, all stored in your browser.' },
            { n: '③', label: 'Sync to your calendar', body: 'Download .ics, drop it into Google Calendar / Outlook / Apple Calendar.' },
          ].map((step) => (
            <div key={step.n} className="space-y-2">
              <p className="text-[#FF6B35] font-mono text-2xl">{step.n}</p>
              <p className="font-mono font-bold text-[#FAFAFA] text-base">{step.label}</p>
              <p className="text-[#A3A3A3] text-sm leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Editor's Picks */}
      {picks.length > 0 && (
        <section className="px-6 py-16 border-t border-[#1A1A1A]">
          <div className="max-w-5xl mx-auto">
            <EditorsPicksCarousel picks={picks} />
          </div>
        </section>
      )}

      {/* Why we built this */}
      <section className="px-6 py-16 border-t border-[#1A1A1A]">
        <div className="max-w-3xl mx-auto space-y-5">
          <h2 className="font-mono text-2xl font-bold">Why we built this</h2>
          <p className="text-[#A3A3A3] text-base leading-relaxed">
            Tech Week NYC runs over a thousand events in a single week. No existing
            aggregator filters for engineers who actually ship code — they all surface
            the same founder dinners, networking mixers, and demo nights. We wanted
            something we&apos;d send to a colleague.
          </p>
          <p className="text-[#A3A3A3] text-base leading-relaxed">
            So this is one engineer&apos;s opinionated cut: 87 events across AI infra,
            devtools, platform engineering, security, and open source. Day-grouped,
            mapped, with honest blurbs on the Editor&apos;s Picks. Curation over filtering.
          </p>
          <p className="text-[#7A7A7A] text-sm font-mono pt-2">
            — Artur Skowroński, VirtusLab
          </p>
        </div>
      </section>

      {/* What we don't do */}
      <section className="px-6 py-16 border-t border-[#1A1A1A]">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="font-mono text-2xl font-bold">What we don&apos;t do</h2>
          <ul className="space-y-3 text-[#A3A3A3] text-base leading-relaxed">
            <li className="flex gap-3">
              <span className="text-[#FF6B35] font-mono shrink-0">•</span>
              <span>We don&apos;t RSVP for you. You click through to Luma/Partiful, then mark status here.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#FF6B35] font-mono shrink-0">•</span>
              <span>We don&apos;t have every event — we have 87 we&apos;d recommend to an engineer friend.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#FF6B35] font-mono shrink-0">•</span>
              <span>We don&apos;t track you. Plan stored in your browser. Email link only if you want recovery.</span>
            </li>
          </ul>
        </div>
      </section>

      <VirtusLabFooter />
    </main>
  )
}
